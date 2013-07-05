var path             = require('path'),
    fs               = require('fs'),
    pgbuild          = require('./pgbuild'),
    shell            = require('shelljs'),
    error_writer     = require('../error_writer'),
    config           = require('../../config'),
    aws              = require('aws-sdk');

var builders = {
    'android':pgbuild('android'),
    'ios':pgbuild('ios'),
    'blackberry':pgbuild('blackberry')
};
var tempDir = path.join(__dirname, '..', '..', 'temp');

function build_the_queue(q, callback) {
    var job = q.shift();
    if (job) {
        job.builder(job, function(err) {
            if (err) {
                error_writer(job, err.toString().trim());
                console.error('[BUILDER] Previous build failed, continuing.');
            }
            build_the_queue(q, callback);
        });
    } else callback();
}

function createJob(job, app_entry_point, callback) {
    var miniq = [];
    var lib = job.platform;

    job.builder = builders[lib];
    job.output_location = tempDir;
    job.entry = app_entry_point;

    miniq.push(job);

    build_the_queue(miniq, callback);
}

module.exports = function(app_builder, app_entry_point, static, app_git) {

    return function builder(job, callback) {

        shell.rm('-rf', path.join(tempDir, job.platform));
        shell.mkdir('-p', path.join(tempDir, job.platform));

        getSpec(job.spec, path.join(tempDir, job.platform), function() {

            var stamp = job.timestamp || (new Date()).toJSON().substring(0,19).replace(/:/g, "-");

            // if there's a custom spec builder (see mobile_spec) use it. otherwise we'll assume its a plugin
            try {
                spec_builder = require('./' + app_builder);
            } catch (ex) {
                spec_builder = require('./plugin_spec');
            }

            // get the platform from the commits object
            var platform =  job.platform;
            var gap_version = job.gap_version;
            var info = job.info;

            var output_dir = path.join(tempDir, platform, 'test');
            shell.rm('-rf', output_dir);
            shell.mkdir('-p', output_dir);

            spec_builder(output_dir, stamp, app_builder, info, app_entry_point, app_git, gap_version, function(err) {
                if (err) {
                    callback('Aborting, could not build test app (' + err + ')');
                    return;
                } else {
                    console.log('[PGB] Test app prepared.');
                    createJob(job, app_entry_point, callback);
                }
            });

        });
    }
};

function getSpec(spec, dest, cb) {
    console.log('.');
    shell.rm('-rf', path.join(dest, spec.name));
    if (spec.git) {
        cloneSpec(spec, dest);
        cb([]);
    } else if (spec.zip) {
        if (spec.zip.match(/s3.amazonaws.com/)) {
            unzipFromS3(spec, dest, cb);
        } else {
            unzipFromURL(spec, dest, cb);
        }
    }
}


function cloneSpec(spec, dest) {

    var contents = [];
    if (fs.existsSync(dest))
        contents = fs.readdirSync(dest);

    var cmd = null;
    if (contents.indexOf(spec.name) == -1) {
        // Don't have the lib, get it.
        cmd = 'git clone ' + spec.git + ' ' + path.join(dest, spec.name) + ' && cd ' + path.join(dest, spec.name) + ' && git fetch';
    } else {
        // Have the lib, update it.
        cmd = 'cd ' + path.join(dest, spec.name) + ' && git checkout -- . && git pull origin master';
    }

    shell.exec(cmd, {silent:true, async:false});
}

function unzipFromS3(spec, dest, cb) {
    console.log('[INIT] Downloading from s3');

    aws.config.accessKeyId = config.accessKeyId;
    aws.config.secretAccessKey = config.secretAccessKey;
    aws.config.region = 'us-east-1';

    var r = spec.zip.match(/(?:\/\/s3\.amazonaws.com\/(.*)\/([^\/]+))/);
    var bucket = r[1];
    var id = r[2];

    var zip_file = path.join(dest, spec.name + '.zip');
    shell.mkdir('-p', dest);
    var file = fs.createWriteStream(zip_file);

    var s3 = new aws.S3();
    var params = {
        "Bucket": bucket,
        "Key": id
    };

    // Might need to retry, see
    // http://docs.aws.amazon.com/AWSJavaScriptSDK/guide/makingrequests.html#Limitations_of_Streaming
    s3.getObject(params).
    on('httpData', function(chunk) { 
        file.write(chunk); 
    }).on('httpDone', function() { 
        file.end(); 
        unzip(zip_file, dest, spec.name);
        cb([]);
    }).send();

}

function unzipFromURL(spec, dest, cb) {
    console.log('[INIT] Downloading ' + spec.zip);
    
    var zip_file = path.join(dest, spec.name + '.zip');
    shell.mkdir('-p', dest);

    var r = request(spec.zip).pipe(fs.createWriteStream(zip_file));
    r.on('close', function() {
        unzip(zip_file, dest, spec.name);
        cb([]);
    });

}

function unzip(file, dest, dirName) {
        console.log('[INIT] unzipping.')
        var cmd = 'cd ' + dest + ' && mkdir ' + dirName + ' && unzip ' + file + ' -d ' + dirName;
        var result = shell.exec(cmd, {silent:true, async:false});

        if (result.code != 0) {
            console.log("[UNZIP] [ERROR] " + result.output.substring(0, 200));
        } else {
            shell.rm(file);
        }
}