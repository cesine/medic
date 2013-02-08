var path          = require('path'),
    shell         = require('shelljs'),
    apache_parser = require('./src/apache-gitpubsub-parser'),
    request       = require('request'),
    couch         = require('./src/couchdb/interface'),
    libraries     = require('./libraries'),
    n             = require('ncallbacks'),
    bootstrap     = require('./bootstrap'),
    argv          = require('optimist').argv,
    commit_list   = require('./src/build/commit_list'),
    queue         = require('./src/build/queue');

// Clean out temp directory, where we keep our generated apps
var temp = path.join(__dirname, 'temp');
shell.rm('-rf', temp);
shell.mkdir(temp);

// Sanitize/check parameters if we are forcing a build.
if (argv.force) {
    if (argv.force.indexOf('@') == -1) {
        console.error(['--force takes a parameter of the form <platform>@<sha>, where:',
                       '  <platform> - one of android, blackberry or ios',
                       '  <sha> - a string representing a particular commit SHA for the specified platform'].join('\n'));
        process.exit(1);
    } else {
        var params = argv.force.split('@');
        var platform = params[0];
        var sha = params[1];
        if (!(('cordova-' + platform) in libraries.paths)) {
            console.error('--force parameter platform "' + platform + '" not recognized.');
            process.exit(1);
        } else {
            var res = shell.exec('cd ' + libraries.paths['cordova-' + platform] + ' && git branch --contains ' + sha, {silent:true});
            if (res.code > 0) {
                console.error('--force parameter SHA "' + sha + '" not found in cordova-' + platform);
                process.exit(1);
            }
        }
    }
}

// bootstrap makes sure we have the libraries cloned down locally and can query them for commit SHAs and dates
bootstrap.go(function() {
    // on new commits, queue builds for relevant projects.
    var apache_url = "http://urd.zones.apache.org:2069/json";
    var gitpubsub = request.get(apache_url);
    gitpubsub.pipe(new apache_parser(function(project, sha) {
        // ignore if its mobile spec
        if (project.indexOf('mobile-spec') > -1) return;
        // handle commit bunches
        // number of most recent commits including newest one to check for queueing results.
        // since you can commit multiple times locally and push multiple commits up to repo, this ensures we have decent continuity of results
        var num_commits_back_to_check = 5;
        var commits = commit_list.recent(project, num_commits_back_to_check).shas;
        check_n_queue(project, commits); 
    }));
    console.log('[MEDIC] Now listening to Apache git commits from ' + apache_url);

    // If used with --force parameter, queue that single build.
    // Otherwise, compare connected devices to stored results and queue any missing results as new jobs
    if (argv.force && platform && sha) {
        console.log('[QUEUE] Forcing build of cordova-' + platform + '@' + sha);
        var job = {};
        job['cordova-' + platform] = {
            'sha':sha
        };
        queue.push(job);
    } else {
        console.log('[MEDIC] Querying local devices and queueing builds (if applicable)...');
        // Look at results for specific devices of recent commits. Compare to connected devices. See which are missing from server. Queue those builds.
        var ms = 'cordova-mobile-spec';
        for (var lib in libraries.paths) if (libraries.paths.hasOwnProperty(lib) && lib != ms) (function(repo) {
            var commits = commit_list.recent(repo, 20).shas;
            check_n_queue(repo, commits);
        })(lib);
    }
});

// Given a repository and array of commits for that repository, 
function check_n_queue(repo, commits) {
    var platform = repo.substr(repo.indexOf('-')+1);
    // TODO: figure out ios device scanning. issue: determine what model and version connected ios devices are running. until then, we can't queue ios builds on devices that we are missing results for, so we look at ios commits with no results and queue those up.
    if (repo == 'cordova-ios') {
        // look at latest commits and see which ones have no results
        commits.forEach(function(commit) {
            couch.mobilespec_results.query_view('results', 'ios?key="' + commit + '"', function(error, result) {
                if (error) {
                    console.error('[COUCH] Failed to retrieve iOS results for sha ' + commit.substr(0,7) + ', continuing.');
                } else {
                    if (result.rows.length === 0) {
                        // no results, queue the job!
                        var job = {
                            'cordova-ios':{
                                'sha':commit
                            }
                        };
                        queue.push(job);
                    }
                }
            });
        });
    } else {
        // scan for devices for said platform
        var platform_scanner = require('./src/build/makers/' + platform + '/devices');
        var platform_builder = require('./src/build/makers/' + platform);
        platform_scanner(function(err, devices) {
            if (err) console.log('[BUILD] Error scanning for ' + platform + ' devices: ' + devices);
            else {
                var numDs = 0;
                for (var d in devices) if (devices.hasOwnProperty(d)) numDs++;
                if (numDs > 0) {
                    commits.forEach(function(commit) {
                        var job = {};
                        var targets = 0;
                        job[repo] = {
                            sha:commit,
                            numDevices:0,
                            devices:{}
                        };
                        var end = n(numDs, function() {
                            if (targets > 0) {
                                job[repo].numDevices = targets;
                                queue.push(job);
                            }
                        });
                        for (var d in devices) if (devices.hasOwnProperty(d)) (function(id) {
                            var device = devices[id];
                            var version = device.version;
                            var model = device.model;
                            var couch_id = platform + '__' + commit + '__' + version + '__' + model;
                            couch.mobilespec_results.get(couch_id, function(err, res_doc) {
                                if (err && res_doc == 404) {
                                    // Don't have results for this device!
                                    targets++;
                                    job[repo].devices[id] = {
                                        version:version,
                                        model:model
                                    }; 
                                }
                                end();
                            });
                        }(d));
                    });
                }
            }
        });
    }
};
