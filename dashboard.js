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

var http                   = require('http'),
    url                    = require('url'),    // this must be some node package
    fs                     = require('fs'),
    path                   = require('path'),
    mime                   = require('mime'),
    config                 = require('./config'),
    templates              = require('./src/dashboard/templates'),
    api                    = require('./src/dashboard/api'),
    bootstrap              = require('./bootstrap');

var boot_start = new Date().getTime();

// Different way of doing routes :P
function not_found(res, msg) {
        console.log("[dashbaord] - not found!");
    res.writeHead(404, {
        "Content-Type":"application/json"
    });
    var json = {
        error:true,
        message:msg
    };
    res.write(JSON.stringify(json), 'utf-8');
    res.end();
}
function routeApi(resource) {
    return function(req, res) {
        try {
            console.log('[HTTP] API request for ' + resource + '.');
            console.log('[http] - dashboard - want to parse the request url; req.url is:' + req.url);
            // req.url is something like:  /api/commits/recent  || /api/commits/tested || /api/results?platform=android&sha=9895kj234h34
            var queries = url.parse(req.url, true).query;

            console.log("[http] - queries is:" + JSON.stringify(queries));           // this is becoming {} for commits/recent and /commits/tested....but for results, its:
                                            //    {platform:'android',   sha: '4345j3l4kj34j3;'}
            // what is url.parse.query? ans: a node.js module that lets us get specific parts of the query, great

            var json = api[resource];   // from api.js exports; there is none for /recent/ or /tested/ ....
            //console.log("[http] - json = api[resouce] ===" + JSON.stringify(json));
            // this already contains SHAs for cordova-android, cordova-ios, including the dates of them
            // so it must be filled in from the bootstrap

            if (queries.platform) {
                    console.log("[http]  [queries]  - have queries.platform, it is:" + queries.platform);
                    // if it is telling us a platform, which happsn  when we request /api/results/, then go get them. 
                json = json[queries.platform];
                if (!json) {
                    not_found(res, 'platform "' + queries.platform + '" not found.');
                    return;
                }
            }
            if (queries.sha) {
                console.log("[http]  [queries]  - have queries.sha, it is:" + queries.sha);
                json = json[queries.sha];
                if (!json) {
                    not_found(res, 'sha "' + queries.sha + '" on platform "' + queries.platform + '" not found.');
                    return;
                }
            }

            console.log("[Dashboard] - done with routeAPI, sending JSON back.");// + JSON.stringify(json));
            console.log("");

            res.writeHead(200, {
                "Content-Type":"application/json"
            });
            res.write(JSON.stringify(json), 'utf-8');
            res.end();
        } catch(e) {
            console.log("[dashboard] [error] - an error occured in routeAPI:" + e);
            res.writeHead(500, {
                "Content-Type":"application/json"
            });
            var json = {
                error:true,
                message:e.message
            };
            res.write(JSON.stringify(json), 'utf-8');
            res.end();
        }
    };
}

var routes = {
    "":function(req, res) {
        // Homepage
        res.writeHead(200);
        var html = templates.html();
        res.write(html ? html : '<h1>not yet</h1>', 'utf-8');
        res.end();
    },
    "api/results":routeApi('results'),
    "api/errors":routeApi('errors'),
    "api/commits/recent":routeApi('commits'),
    "api/commits/tested":routeApi('tested_shas')
};

// cache local static content in memory (in memory? k)
['js', 'img', 'css'].forEach(function(media) {
    // not really sure what this fnction is doing; just adding a bunch of routes like
    // routes['js/'{}]. 
    var dir = path.join(__dirname, 'src', 'dashboard', 'templates', media);
    fs.readdirSync(dir).forEach(function(m) {
        var file_path = path.join(dir, m);
        var contents = fs.readFileSync(file_path);
        var type = mime.lookup(file_path);
        routes[media + "/" + m] = function(req, res) {
            res.setHeader('Content-Type', type);
            res.writeHead(200);
            res.write(contents);
            res.end();
        }
    });
});

http.createServer(function (req, res) {
    var method = req.method.toLowerCase();

    // Get rid of leading and trailing / if exists
    var route = url.parse(req.url).pathname.substr(1);
    if (route[route.length-1] == '/') route = route.substr(0, route.length-1);

    if (method == 'get' && route in routes) {
        // nice. never seen it done liek this before, easy and simple
        routes[route](req,res);
    } else {
        res.writeHead(404);
        res.write('<h1>not found!</h1>', 'utf-8');
        res.end();
    }
}).listen(config.dashboard.port);

setTimeout(function() {
    console.log('[BOOT] Cloning necessary git repos (bootstrap).');
    new bootstrap().go(function() {
        console.log("[BOOT - callback] - now the callback to bootstrap.go(), from dashboard");
        console.log('[BOOT] Retrieving results from couch...   eg, apit.boot()');
        api.boot(function() {
            var boot_end = new Date().getTime();
            var diff = (boot_end - boot_start)/1000;
            console.log('[BOOT] Finished in ' + diff + ' seconds. READY TO ROCK!');
        });
    });

}, 3000);
