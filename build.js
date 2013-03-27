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
    config        = require('./config'),
    q             = require('./src/build/queue'),
    argv          = require('optimist').argv;

// Clean out temp directory, where we keep our generated apps
var temp = path.join(__dirname, 'temp');
shell.rm('-rf', temp);
shell.mkdir(temp);

var default_spec = 'mobile_spec';
var queue = new q();

function go(maker) {
    var name = maker.name;

    console.log('[MEDIC] Running maker ' + name);

    // main initializes the builder, updating build tools
    var main = require('./src/build/makers/' + name + '/build');

    // the hook detects updates to repos and triggers medic to run specs
    var hook = require('./src/build/makers/' + name + '/hook');

    main(maker, function(initial_queue) {

        function queueJob(job) {
            for (var i in job) {
                if (job.hasOwnProperty(i)) {
                    var spec = job[i].spec ? job[i].spec.name : default_spec;
                    var git_url = job[i].spec ? job[i].spec.git : null;
                    var entry = job[i].spec ? job[i].spec.entry : config.app.entry;
                    job[i].builder = require('./src/build/makers/' + name + '/builder')(spec, entry, false, git_url);
                    queue.push(job);
                }
            }
        }

        // main build may return an array of initial jobs to queue
        initial_queue.forEach(queueJob);

        // start listening
        hook(queueJob, maker);
    });

}

var makerName = argv.m || argv.maker;

if (makerName) {
    var maker_not_found = config.makers.every(function(maker) {
        if (maker.name == makerName) {
            console.log('[MEDIC] maker=' + makerName);
            go(maker);
            return false;
        } else {
            return true;
        }
    });

    if (maker_not_found) {
        console.log("[MEDIC] No maker " + makerName);
    }
} else {
    config.makers.forEach(go);
}

