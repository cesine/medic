
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
var couch = require('./couchdb');

/* send error to couch
 * accepts:
 *   error_writer(platform, sha, failure, details)
 *   error_writer(platform, sha, version, failure details);
 *   error_writer(platform, sha, version, model, failure, details);
 */
module.exports = function error_writer(job, error) {

    // generate couch doc
    var doc = {
        sha:            job.sha,
        plugin_id:      job.info ? job.info.id : 'noid',
        platform:       job.platform,
        error:          error,
        phonegap:       job.gap_version,
        plugin_version: job.info ? job.info.version : 'noversion'
    };

    // build error, be noisy
    console.error('[' + job.platform.toUpperCase() + ' ERROR]: ' + error);

    // fire off to couch
    var doc_id_array = [doc.plugin_id, doc.platform, doc.phonegap, job.info.version]; 

    var doc_id = doc_id_array.map(encodeURIComponent).join('__');
    console.log(doc_id);

    couch.results.clobber(doc_id, doc, function(resp) {
        if (resp.error) {
            console.error('[COUCH ERROR] Saving doc with id ' + doc_id);
        }
    });
}
