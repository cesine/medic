var shell        = require('shelljs'),
    path         = require('path'),
    n            = require('ncallbacks'),
    error_writer = require('../../platforms/error_writer'),
    libraries    = require('../../../../libraries'),
    fs           = require('fs');

module.exports = function(output, sha, devices, entry_point, callback) {
    var platform = "android";
    var scan            = require('../../platforms/' + platform + '/devices'),
        deploy          = require('../../platforms/' + platform + '/deploy');

    function log(msg) {
        console.log('[' + platform + '] ' + msg + ' (sha: ' + sha.substr(0,7) + ')');
    }

    shell.rm('-rf', output);

    // create an app into output dir
    log('Creating project. ' + output);
    try {

        // make output dir
        fs.mkdirSync(output);
        // copy over mobile spec modified html assets
        shell.cp('-Rf', path.join(libraries.output.test, '*'), output);

        fs.writeFileSync(path.join(output, 'index.html'), '<html><body onload="window.location.href=\'autotest/pages/all.html\'"></body><html>');

        // add the sha to the junit reporter
        var tempJasmine = path.join(output, 'jasmine-jsreporter.js');
        if (fs.existsSync(tempJasmine)) {
            fs.writeFileSync(tempJasmine, "var library_sha = '" + sha + "';\n" + fs.readFileSync(tempJasmine, 'utf-8'), 'utf-8');
        }

    } catch (e) {
        error_writer(platform, sha, 'Exception thrown modifying mobile spec application.', e.message);
        callback(true);
        return;
    }


    // compile
    log('Compiling...');

    var pgb = require('./api');
    var zip_path = path.join(output, '..', 'www.zip');
    var cmd = 'cd ' + output + ' && zip -r ' + zip_path + ' ./*';

    shell.exec(cmd, {silent:true, async:true}, function(code, checkout_output) {

        pgb.oncomplete = function(id, platform, binpath) {

            var platform_scanner = require('../../platforms/' + platform + '/devices');
            //var platform_builder = require('../../platforms/' + platform);
            platform_scanner(function(err, devices) {
                if (err) console.log('[BUILD] Error scanning for ' + platform + ' devices: ' + devices);
                else {
                    var sha = "";
                    var package = 'com.nitobi.mobspec';
                    deploy(sha, devices, binpath, package, callback);
                }
            });

        }

        pgb.auth(function() {
            pgb.build(zip_path, output);
        });
    });

}
