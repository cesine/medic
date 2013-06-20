var n 	      = require('ncallbacks'),
    argv      = require('optimist').argv,
    couch     = require('../couchdb'),
    request   = require('request');;

var platforms = argv.p || argv.platforms || ['ios', 'android', 'blackberry'];
if (typeof platforms == 'string') {
    platforms = platforms.split(",");
}

module.exports = function(callback, specs) {

    console.log('[RUNNER] parsing jobs...')
    function runAll() {

        platforms.forEach(function(platform) {
            scan(specs, platform, callback)
        });

    }

    runAll();
    
    if (argv.monitor) setInterval(runAll, 2*60*60*1000); //bi-hourly

};

function scan(specs, platform, callback) {

    var platform_scanner = require('../platforms/' + platform + '/devices');
    platform_scanner(function(err, devices) {
        var numDs = 0;
        for (var d in devices) if (devices.hasOwnProperty(d)) numDs++;
        console.log('[BUILD] ' + numDs + ' ' + platform + ' devices found');

        if (err) console.log('[BUILD] Error scanning for ' + platform + ' devices: ' + devices);
        else {
            specs.forEach(function(spec) {

                var versions = [ null ];
                if (spec.gap_versions) {
                    versions = spec.gap_versions.split(",");
                }
                versions.forEach(function(gap_version) {
                    check_n_queue(spec, platform, callback, devices, gap_version);
                });
            });
        }
    });
}

function check_n_queue(spec, platform, callback, devices, gap_version) {
    var numDs = 0;

    for (var d in devices) if (devices.hasOwnProperty(d)) numDs++;
    if (numDs > 0) {
        console.log('creating job in runner');
        var job = {};
        var targets = 0;
        job = {
            platform: platform,
            numDevices:0,
            devices:{},
            spec: spec,
            gap_version: gap_version,
            host: spec.host || null,
            info: spec.info || null
        };

        var end = n(numDs, function() {
            if (targets > 0) {
                job.numDevices = targets;
                callback(job);
            }
        });

        for (var d in devices) if (devices.hasOwnProperty(d)) (function(id) {
            var device = devices[id];
            var version = device.version;
            var model = device.model;

            targets++;
            job.devices[id] = {
                version:version,
                model:model
            }; 
            end();
        }(d));
    }
};