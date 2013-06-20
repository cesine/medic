var path             = require('path'),
    fs               = require('fs'),
    pgbuild          = require('./pgbuild'),
    shell            = require('shelljs'),
    error_writer     = require('../error_writer');

var builders = {
    'android':pgbuild('android'),
    'ios':pgbuild('ios'),
    'blackberry':pgbuild('blackberry')
};
var tempDir = path.join(__dirname, '..', '..', 'temp');

function build_the_queue(q, callback) {
    var job = q.shift();
    if (job) {
        job.builder(job, function(err) {
            if (err) {
                error_writer(job.library, job.sha, 'PGB Build Failure', err.toString().trim());
                console.error('[BUILDER] Previous build failed, continuing.');
            }
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
                sha: stamp,
                host: commits[lib].host,
                info: commits[lib].info
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
        var platform =  (function() {for (var lib in commits) if (commits.hasOwnProperty(lib)) return lib })();
        var gap_version = commits[platform].gap_version;
        var info = commits[platform].info;

        var output_dir = path.join(tempDir, platform, 'test');
        shell.rm('-rf', output_dir);
        shell.mkdir('-p', output_dir);

        spec_builder(output_dir, stamp, app_builder, info, app_entry_point, app_git, gap_version, function(err) {
            if (err) {
                callback('Aborting, could not build test app (' + err + ')');
                return;
            } else {
                console.log('[PGB] Test app prepared.');
                createJob(commits, app_entry_point, stamp, callback);
            }
        });
    }
};
