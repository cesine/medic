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

var shell = require('shelljs'),
    fs    = require('fs'),
    path  = require('path'),
    libs  = require('./libraries');

var libDir = path.join(__dirname, 'lib');
shell.mkdir('-p', libDir);
shell.rm('-rf', path.join(libDir, 'test'));

var contents = fs.readdirSync(libDir);

var command_queue = [];

/*  We probably could still use the whole "specify which platforms", but we don't need this part to update stuff since there's billion repos now

for (var repo in libs.paths) if (libs.paths.hasOwnProperty(repo) && repo != 'test') (function(lib) {
// Add commands to our command queue to wipe out and refetch all of our repos
    if (contents.indexOf(lib) == -1) {
        // Don't have the lib, get it.
        var cmd = 'git clone https://git-wip-us.apache.org/repos/asf/' + lib + '.git ' + path.join(libDir, lib);
    } else {
        // Have the lib, update it.
        var cmd = 'cd ' + path.join(libDir, lib) + ' && git checkout -- . && git pull --tags origin master';
    }

	// getting merge errors when we do this for some reason, just try to get clone down the repo anyway
	//var cmd = 'cd ' + path.join(libDir, lib) + ' && cd ../ && rm -rf * && git clone https://git-wip-us.apache.org/repos/asf/' + lib + '.git ' + path.join(libDir, lib);
//cmd = 'cd ' + path.join(libDir, lib) + ' && rm -rf * && cd ../ && rm -rf ' + lib + ' && git clone https://git-wip-us.apache.org/repos/asf/' + lib + '.git ';
//log("[MIKE] ----   new command we are going to do: " + cmd);
cmd = 'cd ' + path.join(libDir, lib) + ' && rm -rf * && cd ../ && rm -rf ' + lib;
command_queue.push(cmd);
cmd = 'cd ' + libDir + ' && git clone https://git-wip-us.apache.org/repos/asf/' + lib + '.git ';


    command_queue.push(cmd);
})(repo);


*/
function log(msg) {
    console.log('[BOOTSTRAP] ' + msg);
}

function go(q, builder, cb) {

    var cmd = q.shift();
    // pop the next command from the queue, and execute it
    if (cmd) {
        log("Executing " + cmd);

        shell.exec(cmd, {silent:true, async:true}, function(code, output) {
            if (code > 0) {
                log('Error running previous command! Output to follow.');
                log(output);
            } 
            go(q, builder, cb); // Not sure why we use recursion instead of a for:each loop in cmd

        });
    } else {
        // TODO: use the builder.
        log(' Complete.');
        if (cb) cb();
        // the first time when we start the server, this callback is api.boot()
        // so the firs ttime, i guess it just 
    }
}

function bootstrap(url, builder) {
    log("Startup bootstrap, url (app-git, this shouldn't matter anymore:" + url);
    log("The builder is thus: " + builder);
    this.test_builder = builder;

    // Never really giving it a URL so it should never have to run this
    if (url) {
        var test_path = path.join(libDir, 'test');
        var cmd;
        log('Cloning: ' + test_path + " and running:'" + cmd);
        if (fs.existsSync(test_path)) {
            cmd = 'cd ' + test_path + ' && git checkout -- . && git pull origin master';
        } else {
            cmd = 'git clone ' + url + ' ' + test_path;
        }
        command_queue.push(cmd);
    }
};

bootstrap.prototype = {
    go:function(callback) {
        go(command_queue, this.test_builder, callback);
    }
};

module.exports = bootstrap;

if(require.main === module) {
    new bootstrap().go();
}
