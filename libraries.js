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

var path = require('path');

module.exports = {
    list:['android','ios','mobilespec'],//,'blackberry','ios'],
    paths:{     // should be using these...
        'cordova-android':path.join(__dirname, 'lib', 'cordova-android'),
        'cordova-ios':path.join(__dirname, 'lib', 'cordova-ios'),
        'cordova-blackberry':path.join(__dirname, 'lib', 'cordova-blackberry')//,
        //'test':path.join(__dirname, 'lib', 'test')
        //'mobilespec':path.join(__dirname, 'github','mobilespec')
    },
    output:{
        //'cordova-android':path.join(__dirname, 'temp', 'android'),
        'cordova-android':path.join(__dirname,'github','mobilespec','platforms','android'),
        'cordova-ios':path.join(__dirname, 'github','mobilespec','platforms','ios')
        //'cordova-blackberry':path.join(__dirname, 'temp', 'blackberry')//,
        // we don't wanna make you! test':path.join(__dirname, 'temp', 'test')
    },
    first_tested_commit:{
        'cordova-android':'538e90f23aaeebe4cc08ad87d17d0ab2dde6185d', //what are these? the ones that he did first? shoudl these be hardcoded?
        'cordova-ios':'6e60c222f8194bb43de6b52c5ea9ff84cc92e040'
    },
    repos_we_care_about:{
        // List all of the repos we watch for commits on
        // Since we will fetch everything via coho -r, no need for paths or anything
        'cordova-android': "",
        'cordova-ios':"",
        'cordova-blackberry':"",
        'cordova-mobilespec':"",
        'cordova-plugin-battery-status':"",
        'cordova-plugin-camera':"",
        'cordova-plugin-console':"",
        'cordova-plugin-contacts':"",
        'cordova-plugin-device-motion':"",
        'cordova-plugin-device-orientation':"",
        'cordova-plugin-device':"",
        'cordova-plugin-dialogs':"",
        'cordova-plugin-file-transfer':"",
        'cordova-plugin-file':"",
        'cordova-plugin-geolocation':"",
        'cordova-plugin-globalization':"",
        'cordova-plugin-inappbrowser':"",
        'cordova-plugin-media':"",
        'cordova-plugin-media-capture':"",
        'cordova-plugin-network-information':"",
        'cordova-plugin-splashscreen':"",
        'cordova-plugin-vibration':""
    }
};
//        'cordova-blackberry':'4506e7d48071213653771007970bb86276c2d9d9'
// cordova-android is: https://git-wip-us.apache.org/repos/asf?p=cordova-android.git;a=commit;h=538e90f23aaeebe4cc08ad87d17d0ab2dde6185d
// which was on Nov 21, Nov 2012
