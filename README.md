Cordova plugin for IBM Globalization Pipeline
===

<!--
/*    
 * Copyright IBM Corp. 2015
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
-->

## What is this?

This is a Cordova plugin and sample code for the
[Globalization Pipeline](https://www.ng.bluemix.net/docs/#services/GlobalizationPipeline/index.html#globalization)
Bluemix service. The IBM Globalization Pipeline makes it easy for you to provide your global customers
with Bluemix applications translated into the languages in which they work.

Adding this plugin into your cordova-based project, your application can dynamically request translations of your application content
from the IBM Globalization Pipeline.

## Getting started

To get started, you should familiarize yourself with the service itself. A
good place to begin is by reading the [Quick Start Guide](https://github.com/IBM-Bluemix/gp-common#quick-start-guide) and the official [Getting Started with IBM Globalization ](https://www.ng.bluemix.net/docs/services/GlobalizationPipeline/index.html) documentation.

The documentation explains how to find the service on Bluemix, create a new service instance, create a new bundle, and access the translated messages.

## Installation

* Switch workspace to working cordova project
* Add this plugin and dependency plugin into working project
```javascript
cordova plugin add cordova-plugin-file
cordova plugin add cordova-plugin-igp
```

* Initialize a client
```javascript
var args = {
    uri: 'https://gp-dev-rest.bluemix.net/translate/rest',
    username: '1234',
	password: '1234',
	expireAfter: 3600   //time unit is second, 3600 means 1 hour
}
var client = igp.getClient(args);
```
    * Once plugin `cordova-plugin-igp` is added, a global object called `igp` is exposed to main program.
    * Four arguments are required to initialize a client. `expireAfter` is the cache expiration duration.
    * `Client` object is used to communicate with IBM Globalization Pipeline deployed on IBM BlueMix to get resource data.

* Get translation resource data from `IBM Globalization Pipeline`
```javascript
var args1 = { instanceId: '001',  bundleId: 'test2',
              langId: 'de', srcPath: 'www/res/12345.txt'};
function successCB(result){
    //get the string format of object result and show it in main page.
    document.getElementById("loadTranslation").innerHTML = JSON.stringify(result);
}
function failureCB(err){
	console.log(err.message)
}
client.getTranslation(args1, successCB, failureCB);
```

## API convention

APIs which take two callbacks use this pattern:

`obj.function( { /*params*/ } ,  function successCallBack(err), function failureCallBack(result))`

* params: an object containing input parameters, if needed.
* `err`: if truthy, indicates an error has occured.
* `result`: result object returned if function executes successfully.(optional)

All language identifiers are [IETF BCP47](http://tools.ietf.org/html/bcp47) codes.

API reference
===

#igp
**Author**: Jian Jun Wang  
**Reviewer**: Steven Atkin, Terry Tong

* [igp](#module_igp)
    * [class:igp~Client](#module_igp..Client)
        * [client.supportedTranslationLangs(args, successCB, failureCB)](#module_igp..Client#supportedTranslationLangs)
        * [client.ping(successCB, failureCB)](#module_igp..Client#ping)
        * [client.getTranslation(args, successCB, failureCB)](#module_igp..Client#getTranslation)
        * [client.download(args, successCB, failureCB)](#module_igp..Client#download)
        * [client.loadTranslationInCache(args, successCB, failureCB)](#module_igp..Client#loadTranslationInCache)
    * [class:igp~ResourceData](#module_igp..ResourceData)

<a name="module_igp"></a>  

<a name="module_igp..Client"></a>
##class:igp~Client
* Initialize a client
```javascript
var args = {
    		uri: 'https://gp-dev-rest.bluemix.net/translate/rest',
			username: '1234',
			password: '1234',
			expireAfter: 3600
		}
		var client = igp.getClient(args);
```
`igp` is a global object available to use once this plugin is included into a cordova project.

<a name="module_igp..Client#supportedTranslationLangs"></a>
###client.supportedTranslationLangs(args, successCB, failureCB)
**Description**: This function returns an array containing all target language(s).

**Params**

- args `object` - optional. Default source language is `en`
- successCB - param is the array of target languages
- failureCB - param is `err` object

<a name="module_igp..Client#ping"></a>
###client.ping(successCB, failureCB)
**Description**: Do we have access to the server?

**Params**

- successCB - no params
- failureCB - params is `err` object

<a name="module_igp..Client#getTranslation"></a>
###client.getTranslation(args, successCB, failureCB) - High level API
**Description**

- Plug-in first checks if the resource data in plugin database expires. (The expiration duration is configured by the developer.) If cache expires, Plug-in will access the IBM Globalization Pipeline on bluemix to synchronize the resource data in the local storage with the server.
- If cache doesn't expires, plugin will load resource data from its local storage.
- If no resource data found in above 2 steps (translation for a specific language is not available), plugin will load source file from app folder if source file path is specified.

**Params**

- args `object` {instanceId: ..., bundleId: ..., langId: ..., srcPath: ...}
- successCB, params is `ResouceData` object
- failureCB, params is `err` object
- Params `srcPath`, the absolute path of mobile system


<a name="module_igp..Client#download"></a>
###client.download(args, successCB, failureCB) - low level API
**Description**: Plug-in checks if the resource data in plugin database expires. (The expiration duration is configured by the developer.). If cache expires, Plug-in will access the IBM Globalization Pipeline on bluemix to synchronize the resource data in the local storage with the server.

**Params**

- args `object` {instanceId: ..., bundleId: ..., langId: ...}
- successCB, params is `ResouceData` object
- failureCB, params is `err` object


<a name="module_igp..Client#loadTranslationInCache"></a>
###client.loadTranslationInCache(args, successCB, failureCB) - low level API
**Description**: Plug-in loads resource data from its local storage directly.

**Params**

- args `object` {instanceId: ..., bundleId: ..., langId: ...}
- successCB, params is `ResouceData` object
- failureCB, params is `err` object

<a name="module_igp..ResourceData"></a>
###class:igp~ResourceData
**Description**: This class contains the resource data from IBM Globalization Pipeline.


Community
===
* View or file GitHub [Issues](https://github.com/IBM-Bluemix/gp-cordova-plugin/issues)
* Connect with the open source community on [developerWorks Open](https://developer.ibm.com/open/ibm-bluemix-globalization-pipeline/cordova-sdk/)

Contributing
===
See [CONTRIBUTING.md](CONTRIBUTING.md).

License
===
Apache 2.0. See [LICENSE.txt](LICENSE.txt).

> Licensed under the Apache License, Version 2.0 (the "License");
> you may not use this file except in compliance with the License.
> You may obtain a copy of the License at
>
> http://www.apache.org/licenses/LICENSE-2.0
>
> Unless required by applicable law or agreed to in writing, software
> distributed under the License is distributed on an "AS IS" BASIS,
> WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
> See the License for the specific language governing permissions and
> limitations under the License.
