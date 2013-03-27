var shell        = require('shelljs'),
    path         = require('path');

var package_id = "com.phonegap.hydratest";

module.exports = function(platform) {
    return function(output, sha, devices, entry_point, callback) {

        function log(msg) {
            console.log('[' + platform + '] ' + msg + ' (stamp: ' + sha + ')');
        }

        // compile
        log('Compiling for ' + platform + '...');

        var pgb = require('./api');
        var output_dir = path.join(output, '..');
        var zip_path = path.join(output_dir, 'www.zip');
        var cmd = 'cd ' + output + ' && zip -r ' + zip_path + ' ./*';

        shell.exec(cmd, {silent:true, async:true}, function(code, checkout_output) {

            pgb.oncomplete = function(error, id, pf, binpath) {

                if (error) {
                    console.log('[PGB] Buid failed (' + error + ')');
                    callback(error);
                    return;
                }

                var platform_scanner = require('../../platforms/' + pf + '/devices');

                console.log('[PGB][BUILD] Scanning for ' + pf + ' devices')
                platform_scanner(function(err, devices) {
                    if (err) console.log('[BUILD] Error scanning for ' + pf + ' devices: ' + devices);
                    else {
                        var deploy = require('../../platforms/' + pf + '/deploy')
                        deploy(sha, devices, binpath, package_id, callback);
                    }
                });

            }

            pgb.auth(function() {
                pgb.build(platform, package_id, zip_path, output_dir);
            });
        });

    }
}
