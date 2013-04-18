var shell        = require('shelljs'),
    path         = require('path');

var package_id = "org.apache.cordova.example";


module.exports = function(platform) {
    return function(output, sha, devices, entry_point, callback) {

        function log(msg) {
            console.log('[' + platform + '] ' + msg + ' (stamp: ' + sha + ')');
        }

        // compile
        log('Compiling for ' + platform + ' on PhoneGap Build...');

        var pgb = require('./api');

        var zip_path = path.join(output, platform, 'www.zip');
        var cmd = 'cd ' + path.join(output, platform, 'test') + ' && zip -r ' + zip_path + ' ./*';

        shell.exec(cmd, {silent:true, async:true}, function(code, checkout_output) {

            pgb.auth(function() {
                pgb.build(platform, package_id, zip_path, path.join(output, platform), function(error, id, pf, binpath) {

                    var output_dir = path.join(output, pf);

                    if (error) {
                        console.log('[PGB] Build failed (' + error + ')');
                        callback(error);
                        return;
                    }

                    if (pf == "ios") {
                        var cmd = 'cd ' + output_dir + ' && unzip ' + binpath;

                        shell.exec(cmd, {silent:true, async:false});
                        shell.cp('-Rf', path.join(output_dir, 'Payload', 'cordovaExample.app'), output_dir);

                        binpath = path.join(output_dir, 'cordovaExample.app');
                        shell.rm('-rf', path.join(output_dir, 'Payload'));

                        var entitlements_plist = path.join(__dirname, 'app_files', 'Entitlements.plist');
                        var codesign = "codesign -f -s \"iPhone Developer\" --entitlements " + entitlements_plist + " " + binpath;
                        
                        console.log('[PGB] Re-signing iOS app bundle');
                        shell.exec(codesign, {silent:true, async:false});
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

                });
            });
        });

    }
}
