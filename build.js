#!/usr/bin/env node
/*
Copyright (c) 2012 Adobe Systems Incorporated. All rights reserved.

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/
var path          = require('path'),
    shell         = require('shelljs'),
    apache_parser = require('./src/apache-gitpubsub-parser'),
    request       = require('request'),
    couch         = require('./src/couchdb/interface'),
    libraries     = require('./libraries'),
    config        = require('./config'),
    n             = require('ncallbacks'),
    bootstrap     = require('./bootstrap'),
    argv          = require('optimist').argv,
    commit_list   = require('./src/build/commit_list'),
    updater       = require('./src/build/updater'),
    q             = require('./src/build/queue'),
    mobSpecBuilder = require('./src/build/makers/mobspecbuilder');

// Clean out temp directory, where we keep our generated apps

console.log("");
console.log("");
console.log("");
console.log("");
console.log("Beginning new fresh run");

var temp = path.join(__dirname, 'temp');
shell.rm('-rf', temp);
shell.mkdir(temp);

function log(err) {
    if (err) {
        console.error(err);
        process.exit(1);
    } else {
        console.log('Usage:');
        process.exit(0);
    }
}

var queue;

// should we even bother building certain platforms
var should_build = {
    'cordova-blackberry':(config.blackberry.devices.ips && config.blackberry.devices.ips.length > 0),
    'cordova-ios':(config.ios.keychainLocation && config.ios.keychainLocation.length > 0),
    'cordova-android':true
};

// we really don't need any of this



// --entry, -e: entry point into the app. index.html as default.
var app_entry_point = argv.e || argv.entry || config.app.entry || 'index.html';     // config.app.entry is the autotest page

/*
var remote_app = app_entry_point.indexOf('http') === 0;

// Sanitize/check parameters.
// --app, -a: relative location to static app 
var static = argv.a || argv.app || config.app.static.path;
if (!static && !remote_app) {
    // must be dynamic app
    var app_commit_hook = argv.h || argv.hook || config.app.dynamic.commit_hook;
    var app_git = argv.g || argv.git || config.app.dynamic.git;
    if (!app_git) {
        log('No test application git URL provided!');
    }
    // --builder, -b: path to node.js module that will handle app prep
    var app_builder = argv.b || argv.builder || config.app.dynamic.builder;
    if (!app_builder) {
        log('No application builder module specified!');
    }
}

*/
//  this could still be useful

// --platforms, -p: specify which platforms to build for. android, ios, blackberry, all, or a comma-separated list
// can also specify a specific sha or tag of cordova to build the app with using <platform>@<sha>
// if none specified, builds for all platforms by default, using the latest cordova. this means it will also listen to changes to the cordova project
// TODO: SOON: use the platforms check_reqs script to make sure current machien can build for certain scripts. https://issues.apache.org/jira/browse/CB-2788
var platforms = argv.p || argv.platforms || config.app.platforms;
if (!platforms) {
    platforms = libraries.list;
}
if (typeof platforms == 'string') {
    platforms = platforms.split(',').filter(function(p) { 
        return libraries.list.indexOf(p.split('@')[0]) > -1;
    });
}
// determine which platforms we listen to apache cordova commits to
// we need to change this from the libraries.list to libraris.platformswecareabout

var head_platforms = platforms.filter(function(p) {
    return p.indexOf('@') == -1;
}).map(function(p) { return 'cordova-' + p; });     // adds "cordova-" 

for(p in libraries.repos_we_care_about){
    if(head_platforms.indexOf(p) == -1){
        head_platforms.push(p);     // I'm sure there is a better way to do this.
    }
}

// don't care about this
// determine which platforms are frozen to a tag
/*var frozen_platforms = platforms.filter(function(p) {
    return p.indexOf('@') > -1;
});*/


function getSHA(library){
    // name should be something like "cordova-xxx"
    var shaRegExp = /^[0-9]*\s+([a-z0-9]+)/;
    var commitList = shell.exec('cd ' + path.join(githubPath,library) + ' && git rev-list --all --pretty=oneline --timestamp --max-count=1', {silent:true});

    if (commitList.code > 0) throw ('Failed to get commit list for ' + library + ' library.');
    var commitArr = commitList.output.split('\n');
    commitArr = commitArr.slice(0, commitArr.length - 1);
    var shaList = commitArr.map(function(c) {
        var res = shaRegExp.exec(c);
        if (res) return res[1];
    });
    shaList = shaList+"";   //type coercion so we can substr and get the shortened SHA
    return shaList;
}

function getUniqueSHAKey(){
    // Creates a unique key to store results in teh db
    // it is the tiny SHA of every platform
    // later used with device info to generate a unique key
    var key = "";
    for(i in libraries.repos_we_care_about){
        key+= library +"_"+ substr(getSHA(i),6) + "_";
    }
    return key;
}

console.log("[build] - head_platforms:" + head_platforms);
// bootstrap makes sure we have the libraries cloned down locally and can query them for commit SHAs and dates
new bootstrap(/*app_git*/null, /*app_builder*/ null).go(function() {            
// Since we will clone all libraries with coho, don't bother giving it app_git
// The default app_builder is this: src/build/makers/mobile_spec   but we dont' really need a maker for mobile_spec if we use the script

    // removing this part - we will start with the libraries cloned down and update them with coho and createmobilespec.sh

    /*
    if (!static && !remote_app) { 
        // Set up build queue based on config
        queue = new q(app_builder, app_entry_point, false);
    } else {
        // static app support
        queue = new q('./src/build/makers/static', app_entry_point, (remote_app ? app_entry_point : static));
    }
    */
    //queue = new q('./src/build/makers/static', app_entry_point, (remote_app ? app_entry_point : static));

//queue = new q('./src/build/makers/android',app_entry_oint,false);

//queue = new q('./src/build/makers/mobspecbuilder',app_entry_point,false);

 /*mobSpecBuilder(app_entry_point, function(){
                    console.log("[build][mobspecbuilder] - done calling mobSpecBuilder!")
                });*/

//queue = new q();//null,null,null);
//  what the hell is static?
//queue = new q('./src/build/makers/mobilespecbuilder', app_entry_point, null); // static is reserved in strict mode

    //queue.push( new q('./src/build/makers/ios',app_entry_point,false));
   
   //queue = new q();

    queue = new q('./src/build/makers/mobilespecbuilder', app_entry_point, true, function(){
        console.log("-------------------- so ugly -----------");
        queueItAll();
    });
   //queue = new q("mobilespec");
   
   // we don't want to do this until mobilespecbuilder is built... for some reason it doesn't wait.
   /*
   var job = {};
                job['cordova-ios'] = {  // because in queue, the libs are cordova-*
                    "sha":"HEAD"
                }
    queue.push(job);
    */
   // queueItAll();
    

    // Don't think this really works any more; how would you describe a test? {library SHA}{mobile spec sha}[{plugin SHA}....{plugin SHA}] ?
    // Since it is CI, just always listen for latest commits and do those

    /*
    // If there are builds specified for specific commits of libraries, queue them up
    if (frozen_platforms.length > 0) {
        console.log('[MEDIC] Queuing up frozen builds.');
        frozen_platforms.forEach(function(p) {
            var tokens = p.split('@');
            var platform = tokens[0];
            var sha = tokens[1];
            if (sha == 'HEAD') {
                sha = commit_list.recent('cordova-' + platform, 1).shas[0];
            }
            var job = {};
            job['cordova-' + platform] = {
                "sha":sha
            }
            queue.push(job);
        });
        console.log('[MEDIC] Frozen build queued.');
    }
    if (static || remote_app) {
        // just build the head of platforms
        console.log('[MEDIC] Building test app for latest version of platforms.');
        head_platforms.forEach(function(platform) {
            if (should_build[platform]) {
                var job = {};
                job[platform] = {
                    "sha":"HEAD"
                }
                queue.push(job);
            }
        });
    } else {
    */
        // on new commits to cordova libs, queue builds for relevant projects.
        if (head_platforms.length > 0) { 
            var apache_url = "http://urd.zones.apache.org:2069/json";
            var gitpubsub = request.get(apache_url);

            // these are all....null
            //console.log("[build] - Starting gitpubsub pipe:" + project + "," + sha + "," + ref);

            console.log("[MEDIC] - starting gitpubsub pipe");
            gitpubsub.pipe(new apache_parser(function(project, sha, ref) {
                // only queue for platforms that we want to build with latest libs
                // and only queue for commits to master branch

                // problem here is that this gets called from the gitpubsub, once an interesting commit comes in
                // but we are getting commits from a lot of different projects: cordova-plugins-*, cordova-{core}, etc
                // but if you look in this code, mostly check_n_queue, we are creating the key from the ios/android commit
                // so we need to make a better/different key using the sha's of every project?
                console.log("Starting pipe for:" + project + ", " + sha + ", " + ref);

                // right here, the projct is things liek cordova-blackberry, or cordova-plugin-geolocation


                if (head_platforms.indexOf(project) > -1 && ref == 'refs/heads/master') {
                    // update the local repo
                    var job = {};
                    job[project] = sha;
                    console.log("[MEDIC], launching updater for job:" + JSON.stringify(job));

                  
                    //updater(job, function() { // dont thinkw e ened to run the updater

                        // handle commit bunches
                        // number of most recent commits including newest one to check for queueing results.
                        // since you can commit multiple times locally and push multiple commits up to repo, this ensures we have decent continuity of results
                        var num_commits_back_to_check = config.numberOfCommits; // Mike added
                        var commits = commit_list.recent(project, num_commits_back_to_check).shas;

                        /// since this is the callback that gets fired when a new interesting commit comes in
                        // we need to scheule a mobspecbuilder job

                        var job = {};
                        job['mobilespec'] = {  // because in queue, the libs are cordova-*
                            "sha":"HEAD"
                        }
                        queue.push(job);

                        // We almost don't need this if statement ever....the callback shoudl just be create this mobilespec job, and
                        // give it a callback to 1, create the unique SHA, and 2, check_n_queue

                        check_n_queue(project, commits); 
                    //});
                }else{

                    console.log("nothign happened");
                }
            }));
            console.log('[MEDIC] Now listening to Apache git commits from ' + apache_url);
        }

/*
            var project = "cordova-android";
            var commits = commit_list.recent(project, config.numberOfCommits).shas;
            console.log("[commits are:" + JSON.stringify(commits));


            console.log('[BUILD] - Now calling mobspec builder');

            //console.log("[build][medic][new] is this sha the head of something?:" + sha);
                mobSpecBuilder(app_entry_point, function(){
                    console.log("[build][mobspecbuilder] - done calling mobSpecBuilder!")
                });
*/

            // queue up builds for any missing recent results for HEAD platforms too
            //onsole.log('[build]  head_platforms is: ' + JSON.stringify(head_platforms));
            // think this needs to be in a callback for the mobilespec builer 

/*
            head_platforms.forEach(function(platform) {
                if (should_build[platform]) {
                    var commits = commit_list.recent(platform, config.numberOfCommits).shas;    // mike added
                   // console.log("[build] - check_n_queue for commits on head_platforms, commits arrray: " + commits);
                    check_n_queue(platform, commits);
                }
            });
            */
            
        
        /*
        // if app commit_hook exists, wire it up here
        if (app_commit_hook) {
            if (app_commit_hook.lastIndexOf('.js') == (app_commit_hook.length - 3)) {
                app_commit_hook = app_commit_hook.substr(0, app_commit_hook.length -3);
            }
            var hook;
            try {
                hook = require('./' + app_commit_hook);
            } catch(e) {
                console.error('[MEDIC] [ERROR] ..requiring app hook. Probably path issue: ./' + app_commit_hook);
                console.error(e.message);
            }
            if (hook) {
                hook(function(sha) {
                    // On new commits to test project, make sure we build it.
                    // TODO: once test project is created, we should also queue it for relevant platforms
                    queue.push({
                        'test':sha
                    });
                });
                console.log('[MEDIC] Now listening for test app updates.');
            } else {
                console.log('[MEDIC] [WARNING] Not listening for app commits. Fix the require issue first!');
            }
        }
        */

    // }
});
function queueItAll(){
    console.log("[MEDIC] - queueItAll");
            head_platforms.forEach(function(platform) {
                console.log("Checking:" + platform);
                if (should_build[platform]) {
                    console.log("Gettign commits from commit_list");
                    var commits = commit_list.recent(platform, config.numberOfCommits).shas;    // mike added
                   console.log("[build] - check_n_queue for commits on head_platforms, commits arrray: " + commits);
                    check_n_queue(platform, commits);
                }
            });
}
// Given a repository and array of commits for that repository, 
function check_n_queue(repo, commits) {
    console.log('[MEDIC] Checking ' + repo + '\'s ' + commits.length + ' most recent commit(s) for results on your couch...');
    var platform = repo.substr(repo.indexOf('-')+1);
    // TODO: figure out ios device scanning. issue: determine what model and version connected ios devices are running. until then, we can't queue ios builds on devices that we are missing results for, so we look at ios commits with no results and queue those up.

    if (repo == 'cordova-ios') {
        // look at latest commits and see which ones have no results
        console.log("Repo is: ios!");
        commits.forEach(function(commit) {
            couch.mobilespec_results.query_view('results', 'ios?key="' + commit + '"', function(error, result) {
                if (error) {
                    console.error('[COUCH] Failed to retrieve iOS results for sha ' + commit.substr(0,7) + ', continuing.');
                } else {
                    console.log("[BUILD] - adding new job to ios queue, commit is:" + commit);
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
        console.log("Android platform scanning");
        var platform_scanner = require('./src/build/makers/' + platform + '/devices');
        var platform_builder = require('./src/build/makers/' + platform);
        platform_scanner(function(err, devices) {
            if (err) console.log('[BUILD] Error scanning for ' + platform + ' devices: ' + devices);
            else {
                var numDs = 0;
                for (var d in devices) if (devices.hasOwnProperty(d)) numDs++;
                if (numDs > 0) {
                    //console.log("[BUILD] - build.js - creating jobs for these commits");

                    commits.forEach(function(commit) {
                        var job = {};
                        var targets = 0;
                        job[repo] = {
                            sha:commit,
                            numDevices:0,
                            devices:{}
                        };
                        var end = n(numDs, function() {
                                //console.log("[MIKE-BUILD] - end(), so ading this job to the queue")
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
                                    // Create this job!
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
    //console.log("Done scanning for Android targets");
    }
};
// module.exports = function(){
//         console.log("0------------------ calling queueitall");
//     queueItAll();
// }

//module.exports = {"queue":queueItAll};











