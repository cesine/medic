
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
var libraries     = require('../../libraries'),
    n             = require('ncallbacks'),
    templates     = require('./templates'),
    commits       = require('../build/commit_list'),
    updater       = require('../build/updater'),
    request       = require('request'),
    apache_parser = require('../apache-gitpubsub-parser'),
    couch         = require('../couchdb/interface');

function query_for_results(platform, shas, callback) {
    //console.log("[api.js] - queryForResults! - " + platform);
    // at this point (eg, still bootup), SHAS is going to be tested_shas, which'll be like
    // a giant list of all of the SHA"S that have happened
    //console.log(JSON.stringify(shas));
//console.log("lol the callback" + calllback);  //not sure why the callback keeps being undefined :()
//console.log(JSON.stringify(callback));  // always undefined even the alst one :/
    var commits = shas.slice(0);    // just create a copy of the shas array
    var sha = commits.shift();      // only grab the first sha

    if (sha) {
        var view = platform + '?key="' + sha + '"';
        couch.mobilespec_results.query_view('results', view, function(error, result) {
            if (error) {
                console.error('query failed for mobile spec results', error); throw 'Query failed';
            }
            if (result.rows.length) {
                result.rows.forEach(function(row) {
                    module.exports.add_mobile_spec_result(platform, sha, row);
                });
            }
            query_for_results(platform, commits, callback);
        });
    } else {
        if (callback) {
            callback();
        }
    }
}
function query_for_errors(platform, shas, callback) {
    console.log("[api.js] - query_for_errors now!");
    // looks like it is just the same function as query_for_results, only now we probably 
    // will query the build_errors table in couch and add those to the dashboard
    var commits = shas.slice(0);
    var sha = commits.shift();

    if (sha) {
        var view = platform + '?key="' + sha + '"';
        // get build errors from couch for each repo
        couch.build_errors.query_view('errors', view, function(error, result) {
            if (error) {
                console.error('query failed for build errors', error); throw 'Query failed';
            }
            if (result.rows.length) {
                result.rows.forEach(function(row) {
                    module.exports.add_build_failure(platform, sha, row);
                });
            }
            query_for_errors(platform, commits, callback);
        });
    } else {
        if (callback) {
            callback();
        }
    }
}

function setup_tested_commits(lib) {
    console.log('[MEDIC] [API] Re-setting commits API for ' + lib + '.');
        // seems like this gets called every time

    module.exports.tested_shas[lib] = commits.since(lib, libraries.first_tested_commit[lib]);
    // for each library, look up how many commits have passed since the first one, add those and the dates to the tested_shas[lib]

    module.exports.commits[lib] = {};
    module.exports.commits[lib].shas = module.exports.tested_shas[lib].shas.slice(0,2);        // this must be wehre we get the 20 most recent commits!
    module.exports.commits[lib].dates = module.exports.tested_shas[lib].dates.slice(0,2);      // hmmmm, must be at least 2 since we get most recent and second most recent
};

module.exports = {
    commits:{},
    results:{},
    errors:{},
    tested_shas:{},
    boot:function(callback) {
        console.log("[api.js] - boot() - entering API bootup");

        // final callback setup
        // TODO: once BB works get rid of the -1 below.
        var counter = ((libraries.list.length-1) * 2);      // multiply by two since we are calling two functions that use this (query_for_results and query_for_errors)
        console.log("[api.js] - counter, number of libraries minus BB:" + counter);
        var end = n(counter, callback);

        // update all libs, then get list of all sha's we've tested
        // query each sha for data
        updater(libraries.first_tested_commit, function() {
            console.log("[api - callback] - callback to updater()");
            for (var repo in libraries.first_tested_commit) if (libraries.first_tested_commit.hasOwnProperty(repo)) (function(lib) {
                // first_tested_commit is like this: {ios: "34534535432",  "android" : "435345353453"}
                // so for each one of the platforms (ios, android), call setup_tested_commits
                setup_tested_commits(lib);  
                var platform = lib.substr('cordova-'.length);
                console.log('[COUCH] Querying ' + platform + ' for ' + module.exports.tested_shas[lib].shas.length + ' SHAs...'); 
                query_for_results(platform, module.exports.tested_shas[lib].shas, end);
                // tested_shas is what we foun in the previous setup_tested_commits, so it's all the commits
                // that have happened since the first_tested one that we have hardcoded into the db
                query_for_errors(platform, module.exports.tested_shas[lib].shas, end);
            })(repo);
        });

        console.log("[api] - last bit of bootstrap");
        // on new commits, update commit lists with sha and date.
        var apache_url = "http://urd.zones.apache.org:2069/json";
        // this apache_url is some big list of json, can't really open it up though without permissions...
        // kind of seems liek it must be some module....that has a .pipe() function 
            // maybe we are hosting some module here?
            
        var gitpubsub = request.get(apache_url);
        gitpubsub.pipe(new apache_parser(function(project, sha, ref) {
            if (ref == 'refs/heads/master' && project in libraries.first_tested_commit) {
                // guess this is just where we check tos ee if there are new commits on refs/head/master, and if we have
                // this library in first_tested_commit, eg, we've tested it once, then update it
                // this also seems to call setup_tested_commits() again
                // somwehre in this code is where we get the JSON parsing error when updates come in
                console.log('[MEDIC] New commits for ' + project + '.');
                var lib = {};
                lib[project] = sha;
                updater(lib, function() {
                    setup_tested_commits(lib);
                });
            }
        }));
        console.log('[MEDIC] Now listening to Apache git commits from ' + apache_url);
        // it says this right away in the output log, doesn't wait for all of the other init stuff from the callback
        // above to updater, guess just bc of the time it takes to go out and fetch those uupdates


        // subscribe to couch changes for mobile spec results
        couch.mobilespec_results.follow(function(err, change) {
            if (err) console.error('mobspecresult FOLLOW ERR OMFGWTFBBQ', err);
            else if (change.deleted) return;
            else {
                console.log('[COUCH] New mobile-spec result for ' + change.doc.platform + ' ' + change.doc.version + ', ' + change.doc.model);
                var doc = {
                    value:{
                        total:change.doc.mobilespec.total,
                        passed:(change.doc.mobilespec.total - change.doc.mobilespec.failed),
                        fails:change.doc.mobilespec.failures,
                        model:change.doc.model,
                        version:change.doc.version
                    }
                };
                module.exports.add_mobile_spec_result(change.doc.platform, change.doc.sha, doc);
            }
        });

        // subscribe to couch changes for build errors
        couch.build_errors.follow(function(err, change) {
            if (err) console.error('builderros FOLLOW ERR OMFGWTFBBQ', err);
            else {
                console.log('[COUCH] New build error.');
                module.exports.add_build_failure(change.doc.platform, change.doc.sha, change.doc);
            }
        });
    },
    add_mobile_spec_result:function(platform, sha, doc) {
        // looks liek it just parses out the data from the couchDB and adds it to 
        // module.exports.results[platform][sha][version][model] 
        // tests: number of tests,   numfails: number of fails, fails: the text of the failures

        var tests = doc.value.total, num_fails = (doc.value.total - doc.value.passed), failText = doc.value.fails;

        platform = platform.toLowerCase();
        var model = doc.value.model;
        var version = doc.value.version;

        // Make sure results have proper parent objects
        if (!module.exports.results[platform]) module.exports.results[platform] = {};
        if (!module.exports.results[platform][sha]) module.exports.results[platform][sha] = {};
        if (!module.exports.results[platform][sha][version]) module.exports.results[platform][sha][version] = {};
        if (!module.exports.results[platform][sha][version][model]) module.exports.results[platform][sha][version][model] = {};

        module.exports.results[platform][sha][version][model] = {
            tests:tests,
            num_fails:num_fails,
            fails:failText
        };
    },
    add_build_failure:function(platform, sha, doc) {
        if (!module.exports.errors[platform]) module.exports.errors[platform] = {};
        if (!module.exports.errors[platform][sha]) module.exports.errors[platform][sha] = {};
        module.exports.errors[platform][sha] = doc;
    }
};
