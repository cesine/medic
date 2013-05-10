var n 	      = require('ncallbacks'),
    argv      = require('optimist').argv,
    couch     = require('../../../couchdb/interface'),
    request   = require('request');;

var platforms = argv.p || argv.platforms || ['ios', 'android', 'blackberry'];
if (typeof platforms == 'string') {
    platforms = platforms.split(",");
}

module.exports = function(callback, config) {

    // TODO: more elaborate hook than just an interval
    function runAll() {

        platforms.forEach(function(platform) {
            scan(config, platform, callback)
        });

    }

    runAll();
    
    if (argv.monitor) setInterval(runAll, 2*60*60*1000); //bi-hourly

};

function scan(config, platform, callback) {

    var platform_scanner = require('../../platforms/' + platform + '/devices');
    platform_scanner(function(err, devices) {
        var numDs = 0;
        for (var d in devices) if (devices.hasOwnProperty(d)) numDs++;
        console.log('[BUILD] ' + numDs + ' ' + platform + ' devices found');

        if (err) console.log('[BUILD] Error scanning for ' + platform + ' devices: ' + devices);
        else {
            config.specs.forEach(function(spec) {
                check_n_queue(spec, platform, callback, devices);
            });
        }
    });
}

function check_n_queue(spec, platform, callback, devices) {
	var repo = 'cordova-' + platform;
    var numDs = 0;

    for (var d in devices) if (devices.hasOwnProperty(d)) numDs++;
    if (numDs > 0) {
    	var commit = 'HEAD';
        var job = {};
        var targets = 0;
        job[repo] = {
            sha:commit,
            numDevices:0,
            devices:{},
            spec: spec
        };

        var end = n(numDs, function() {
            if (targets > 0) {
                job[repo].numDevices = targets;
                callback(job);
            }
        });

        for (var d in devices) if (devices.hasOwnProperty(d)) (function(id) {
            var device = devices[id];
            var version = device.version;
            var model = device.model;

            targets++;
            job[repo].devices[id] = {
                version:version,
                model:model
            }; 
            end();
        }(d));
    }
};