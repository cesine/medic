
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
var events    = require('events'),
    error_writer = require('./error_writer'),
    builder;

var q = function(name) {
    this.q = [];
    this.building = false;
    this.name = name;
    // If we're not building when we get something pushed onto the queue, we should start building
    this.on('push', function() {
        this.build();
    });
};

q.prototype.__proto__ = events.EventEmitter.prototype;

q.prototype.push = function(j) {
    var r = this.q.push(j);
    console.log('[QUEUE] [' + this.name + '] SHA ' + j.sha.substr(0,7) + (j.numDevices?' for ' + j.numDevices + ' device(s).':'.') + ' (' + this.q.length + ' jobs in queue)');
    this.emit('push', j);
    return r;
};

q.prototype.build = function() {
    if (this.building) return;

    var job = this.q.shift();
    var self = this;
    if (job) {
        this.building = true;
        console.log('[QUEUE] Starting ' + this.name + ' job.');

        job.builder(job, function(err) {
            if (err) {
                console.log('[QUEUE][' + self.name + '] Job failed: ' + err);
                error_writer(job, (new Date()).toJSON().substring(0,19).replace(/:/g, "-"), 'Job failed', err);
            } else {
                console.log('[QUEUE] [' + self.name + '] Job complete.');
            }
            console.log('[QUEUE] Continuing (' + self.q.length + ' jobs remaining in queue)');
            self.building = false;
            self.build();
        });
    } else {
        this.building = false;
        console.log('[BUILDER] [' + this.name + '] Job queue emptied. Illin\' chillin\'.');
    }
};

// set up individual queues for each platform
var platform_queue = {};
platform_queue['android'] = new q('android');
platform_queue['ios'] = new q('ios');

function queue(app_builder, app_entry_point, static) {
    //builder = require('./builder')(app_builder, app_entry_point, static);
}

queue.prototype = {
    push:function(job) {
        var lib = job.platform;
        if (lib && lib in platform_queue) {
            platform_queue[lib].push(job);
        }
    }
};

module.exports = queue;
