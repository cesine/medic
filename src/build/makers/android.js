
/*
Copyright (c) 2012 Adobe Systems Incorporated. All rights reserved.

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/
var shell        = require('shelljs'),
    path         = require('path'),
    error_writer = require('./error_writer'),
    n            = require('ncallbacks'),
    libraries    = require('../../../libraries'),
    scan         = require('./android/devices'),
    deploy       = require('./android/deploy'),
    fs           = require('fs'),
    config       = require('../../../config');

var android_lib = libraries.paths['cordova-android'];
var create = path.join(android_lib, 'bin', 'create');

var githubPath = config.githubPath;

module.exports = function(output, sha, devices, entry_point, callback) {
    function log(msg) {
        console.log('[ANDROID] ' + msg);
    }

    log("output"+output); //output/Users/sesadmin/medic/medic/temp/android   which is wrong
    // changed 'output' to //Users/sesadmin/medic/medic/github/mobilespec/platforms/android
    log("github path:" + githubPath);

    //shell.rm('-rf', output);    // why?

    // update the needed repos; we don't ever update coho, so this is somethign we'll have to rememer to do or add in later
    // also we are just running the repo-update, so the first time will need to manually run repo-clone or check to see if its here
    //      remember to run npm install if you do the full repo-clone!
    shell.exec(path.join(githubPath,"cordova-coho","coho") + ' repo-update -r auto', {silent:false, async:true}, function(code, checkout_output) {
        if (code > 0) {
            error_writer('android', 'error running coho repo-update!', checkout_output);
            callback(true);
        } else {
            // run Andrew's awesome createmobilespec.sh script
            log('Running cordova-mobile-spec/createmobilespec.sh');
            shell.exec('cd ' + githubPath + ' && ' + path.join(githubPath,"cordova-mobile-spec","createmobilespec.sh"), {silent:false, async:true}, function(code, create_out) {
                if (code > 0 && code != 10) {
                    // edited createmobilespec.sh so that code==10 means mobilespec folder already exists; 
                    // which for us, just means that it has already been built and no need to rebuild
                    // TODO: later we need to move this code to teh hook that fires every time a new commit exists

                    //error_writer('android', "error running createmobilespec.sh:");//, create_out);
                    callback(true);
                } else {
                    try {
                       
                        log('Modifying Cordova application.');

                        
                        // make sure android app got created first.
                        if (!fs.existsSync(output)) {
                            var msg = './bin/create must have failed as output path does not exist. Output is:' + output;
                            log(msg);
                        }
                       
                       
                       // no need to copy anything right, since we alreadyhave www there. 
                       // shell.cp('-Rf', path.join(libraries.output.test, '*'), path.join(output, 'assets', 'www'));

                        // instead, we need to copy jasmine-jsreporter.js over from /Users/sesadmin/medic/medic/src/build/makers/static/jasmine-jsreporter.js
                        shell.cp('-f', path.join('/Users/','sesadmin','medic','medic','src','build','makers','static','jasmine-jsreporter.js'), path.join(output,'assets','www'));


                        // add the sha to the junit reporter
                        var tempJasmine = path.join(output, 'assets', 'www', 'jasmine-jsreporter.js');

                        if (fs.existsSync(tempJasmine)) {
                            log("Copying sha to junit reporter:" + sha);
                            fs.writeFileSync(tempJasmine, "var library_sha = '" + sha + "';\n" + fs.readFileSync(tempJasmine, 'utf-8'), 'utf-8');
                            log("Copied library_sha");
                        }

                            // changed 'output' to //Users/sesadmin/medic/medic/github/mobilespec/platforms/android

                        // modify start page
                        //var javaFile = path.join(output, 'src', 'org', 'apache', 'mobilespec', 'mobilespec.java'); 
                        // this isn't needed since it uses super.loadUrl(Config.getStartUrl()) - instead may need to change getStartUrl 
                        //fs.writeFileSync(javaFile, fs.readFileSync(javaFile, 'utf-8').replace(/www\/index\.html/, 'www/' + entry_point), 'utf-8');
                        // 2. new cordova-android: modify the config.xml

                        // ripped from /build/makers/static.js, since we don't really need the static at all
                        // sure sure why Fil had these commented, guess because it was just redone in android but missing the bottom part replacing the lines in 'all'
                        // that guy is a beast btw

                        // The rest of the jasimine reporters are at: 
                        // /Usders/sesadmin/medic/medic/github/mobilespec/platforms/android/assets/www/autotest/pages
                        // and we wil need to edit all.html on that page to remobe TrivialReporter and add our fancy Jasmine reporter

                        // replace a few lines under the "all" tests autopage
                        var tempAll = path.join(output,'assets','www','autotest','pages','all.html');
                        log("Editing the all.html file here:" + tempAll);

                        fs.writeFileSync(tempAll, fs.readFileSync(tempAll, 'utf-8').replace(/<script type=.text.javascript. src=.\.\..html.TrivialReporter\.js.><.script>/, '<script type="text/javascript" src="../html/TrivialReporter.js"></script><script type="text/javascript" src="../../jasmine-jsreporter.js"></script>'), 'utf-8');
                        fs.writeFileSync(tempAll, fs.readFileSync(tempAll, 'utf-8').replace(/jasmine.HtmlReporter.../, 'jasmine.HtmlReporter(); var jr = new jasmine.JSReporter("' + config.couchdb.host + '");'), 'utf-8');
                        fs.writeFileSync(tempAll, fs.readFileSync(tempAll, 'utf-8').replace(/addReporter.htmlReporter../, 'addReporter(htmlReporter);jasmineEnv.addReporter(jr);'), 'utf-8');
                        

                        log("Done adding jasmine-jsreporter to all.html");


                        // Edit to add the entry_point (all.html)
                        var configFile = path.join(output, 'res', 'xml', 'config.xml');
                        log("Setting main entry point (" + entry_point + ") in the configFile here:" + configFile);
                        fs.writeFileSync(configFile, fs.readFileSync(configFile, 'utf-8').replace(/<content\s*src=".*"/gi, '<content src="' +entry_point + '"'), 'utf-8');
                        log(" Main entry point set, adding your server to the whitelist!");     // lol, whoops. 

                        // so Fil has these as some RegEx, is that needed? 
                        // Are people really going to have <access        origin="blabla"> ? Guess it's nice just in case, but we are using Mobspec so don't expect that
                        var toReplace = '<access origin="httpssss://example.com" />';
                        var replaceWith = '<access origin="httpssss://example.com" /><access origin="'+config.couchdb.host+'" />';


                        fs.writeFileSync(configFile, fs.readFileSync(configFile, 'utf-8').replace(toReplace, replaceWith), 'utf-8');
                        
                        // look at which cordova-<v>.js current lib uses
                        // I have no idea why it would want to do this
                        /*
                        var final_cordovajs = path.join(output, 'assets', 'www', 'cordova.js');
                        // var lib_cordovajs = path.join(android_lib, 'framework', 'assets', 'js', 'cordova.android.js');

                        var lib_cordovajs = path.join(android_lib, 'framework', 'assets','www', 'cordova.js');

                        fs.writeFileSync(final_cordovajs, fs.readFileSync(lib_cordovajs, 'utf-8'), 'utf-8');
                        */
                    } catch (e) {
                        log('Exception thrown modifying Android mobile spec application.' + e.message);

                        callback(true);
                        return;
                    }

                    
                    // compile
                    log('Compiling.');
                    var ant = 'cd ' + output + ' && ant clean && ant debug';
                    shell.exec(ant, {silent:true,async:true},function(code, compile_output) {
                        if (code > 0) {
                            log('Compilation error: ' +  compile_output);
                            callback(true);
                        } else {
                            var binary_path = path.join(output, 'bin', 'mobilespec-debug.apk');
                            var package = 'org.apache.mobilespec';
                            if (devices) {
                                // already have a specific set of devices to deploy to
                                log("Already have devices, deploying!");
                                deploy(sha, devices, binary_path, package, callback);

                            } else {
                                // get list of connected devices
                                scan(function(err, devices) {
                                    if (err) {
                                        // Could not obtain device list...
                                        var error_message = devices;
                                        log(error_message);
                                        callback(true);
                                    } else {
                                        log('Detected device - deploying!');
                                        log(callback);
                                        deploy(sha, devices, binary_path, package, callback);

                                    }
                                });
                            }
                        }
                    });
                    
                }
            });
        }
    });
}
