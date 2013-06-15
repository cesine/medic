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
    q             = require('./src/queue'),
    argv          = require('optimist').argv;

// Clean out temp directory, where we keep our generated apps
var temp = path.join(__dirname, 'temp');
shell.rm('-rf', temp);
shell.mkdir(temp);

var default_spec = 'mobile_spec';
var queue = new q();

if (argv.server) {
    // fire up a server, n start waitin for requests

    console.log('[MEDIC] Running web server.');
    
    var express = require('express'),
        app = express();

    app.use(express.bodyParser());

    // Oh so secure.
    var auth = express.basicAuth(function(user, pass) {
       return (user == config.pgb.username && pass == config.pgb.password);
    });

    app.post('/medic', auth, function(request, response){
      console.log('[SRVR] Request received.')
      var params = request.body;
      if (params.name && (params.git || params.zip) && params.gap_versions) {
          console.log('[SRVR] params look OK, running');
          response.send("");    // echo the result back
          run([{
            "name": params.name,
            "tag": "0.4.0",
            "git": params.git,
            "gap_versions": params.gap_versions,
            "host": params.host || null,
            "zip": params.zip
          }]);
      } else {
        console.log('[SRVR] Bad params.');
        response.status(400).send('{"error":"your params suck balls"}');
      }
    });

    app.get('/*', function(request, response) {
        console.log('[SRVR] GET request koffed');
        response.status(404).send("'koff.");
    });

    app.listen(config.api_host.port, config.api_host.address);
    console.log("Listening to http://" + config.api_host.address + ":" + config.api_host.port + "/");


} else {

    console.log('[MEDIC] Running.');

    run(config.specs);
}

function run(specs) {

    console.log('[MEDIC] Starting');
        // clones the repos
    var init = require('./src/builder/init');

    // the runner, well, runs
    var runner = require('./src/builder/runner');

    init(specs, function(initial_queue) {

        function queueJob(job) {
            for (var i in job) {
                if (job.hasOwnProperty(i)) {
                    var spec = job[i].spec ? job[i].spec.name : default_spec;
                    var git_url = job[i].spec ? job[i].spec.git : null;
                    var entry = job[i].spec ? job[i].spec.entry : config.app.entry;
                    job[i].builder = require('./src/builder/builder')(spec, entry, false, git_url);
                    queue.push(job);
                }
            }
        }

        // init build may return an array of initial jobs to queue
        initial_queue.forEach(queueJob);

        // start listening
        runner(queueJob, specs);
    });

}

