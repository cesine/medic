var path             = require('path'),
    fs               = require('fs'),
    pgbuild          = require('./pgbuild'),
    shell            = require('shelljs');

var builders = {
    'cordova-android':pgbuild('android'),
    'cordova-ios':pgbuild('ios'),
    'cordova-blackberry':pgbuild('blackberry')
};
var tempDir = path.join(__dirname, '..', '..', '..', '..', 'temp');

function build_the_queue(q, callback) {
    var job = q.shift();
    if (job) {
        job.builder(job.output_location, job.sha, job.devices, job.entry, function(err) {
            if (err) console.error('[BUILDER] Previous build failed, continuing.');
            build_the_queue(q, callback);
        });
    } else callback();
}

function createJob(commits, app_entry_point, stamp, callback) {
    var miniq = []; 
    for (var lib in commits) if (commits.hasOwnProperty(lib)) {
        if (builders.hasOwnProperty(lib)) {
            var job = {
                library:lib,
                builder:builders[lib],
                output_location:tempDir,
                entry:app_entry_point,
                sha: stamp
            };

            // Some jobs might be for all devices, or specific devices
            if (typeof commits[lib] == 'object') {
                job.devices = commits[lib].devices;
            }
            miniq.push(job);
        }
    }
    build_the_queue(miniq, callback);
}

module.exports = function(app_builder, app_entry_point, static, app_git) {

    return function builder(commits, callback) {
        // commits format:
        // { cordova-android:'sha'}
        // OR
        // { cordova-android:{
        //     sha:'sha',
        //     devices:[]
        //   }
        // }

        var stamp = (new Date()).toJSON().substring(0,19).replace(/:/g, "-");
        try {
            spec_builder = require('./' + app_builder);
        } catch (ex) {
            spec_builder = require('./plugin_spec');
        }

        // get the platform from the commits object
        var platform =  (function() {for (var lib in commits) if (commits.hasOwnProperty(lib)) return lib.split("-")[1] })();

        var output_dir = path.join(tempDir, platform, 'test');
        shell.rm('-rf', output_dir);
        shell.mkdir('-p', output_dir);

        spec_builder(output_dir, stamp, app_builder, app_entry_point, app_git, function(err) {
            if (err) {
                throw new Error('Could not build Test App! Aborting!');
            }
            console.log('[PGB] Test app prepared.');
            createJob(commits, app_entry_point, stamp, callback);
        });
    }
};
