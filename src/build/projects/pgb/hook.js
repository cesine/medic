var n 	      = require('ncallbacks'),
    couch     = require('../../../couchdb/interface');

var platforms = ['ios', 'android', 'blackberry'];

module.exports = function(callback) {

    for (var i in platforms) {
        check_n_queue(platforms[i], callback);
    }

    setInterval(function() {

        for (var i in platforms) {
            check_n_queue(platforms[i], callback);
        }

    }, 120000);

};

function check_n_queue(platform, callback) {
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
                    devices:{}
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