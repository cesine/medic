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
    q             = require('./src/build/queue');

// Clean out temp directory, where we keep our generated apps
var libDir = path.join(__dirname, 'lib');
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

var queue = new q();

for (var i in config.builders) {

    var name = config.builders[i].name;

    var hook = require('./src/build/projects/' + name + '/hook');

    var main = require('./src/build/projects/' + name + '/build');


    main(function() {
        hook(function(jobs) {
            queue.push(jobs);
        });
    });

}
