
var request = require('request'),
    path    = require('path'),
    shell   = require('shelljs'),
    fs      = require('fs')
    libDir  = path.join(__dirname, '..', '..', '..', '..', 'lib');

// Runs some initializations like retrieving the specs list
module.exports = function(config, callback) {
    request.get({ url:config.specs_url, json:true }, function(e, r, data) {
        
        if (e) {
            console.log('[PGB] Could not retrieve specs.json');
        } else {
            Object.keys(data.specs).forEach(function(name) {
                var spec = data.specs[name];
                config.specs.push({
                    name: name,
                    git: spec.repo
                });
            });
        }

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
		        cmd = 'cd ' + path.join(libDir, spec.name) + ' && git checkout -- . ';
		    }

        	shell.exec(cmd, {silent:true, async:false});
        });


        callback([]);
    });
};