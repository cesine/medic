var n 	      = require('ncallbacks'),
    couch     = require('../../../couchdb/interface');

var platforms = ['ios', 'android', 'blackberry'];

module.exports = function(callback, config) {

    // TODO: more elaborate hook than just an interval
    function runAll() {

        config.specs.forEach(function(spec) {
            platforms.forEach(function(platform) {
                check_n_queue(spec, platform, callback);
            });
        });

    }

    runAll();
    
    setInterval(runAll, 300000);

};

function check_n_queue(spec, platform, callback) {
	var repo = 'cordova-' + platform;
    // scan for devices for said platform
    var platform_scanner = require('../../platforms/' + platform + '/devices');

    platform_scanner(function(err, devices) {
        if (err) console.log('[BUILD] Error scanning for ' + platform + ' devices: ' + devices);
        else {
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
        }
    });
};