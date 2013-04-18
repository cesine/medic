var shell     = require('shelljs'),
    path      = require('path'),
    config    = require('../../../../config'),
    fs        = require('fs');

var jasmineReporter = path.join(__dirname, 'app_files', 'jasmine-jsreporter.js');

module.exports = function(output_location, sha, name, entry_point, app_git, callback) {

    console.log('[PGB] Preparing plugin spec: ' + name);

    shell.rm('-Rf', output_location);
    shell.mkdir('-p', output_location);
    var tempStart = path.join(output_location, 'index.html');
    var libDir = path.join(__dirname, '..', '..', '..', '..', 'lib');
    var lib = name;

    var contents = [];
    if (fs.existsSync(libDir))
        contents = fs.readdirSync(libDir);

    var cmd = null;
    if (contents.indexOf(lib) == -1) {
        // Don't have the lib, get it.
        cmd = 'git clone ' + app_git + ' ' + path.join(libDir, lib) + ' && cd ' + path.join(libDir, lib) + ' && git fetch && git checkout specs';
    } else {
        // Have the lib, update it.
        cmd = 'cd ' + path.join(libDir, lib) + ' && git checkout -- . && git pull origin specs';
    }

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
            // copy relevant bits of mobile-spec project to output_location location
            shell.cp('-Rf', [path.join(libDir, lib, 'spec', '*'), path.join(libDir, lib, 'www', '*')], output_location);

            // copy jasmine reporter into output_location location
            shell.cp('-Rf', jasmineReporter, output_location);
            
            // drop sha to the top of the jasmine reporter
            var tempJasmine = path.join(output_location, 'jasmine-jsreporter.js');
            fs.writeFileSync(tempJasmine, "var library_sha = '" + sha + "';\n" + fs.readFileSync(tempJasmine, 'utf-8'), 'utf-8');

            // replace a few lines under the "all" tests autopage
            fs.writeFileSync(tempStart, fs.readFileSync(tempStart, 'utf-8').replace(/<script type=.text.javascript. src=.html.TrivialReporter\.js.><.script>/, '<script type="text/javascript" src="html/TrivialReporter.js"></script><script type="text/javascript" src="jasmine-jsreporter.js"></script>'), 'utf-8');
            fs.writeFileSync(tempStart, fs.readFileSync(tempStart, 'utf-8').replace(/jasmine.HtmlReporter.../, 'jasmine.HtmlReporter(); var jr = new jasmine.JSReporter("' + config.couchdb.host + '");'), 'utf-8');
            fs.writeFileSync(tempStart, fs.readFileSync(tempStart, 'utf-8').replace(/addReporter.htmlReporter../, 'addReporter(htmlReporter);jasmineEnv.addReporter(jr);'), 'utf-8');
            callback();
        }
    });
}
