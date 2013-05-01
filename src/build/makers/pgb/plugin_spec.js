var shell     = require('shelljs'),
    path      = require('path'),
    config    = require('../../../../config'),
    fs        = require('fs'),
    et        = require('elementtree');

var jasmineReporter = path.join(__dirname, 'app_files', 'jasmine-jsreporter.js');

module.exports = function(output_location, sha, name, entry_point, app_git, callback) {

    console.log('[PGB] Preparing plugin spec: ' + name);

    shell.rm('-Rf', output_location);
    shell.mkdir('-p', output_location);
    var tempStart = path.join(output_location, 'index.html');
    var libDir = path.join(__dirname, '..', '..', '..', '..', 'lib');
    var lib = name;


    // Have the lib, update it.
    var cmd = 'cd ' + path.join(libDir, lib) + ' && git checkout -- . ';
    // checkout correct sha
    /*
    if (sha)
        cmd += ' && git checkout ' + sha;
    */

    shell.exec(cmd, {silent:true, async:true}, function(code, output) {
        if (code > 0) {
            console.error('[ERROR] [BUILDER] [TEST APP] Error during git-checkout of test app SHA! command executed was: ' + cmd + ', output: ' + output);
            callback(true);
        } else {
            // copy relevant bits of spec project to output_location location
            shell.cp('-Rf', [path.join(libDir, lib, 'spec', '*'), path.join(libDir, lib, 'www', '*')], output_location);

            // copy jasmine reporter into output_location location
            shell.cp('-Rf', jasmineReporter, output_location);
            
            // drop sha to the top of the jasmine reporter
            var tempJasmine = path.join(output_location, 'jasmine-jsreporter.js');
            var jsString = "var library_sha = '" + sha + "'; \n    var db_name = '" + name.toLowerCase() + "_spec_results';\n";
            fs.writeFileSync(tempJasmine, jsString + fs.readFileSync(tempJasmine, 'utf-8'), 'utf-8');

            // replace app id
            var config_path = path.join(output_location, 'config.xml');
            var doc = new et.ElementTree(et.XML(fs.readFileSync(config_path, 'utf-8')));
            doc.getroot().attrib.id = "org.apache.cordova.example";
            fs.writeFileSync(config_path, doc.write({indent:4}), 'utf-8');

            // replace a few lines in the start page
            fs.writeFileSync(tempStart, fs.readFileSync(tempStart, 'utf-8').replace(/<script type=.text.javascript. src=.html.TrivialReporter\.js.><.script>/, '<script type="text/javascript" src="html/TrivialReporter.js"></script><script type="text/javascript" src="jasmine-jsreporter.js"></script>'), 'utf-8');
            fs.writeFileSync(tempStart, fs.readFileSync(tempStart, 'utf-8').replace(/jasmine.HtmlReporter.../, 'jasmine.HtmlReporter(); var jr = new jasmine.JSReporter("' + config.couchdb.host + '");'), 'utf-8');
            fs.writeFileSync(tempStart, fs.readFileSync(tempStart, 'utf-8').replace(/addReporter.htmlReporter../, 'addReporter(htmlReporter);jasmineEnv.addReporter(jr);'), 'utf-8');
            callback();
        }
    });
}
