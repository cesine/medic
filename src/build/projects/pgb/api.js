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

    build: function(zip_path, output_path) {
        var options = {
            form: {
                data: {
                    title: 'cordovaExample',
                    create_method: 'file',
                    package: 'com.nitobi.mobspec'
                    //keys: { ios: { id: 20088, password: "" }}
                },
                file: zip_path
            }
        };
        PGB.output_path = output_path;

        PGB.api.post('/apps', options, function(e, data) {
            if (e) {
                PGB.log(e);
                PGB.oncomplete(e);
            } else {
                PGB.log('App created.');
                PGB.log('Waiting for build...');
                PGB.poll(data.id);
            }
        });
    },

    poll: function(id) {
        PGB.checkStatus(id, function(e, data) {
            if (data.status.android == 'pending') {
                setTimeout(function() {
                    PGB.poll(id);
                }, 2000);
            } else if (data.status.android == 'complete' ) {
                PGB.log('Build complete.');
                PGB.download(id, 'android');
            } else {
                PGB.log(data.status.android);
            }
        });
    },

    checkStatus: function(id, cb) {
        PGB.api.get('/apps/' + id, cb);
    },

    download: function(id, platform) {
        PGB.log('Downloading...');
        var binpath = path.join(PGB.output_path, 'app-' + id + '.apk');

        var r = PGB.api.get('/apps/' + id + '/' + platform).pipe(fs.createWriteStream(binpath));
        r.on('close', function() {
            PGB.log('Download stream closed.');

            PGB.api.del('/apps/' + id, function(e, data) {
                if (e) {
                    PGB.log(e);
                } else {
                    PGB.log('App deleted from Build.');
                    PGB.oncomplete(id, 'android', binpath);
                }
            });
        });

    }
};

module.exports = PGB;