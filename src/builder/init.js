
var request = require('request'),
    path    = require('path'),
    shell   = require('shelljs'),
    fs      = require('fs'),
    argv    = require('optimist').argv,
    libDir  = path.join(__dirname, '..', '..', 'lib');

// Runs some initializations like retrieving the specs list
module.exports = function(config, callback) {
    if (argv.spec) {
        var name = argv.name || argv.spec.match(/.*\/([^/]+)\.[^\.]+$/)[1];
        var gap_versions = argv.gap_versions || "2.3.0,2.5.0,2.7.0";

        config.specs.push({
            name: name,
            git: argv.spec,
            gap_versions: gap_versions
        });

        cloneSpecs(config);
        callback([]);
    } else {
        console.log('[BUILD] Getting specs from ' + config.specs_url);

        request.get({ url:config.specs_url, json:true }, function(e, r, data) {

            if (e) {
                console.log('[PGB] Could not retrieve specs.json');
            } else {
                try {
                    Object.keys(data.specs).forEach(function(name) {
                        var spec = data.specs[name];
                        config.specs.push({
                            name: name,
                            git: spec.repo,
                            gap_versions: spec.gap_versions
                        });
                    });
                } catch (ex) {
                    console.log('[PGB] Could not parse specs.json (' + ex.message + ')');
                }
            }

            cloneSpecs(config);

            callback([]);
        });
    }
};

function cloneSpecs(config) {
    console.log('[PGB] ' + config.specs.length + ' specs found - cloning ...');

    config.specs.forEach(function(spec) {

        var contents = [];
        if (fs.existsSync(libDir))
            contents = fs.readdirSync(libDir);

        var cmd = null;
        if (contents.indexOf(spec.name) == -1) {
            // Don't have the lib, get it.
            cmd = 'git clone ' + spec.git + ' ' + path.join(libDir, spec.name) + ' && cd ' + path.join(libDir, spec.name) + ' && git fetch';
        } else {
            // Have the lib, update it.
            cmd = 'cd ' + path.join(libDir, spec.name) + ' && git checkout -- . && git pull';
        }

        shell.exec(cmd, {silent:false, async:false});
    });
}