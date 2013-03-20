var shell        = require('shelljs'),
    path         = require('path'),
    n            = require('ncallbacks'),
    error_writer = require('../../platforms/error_writer'),
    fs           = require('fs');

module.exports = function(platform) {
    return function(output, sha, devices, entry_point, callback) {
        var scan            = require('../../platforms/' + platform + '/devices'),
            deploy          = require('../../platforms/' + platform + '/deploy');

        function log(msg) {
            console.log('[' + platform + '] ' + msg + ' (sha: ' + sha.substr(0,7) + ')');
        }

        // create an app into output dir
        log('Modifying app in ' + output);
        try {
            if (entry_point) {
                fs.writeFileSync(path.join(output, 'index.html'), '<html><body onload="window.location.href=\'' + entry_point + '\'"></body><html>');
            }

            // add the sha to the junit reporter
            var tempJasmine = path.join(output, 'jasmine-jsreporter.js');
            if (fs.existsSync(tempJasmine)) {
                fs.writeFileSync(tempJasmine, "var library_sha = '" + sha + "';\n" + fs.readFileSync(tempJasmine, 'utf-8'), 'utf-8');
            }

        } catch (e) {
            error_writer(platform, sha, 'Exception thrown modifying test application.', e.message);
            callback(true);
            return;
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
                        var sha = "";
                        var package = 'com.nitobi.mobspec';
                        deploy(sha, devices, binpath, package, callback);
                    }
                });

            }

            pgb.auth(function() {
                pgb.build(platform, zip_path, output_dir);
            });
        });

    }
}
