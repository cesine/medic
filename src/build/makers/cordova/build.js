#!/usr/bin/env node
var path          = require('path'),
    shell         = require('shelljs'),
    apache_parser = require('./apache-gitpubsub-parser'),
    request       = require('request'),
    couch         = require('../../../couchdb/interface'),
    libraries     = require('./libraries'),
    config        = require('../../../../config'),
    n             = require('ncallbacks'),
    bootstrap     = require('./bootstrap'),
    argv          = require('optimist').argv,
    updater       = require('../../updater');

function log(err) {
    if (err) {
        console.error(err);
        process.exit(1);
    } else {
        console.log('Usage:');
        process.exit(0);
    }
}

// should we even bother building certain platforms
var should_build = {
    'cordova-blackberry':(config.blackberry.devices.ips && config.blackberry.devices.ips.length > 0),
    'cordova-ios':(config.ios.keychainLocation && config.ios.keychainLocation.length > 0),
    'cordova-android':true
};

// --entry, -e: entry point into the app. index.html as default.
var app_entry_point = argv.e || argv.entry || config.app.entry || 'index.html';
var remote_app = app_entry_point.indexOf('http') === 0;

// Sanitize/check parameters.
// --app, -a: relative location to static app 
var static = argv.a || argv.app || config.app.static.path;
if (!static && !remote_app) {
    // must be dynamic app
    var app_commit_hook = argv.h || argv.hook || config.app.dynamic.commit_hook;
    var app_git = argv.g || argv.git || config.app.dynamic.git;
    if (!app_git) {
        log('No test application git URL provided!');
    }
    // --builder, -b: path to node.js module that will handle app prep
    var app_builder = argv.b || argv.builder || config.app.dynamic.builder;
    if (!app_builder) {
        log('No application builder module specified!');
    }
}

// --platforms, -p: specify which platforms to build for. android, ios, blackberry, all, or a comma-separated list
// can also specify a specific sha or tag of cordova to build the app with using <platform>@<sha>
// if none specified, builds for all platforms by default, using the latest cordova. this means it will also listen to changes to the cordova project
var platforms = argv.p || argv.platforms || config.app.platforms;
if (!platforms) {
    platforms = libraries.list;
}
if (typeof platforms == 'string') {
    platforms = platforms.split(',').filter(function(p) { 
        return libraries.list.indexOf(p.split('@')[0]) > -1;
    });
}
// determine which platforms we listen to apache cordova commits to
var head_platforms = platforms.filter(function(p) {
    return p.indexOf('@') == -1;
}).map(function(p) { return 'cordova-' + p; });
// determine which platforms are frozen to a tag
var frozen_platforms = platforms.filter(function(p) {
    return p.indexOf('@') > -1;
});

var initQueue = [];

// bootstrap makes sure we have the libraries cloned down locally and can query them for commit SHAs and dates
module.exports = function(config, callback) {
    new bootstrap(config).go(function() {

        // If there are builds specified for specific commits of libraries, queue them up
        if (frozen_platforms.length > 0) {
            console.log('[MEDIC] Queuing up frozen builds.');
            frozen_platforms.forEach(function(p) {
                var tokens = p.split('@');
                var platform = tokens[0];
                var sha = tokens[1];
                var job = {};
                job['cordova-' + platform] = {
                    "sha":sha
                }
                initQueue.push(job);
            });
            console.log('[MEDIC] Frozen build queued.');
        }
        if (static || remote_app) {
            // just build the head of platforms
            console.log('[MEDIC] Building test app for latest version of platforms.');
            head_platforms.forEach(function(platform) {
                if (should_build[platform]) {
                    var job = {};
                    job[platform] = {
                        "sha":"HEAD"
                    }
                    initQueue.push(job);
                }
            });
        } else {
            // on new commits to cordova libs, queue builds for relevant projects.
            
            // if app commit_hook exists, wire it up here
            if (app_commit_hook) {
                if (app_commit_hook.lastIndexOf('.js') == (app_commit_hook.length - 3)) {
                    app_commit_hook = app_commit_hook.substr(0, app_commit_hook.length -3);
                }
                var hook;
                try {
                    hook = require('./' + app_commit_hook);
                } catch(e) {
                    console.error('[MEDIC] [ERROR] ..requiring app hook. Probably path issue: ./' + app_commit_hook);
                    console.error(e.message);
                }
                if (hook) {
                    hook(function(sha) {
                        // On new commits to test project, make sure we build it.
                        // TODO: once test project is created, we should also queue it for relevant platforms
                        initQueue.push({
                            'test':sha
                        });
                    });
                    console.log('[MEDIC] Now listening for test app updates.');
                } else {
                    console.log('[MEDIC] [WARNING] Not listening for app commits. Fix the require issue first!');
                }
            }
        }
        callback(initQueue);
    });
};

