var request       = require('request'),
    apache_parser = require('./apache-gitpubsub-parser'),
    config        = require('../../../../config'),
    libraries     = require('./libraries'),
    commit_list   = require('../../commit_list'),
    couch         = require('../../../couchdb/interface'),
    n             = require('ncallbacks');

var apache_url = "http://urd.zones.apache.org:2069/json";

// should we even bother building certain platforms
var should_build = {
    'cordova-blackberry':(config.blackberry.devices.ips && config.blackberry.devices.ips.length > 0),
    'cordova-ios':(config.ios.keychainLocation && config.ios.keychainLocation.length > 0),
    'cordova-android':true
};

// determine which platforms we listen to apache cordova commits to
//var platforms = argv.p || argv.platforms || config.app.platforms;
var platforms;
if (!platforms) {
    platforms = libraries.list;
}
if (typeof platforms == 'string') {
    platforms = platforms.split(',').filter(function(p) { 
        return libraries.list.indexOf(p.split('@')[0]) > -1;
    });
}

var head_platforms = platforms.filter(function(p) {
    return p.indexOf('@') == -1;
}).map(function(p) { return 'cordova-' + p; });

module.exports = function(callback) {

    console.log('hi');

    var gitpubsub = request.get(apache_url);


    gitpubsub.pipe(new apache_parser(function(project, sha) {
        // only queue for platforms that we want to build with latest libs
        if (head_platforms.indexOf(project) > -1) {
            // update the local repo
            var job = {};
            job[project] = sha;
            updater(job, function() {
                // handle commit bunches
                // number of most recent commits including newest one to check for queueing results.
                // since you can commit multiple times locally and push multiple commits up to repo, this ensures we have decent continuity of results
                var num_commits_back_to_check = 5;
                var commits = commit_list.recent(project, num_commits_back_to_check).shas;
                var job = check_n_queue(project, commits, callback); 
            });
        }
    }));
    console.log('[MEDIC] Now listening to Apache git commits from ' + apache_url);

    // queue up builds for any missing recent results for HEAD platforms too
    head_platforms.forEach(function(platform) {
        if (should_build[platform]) {
            var commits = commit_list.recent(platform, 10).shas;
            check_n_queue(platform, commits, callback);
        }
    });
};


// Given a repository and array of commits for that repository, 
function check_n_queue(repo, commits, callback) {
    console.log('[MEDIC] Checking ' + repo + '\'s ' + commits.length + ' most recent commit(s) for results on your couch...');
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
                        callback(job);
                    }
                }
            });
        });
    } else {
        // scan for devices for said platform
        var platform_scanner = require('../../platforms/' + platform + '/devices');
        var platform_builder = require('../../projects/cordova/' + platform);
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
                                callback(job);
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
