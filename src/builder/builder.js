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

function createJob(job, app_entry_point, stamp, callback) {
    var miniq = [];
    var lib = job.platform;
    var job = {
        library:lib,
        builder:builders[lib],
        output_location:tempDir,
        entry:app_entry_point,
        sha: stamp,
        host: job.host,
        info: job.info
    };

    miniq.push(job);

    build_the_queue(miniq, callback);
}

module.exports = function(app_builder, app_entry_point, static, app_git) {

    return function builder(job, callback) {

        var stamp = (new Date()).toJSON().substring(0,19).replace(/:/g, "-");
        try {
            spec_builder = require('./' + app_builder);
        } catch (ex) {
            spec_builder = require('./plugin_spec');
        }

        // get the platform from the commits object
        var platform =  job.platform;
        var gap_version = job.gap_version;
        var info = job.info;

        var output_dir = path.join(tempDir, platform, 'test');
        shell.rm('-rf', output_dir);
        shell.mkdir('-p', output_dir);

        spec_builder(output_dir, stamp, app_builder, info, app_entry_point, app_git, gap_version, function(err) {
            if (err) {
                callback('Aborting, could not build test app (' + err + ')');
                return;
            } else {
                console.log('[PGB] Test app prepared.');
                createJob(job, app_entry_point, stamp, callback);
            }
        });
    }
};
