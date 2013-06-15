var shell     = require('shelljs'),
    path      = require('path'),
    config    = require('../../config'),
    fs        = require('fs'),
    et        = require('elementtree');

var jasmineReporter = path.join(__dirname, 'app_files', 'jasmine-jsreporter.js');

module.exports = function(output_location, sha, name, entry_point, app_git, gap_version, callback) {

    console.log('[PGB] Preparing plugin spec: ' + name + ' @ ' + gap_version);

    shell.rm('-Rf', output_location);
    shell.mkdir('-p', output_location);
    var tempStart = path.join(output_location, 'index.html');
    var libDir = path.join(__dirname, '..', '..', 'lib');
    var lib = name;

    // copy relevant bits of spec project to output_location location
    shell.cp('-Rf', path.join(libDir, lib, 'spec', '*'), output_location);

    // copy jasmine reporter into output_location location
    shell.cp('-Rf', jasmineReporter, output_location);
    
    // drop sha to the top of the jasmine reporter
    var tempJasmine = path.join(output_location, 'jasmine-jsreporter.js');
    var jsString = "var library_sha = '" + sha + "'; \n    var spec_name = '" + name + "';\n";
    fs.writeFileSync(tempJasmine, jsString + fs.readFileSync(tempJasmine, 'utf-8'), 'utf-8');

    var config_path = path.join(output_location, 'config.xml');

    // if the spec doesn't have a config.xml, put one in
    var doc;
    if (!fs.existsSync(config_path)) {
        var default_config = path.join(__dirname, 'app_files', 'config.xml');
        shell.cp('-f', default_config, output_location);

        // add the plugin
        doc = new et.ElementTree(et.XML(fs.readFileSync(config_path, 'utf-8')));
        doc.getroot().find("gap:plugin").attrib.name = name;
        fs.writeFileSync(config_path, doc.write({indent:4}), 'utf-8');
    }

    // set the app id
    doc = new et.ElementTree(et.XML(fs.readFileSync(config_path, 'utf-8')));
    doc.getroot().attrib.id = "org.apache.cordova.example";
    // set the phonegap version
    if (gap_version) {
        doc.getroot().find("gap:preference[@name='phonegap-version']").attrib.value = gap_version;
    }
    fs.writeFileSync(config_path, doc.write({indent:4}), 'utf-8');

    // replace a few lines in the start page
    fs.writeFileSync(tempStart, fs.readFileSync(tempStart, 'utf-8').replace(/<script type=.text.javascript. src=.html.TrivialReporter\.js.><.script>/, '<script type="text/javascript" src="html/TrivialReporter.js"></script><script type="text/javascript" src="jasmine-jsreporter.js"></script>'), 'utf-8');
    fs.writeFileSync(tempStart, fs.readFileSync(tempStart, 'utf-8').replace(/jasmine.HtmlReporter.../, 'jasmine.HtmlReporter(); var jr = new jasmine.JSReporter("' + config.couchdb.host + '");'), 'utf-8');
    fs.writeFileSync(tempStart, fs.readFileSync(tempStart, 'utf-8').replace(/addReporter.htmlReporter../, 'addReporter(htmlReporter);jasmineEnv.addReporter(jr);'), 'utf-8');
    callback();
}
