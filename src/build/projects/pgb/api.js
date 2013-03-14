var	client 	= require('phonegap-build-api'),
	fs 		= require('fs'),
    path 	= require('path'),
    config  = require('../../../../config');

var PGB = {
    api: null,
    timer: null,
    output_path: null,
    oncomplete: null,

    log: function(s) {
        console.log('[PGB] ' + s);
    },

    auth: function(cb) {
        client.auth({ username: config.pgb.username, password: config.pgb.password }, function(e, api) {
            if (e) {
                PGB.log(e);
            } else {
                PGB.api = api;
                cb();
            }
        });
    },

    build: function(platform, zip_path, output_path) {
        var options = {
            form: {
                data: {
                    title: 'cordovaExample',
                    create_method: 'file',
                    package: 'com.nitobi.mobspec',
                    keys: ( platform == 'ios' ? { ios: 42105 } : null )
                },
                file: zip_path
            }
        };
        PGB.output_path = output_path;

        PGB.api.post('/apps', options, function(e, data) {
            if (e) {
                PGB.log(e);
            } else {
                PGB.log('App ' + data.id + ' created.');
                PGB.log('Waiting for ' + platform + ' build...');
                PGB.poll(data.id, platform);
            }
        });
    },

    poll: function(id, platform) {
        PGB.checkStatus(id, function(e, data) {
            if (data.status[platform] == 'pending') {
                setTimeout(function() {
                    PGB.poll(id, platform);
                }, 2000);
            } else if (data.status[platform] == 'complete' ) {
                PGB.log(platform + ' build complete.');
                PGB.download(id, platform);
            } else {
                console.log(data);
                console.log(data.error)
                PGB.log(data.error[platform]);
            }
        });
    },

    checkStatus: function(id, cb) {
        PGB.api.get('/apps/' + id, cb);
    },

    download: function(id, platform) {
        PGB.log('Downloading for ' + platform + '...');
        var binpath = path.join(PGB.output_path, 'app-' + id + '.' + PGB.extension(platform));

        var r = PGB.api.get('/apps/' + id + '/' + platform).pipe(fs.createWriteStream(binpath));
        r.on('close', function() {
            PGB.log('Download stream closed.');

            PGB.api.del('/apps/' + id, function(e, data) {
                if (e) {
                    PGB.log(e);
                } else {
                    PGB.log('App deleted from Build.');
                    PGB.oncomplete(id, platform, binpath);
                }
            });
        });
    },

    extension: function(platform) {
        if (platform == 'android') {
            return 'apk';
        } else if (platform == 'ios') {
            return 'ipa';
        } else if (platform == 'blackberry') {
            return 'jad';
        }
    }
};

module.exports = PGB;