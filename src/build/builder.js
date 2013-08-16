
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
var path             = require('path'),
    fs               = require('fs'),
    libraries        = require('../../libraries'),
    android_build    = require('./makers/android'),
    ios_build        = require('./makers/ios'),
    blackberry_build = require('./makers/blackberry'),
    mobilespec_build = require('./makers/mobspecbuilder'),
    mainbuilder          = require('../../build');

var builders = {
    'cordova-android':android_build,
    'cordova-ios':ios_build
    //'cordova-blackberry':blackberry_build
};

function build_the_queue(q, callback) {
    var job = q.shift();
    if (job) {
        job.builder(job.output_location, job.sha, job.devices, job.entry, function(err) {
            if (err) console.error('[BUILDER] Previous build failed, continuing.');
            build_the_queue(q, callback);
        });
    } else callback();
}

function log(msg){
    console.log("[BUILDER]  " + msg);
}

module.exports = function(app_builder, app_entry_point, static, mikecb) {
    
    // think this is the builder for just the test ap
    // we don't care or want this yet snce we do the test app build via createmobilespec.sh
    
    builders['mobilespec'] = mobilespec_build;
    if (static) {
        log("Buildling mobile spec, static");
        builders['mobilespec'](app_entry_point, function(err) {
            if (err) {
                log("Error, could not build mobile spec:");
                throw new Error('Could not copy test app over!');
            }
            console.log('[MEDIC] Test app built + ready.');
            mikecb();
           // Lets try to queue up the build/deploy of the platforms
        });

    } else {
        log("Building mobile spec, nonstatic...");
        builders['mobilespec'](app_entry_point, function(err) {
            if (err) {
                throw new Error('Could not build Test App! Aborting!');
            }
            console.log('[MEDIC] Test app built + ready.');
        });
    }
    

    return function builder(commits, callback) {
        // commits format:
        // { cordova-android:'sha'}
        // OR
        // { cordova-android:{
        //     sha:'sha',
        //     devices:[]
        //   }
        // }
        var miniq = [];
        for (var lib in commits) if (commits.hasOwnProperty(lib)) {
            if (builders.hasOwnProperty(lib)) {
                var job = {
                    library:lib,
                    builder:builders[lib],
                    output_location:libraries.output[lib],
                    entry:app_entry_point
                };

                // Some jobs might be for all devices, or specific devices
                if (typeof commits[lib] == 'string') {
                    job.sha = commits[lib];
                } else {
                    job.sha = commits[lib].sha;
                    job.devices = commits[lib].devices;
                }
                miniq.push(job);
            }
        }
        build_the_queue(miniq, callback);
    }
};
