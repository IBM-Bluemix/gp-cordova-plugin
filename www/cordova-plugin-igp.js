/*
 * Copyright IBM Corp. 2015,2016
 *
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements.  See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership.  The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License.  You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied.  See the License for the
 * specific language governing permissions and limitations
 * under the License.
*/

/**
 * This is the constructor of client. It is used to communicate with IBM Globalization Pipeline API to get translation resource.
 * @Class Client
 */
function Client(args){
	var needAll = ' - expected {args: { uri: ...,  username: ..., password: ..., srcPath: ..., expireAfter: ..., }}';
	
	this._args = args;
	if(!this._args){
		throw new Error("Initialize Client: missing 'args', " + needAll);
	}else if(!this._args.uri){
		throw new Error("Initialize Client: missing 'args.uri', " + needAll);
	}else if(!this._args.username){
		throw new Error("Initialize Client: missing 'args.username', " + needAll);
	}else if(!this._args.password){
		throw new Error("Initialize Client: missing 'args.password', " + needAll);
	}
	
	if(!this._args.expireAfter){
		//default cache expires after 24 hours
		this._args.expireAfter = 24 * 3600;
	}
	
	this._args.uri = _removeTrailing(this._args.uri, '/');
	
	this.supportedLangs = null;
};

Client.version = 'v2';

Client.prototype._init = function(callback, arg1, arg2, arg3){
	var client = this;
	if(this.supportedLangs){
		callback(arg1, arg2, arg3);
		return;
	}
	
	var uri = this._args.uri + '/$service/' + Client.version + '/info';
	var successCB = function(obj){
		client.supportedLangs = obj.supportedTranslation.en;
		client.supportedLangs.push('en');
		callback(arg1, arg2, arg3);
	}
	
	var failureCB = function(){
		client.supportedLangs = ["en", "de", "es", "fr", "it", "ja", "ko", "pt-BR", "zh-Hans", "zh-Hant"];
		callback(arg1, arg2, arg3);
	}
	
	this.ajaxGet(uri, successCB, failureCB);
};

/**
 * Convert ISO language code to IGP language code 
 */
var map = {
    'zh-TW': 'zh-Hant-TW',
    'zh-HK': 'zh-Hant-HK',
    'zh-CN': 'zh-Hans-CN',
    'zh': 'zh-Hans'
};

Client.prototype._fallback = function(langId){
	if(map.hasOwnProperty(langId)) {
		langId = map[langId]; 
	}

	var splits = langId.split('-');
	while(splits.length > 0) {
		if(this.supportedLangs.indexOf(langId)>-1) {
			return langId;
		}
		splits.pop(); 
		langId = splits.join('-'); 
	}
	return null;
}

/**
 * Get supported transaction languages from IBM Globalization Pipeline
 */
Client.prototype.supportedTranslationLangs = function(args, successCB, failureCB){
	var uri = this._args.uri + '/$service/' + Client.version + '/info';
	var callback = function(obj){
		if(obj && obj.supportedTranslation){
			if(args && args.source){
				successCB(obj.supportedTranslation[args.source]);
			}else{
				successCB(obj.supportedTranslation.en);
			}
		}
	}
	this.ajaxGet(uri, callback, failureCB);
};

/**
 * Test if the connection with IBM Globalization Pipeline is fine
 */
Client.prototype.ping = function(successCB, failureCB){
	var uri = this._args.uri + '/$service/' + Client.version + '/info';
	this.ajaxGet(uri, successCB, failureCB);
};

/**
 * Download translation from IBM Globalization Pipeline and store it into local database. Return the translation if success.
 */
Client.prototype.download = function(_args, _successCB, _failureCB){
	var client = this;
	var fc = function(args, successCB, failureCB){
		//Get translation from IBM Globalization Pipeline server
		var needAll = ' - expected {args: { instanceId: ...,  bundleId: ..., langId: ...}}';
		if(!args){
			throw new Error("download: missing args");
		}else if(!args.instanceId){
			throw new Error("download: mssing args.instanceId, " + needAll);
		}else if(!args.bundleId){
			throw new Error("download: missing args.bundleId, " + needAll);
		}else if(!args.langId){
			throw new Error("download: missing args.langId, " + needAll);
		}else if(!client._fallback(args.langId)){
			throw new Error("download: not supported args.langId, " + args.langId);
		}
		
		
		args.langId = client._fallback(args.langId);
		var uri_bundle = client._args.uri + '/' + args.instanceId + '/' + Client.version + '/bundles/' + args.bundleId;
		var uri_lang = client._args.uri + '/' + args.instanceId + '/' + Client.version + '/bundles/' + args.bundleId + '/' + args.langId;
		var _ids = {bid: null, tid: null};
		
		//Insert|update transaction into local database 
		var downloadTranslation = function(result){
			var resData = new ResourceData(result.resourceStrings);
			
			var _args = {
				bid: _ids.bid,
				tid: _ids.tid,
				langId: args.langId, 
				lastUpdate: result.updatedAt, 
				lastSynch: (new Date()).toISOString(), 
				resourceData: JSON.stringify(resData)
			}
			
			_insertUpdateTranslation(_args, successCB, failureCB);
		}
		
		//Get Bundle info & store it into plugin database
		var downloadBundle = function(result){
			var _args = {
				id: _ids.bid,
				bundleId: args.bundleId,
				instanceId: args.instanceId, 
				sourceLanguage: result.sourceLanguage,
				updatedAt: result.updatedAt
			}
			
			var afterUpdate = function(bid){
				console.log("Start next step after _insertUpdateBundle");
				if(bid){
					_ids.bid = bid;
				}
				//Get translation from IBM Globalization Pipeline API
				client.ajaxGet(uri_lang, downloadTranslation, failureCB);						
			}
			
			_insertUpdateBundle(_args, afterUpdate, failureCB);
		}
		
		var loadTableIDs = function(){
			var _callback = function(result){
				console.log("Start next step after _loadTableIDs");
				_ids.bid = result.bid;
				_ids.tid = result.tid;
				if(result.lastSynch && (new Date() - new Date(result.lastSynch)) < client._args.expireAfter * 1000){
					console.log("Cache does not expire, load transaction from plugin database.");
					successCB(_parse(result.resourceData));
				}else{
					//Get bundle info from IBM Globalization Pipeline API
					client.ajaxGet(uri_bundle, downloadBundle, failureCB);
				}
			}
		
			_loadTableIDs(args, _callback, failureCB);
		}
		
		_initTables(loadTableIDs, failureCB);
	}
	
	this._init(fc, _args, _successCB, _failureCB);
};

/**
 * Get database connection
 */
function _getConnection(){
	return window.openDatabase("igp", "1.0", "Cordova igp plugin database", 5000000);
};

/**
 * Create two tables if the tables does not exist
 */
function _initTables(successCB, failureCB){
	var db = _getConnection();
	function createTables(tx){
		tx.executeSql('CREATE TABLE IF NOT EXISTS BUNDLE (id unique, bundleId, instanceId, sourceLanguage, updatedAt)');
		tx.executeSql('CREATE TABLE IF NOT EXISTS TRANSLATION (id unique, languageId, bunId, lastUpdate, lastSynch, resourceData)');
	}
	
	function executeSuccess(){
		console.log("Success: _initTables");
		if(successCB){
			successCB();
		}
	}
	
	function errorCB(param1, param2){
		var err = param1.code? param1:param2;
		
		console.log("Error processing SQL: "+ err.code + "-" + err.message);
		if(failureCB){
			failureCB({message: "Error processing SQL: "+ err.message});
		}
	}
	
	db.transaction(createTables, errorCB, executeSuccess);
};

/**
 * Load existing bundle ID and translation ID from database
 */
function _loadTableIDs(args, successCB, failureCB){
	var result = {bid: null, tid: null, lastSynch: null};
	var db = _getConnection();
	function queryDB(tx){
		var sql = "SELECT B.ID AS BID, T.ID AS TID, T.lastSynch, T.resourceData FROM BUNDLE B LEFT JOIN TRANSLATION T ON B.ID = T.BUNID AND T.LANGUAGEID = ? WHERE B.BUNDLEID = ? AND B.INSTANCEID = ?";
		console.log("SQL:" + sql);
		console.log("PARAMS: [" + args.langId + "," + args.bundleId + "," + args.instanceId + "]");
		tx.executeSql(sql, [args.langId, args.bundleId, args.instanceId], querySuccess, errorCB);
	}
	
	function querySuccess(tx, results){
		console.log("results.rows.length:" + results.rows.length);
		if(results.rows.length > 0){
			result.bid = results.rows.item(0).BID;
			result.tid = results.rows.item(0).TID;
			result.lastSynch = results.rows.item(0).lastSynch;
			result.resourceData = results.rows.item(0).resourceData;
			console.log("Result: "+result.bid+"-"+result.tid+"-"+result.lastSynch+"-"+result.resourceData);
		}
		
		if(successCB){
			console.log("Success: _loadTableIDs");
			successCB(result);
		}
	}
	
	function errorCB(param1, param2){
		var err = param1.code? param1:param2;
		
		console.log("Error processing SQL: "+ err.code + "-" + err.message);
		if(failureCB){
			failureCB({message: "Error processing SQL: "+ err.message});
		}
	}
	
	db.transaction(queryDB, errorCB);
};

/**
 * Insert or update bundle information
 */ 
function _insertUpdateBundle(args, successCB, failureCB){
	var db = _getConnection();
	var sql = null;
	
	function errorCB(param1, param2){
		var err = param1.code? param1:param2;
		
		console.log("Error processing SQL: "+ err.code + "-" + err.message);
		if(failureCB){
			failureCB({message: "Error processing SQL: "+ err.message});
		}
	}
	
	function querySuccess(tx, results){
		if(results.rows.length > 0){
			args.id = results.rows.item(0).id;
		}
		if(successCB){
			console.log("Load Bundle id: " + args.id);
			successCB(args.id);
		}
	}
	
	function queryDB(tx){
		tx.executeSql("SELECT id FROM BUNDLE WHERE bundleID = ? AND instanceID = ?", [args.bundleId, args.instanceId], querySuccess, errorCB);
	}
	
	function updateSuccess(){
		console.log("success: _insertUpdateBundle");
		if(args.id){
			if(successCB){
				successCB(null);
			}				
		}else{
			db.transaction(queryDB, errorCB);
		}
	}
	
	function updateDB(tx){
		if(args.id){
			sql = "UPDATE BUNDLE SET bundleID = ?, instanceID = ?, sourceLanguage = ?, updatedAt = ? WHERE id = ?";
			console.log("SQL:" + sql);
			console.log("PARAMS: [" + args.bundleId + "," + args.instanceId + "," + args.sourceLanguage + "," + args.updatedAt + "," + args.id + "]");
			tx.executeSql(sql, [args.bundleId, args.instanceId, args.sourceLanguage, args.updatedAt, args.id], updateSuccess, errorCB);
		}else{
			sql = "INSERT INTO BUNDLE (id, bundleID, instanceID, sourceLanguage, updatedAt) VALUES ((SELECT CASE WHEN MAX(ID) IS NULL THEN 1 ELSE MAX(ID)+1 END FROM BUNDLE),?,?,?,?)";
			console.log("SQL:" + sql);
			console.log("PARAMS: [" + args.bundleId + "," + args.instanceId + "," + args.sourceLanguage + "," + args.updatedAt + "]");
			tx.executeSql(sql, [args.bundleId, args.instanceId, args.sourceLanguage, args.updatedAt], updateSuccess, errorCB);
		}
	}
	
	db.transaction(updateDB, errorCB);
}; 


/**
 * Load key/value pairs for a target language from IBM Globalization Pipeline
 * Insert/update the key/value pairs into plugin database
 */
function _insertUpdateTranslation(args, successCB, failureCB){
	var db = _getConnection();
	var sql = null;
	
	function updateDB(tx){
		if(args.tid){
			sql = "UPDATE TRANSLATION SET languageId = ?, bunId = ?, lastUpdate = ?, lastSynch = ?, resourceData = ? WHERE id = ?";
			console.log("SQL:" + sql);
			console.log("PARAMS: [" + args.langId + "," + args.bid + "," + args.lastUpdate + "," + args.lastSynch + "," + args.resourceData + "," + args.tid + "]");
			tx.executeSql(sql, [args.langId, args.bid, args.lastUpdate, args.lastSynch, args.resourceData, args.tid], updateSuccess, errorCB);
		}else{
			sql = "INSERT INTO TRANSLATION (id, languageId, bunId, lastUpdate, lastSynch, resourceData) VALUES ((SELECT CASE WHEN MAX(ID) IS NULL THEN 1 ELSE MAX(ID)+1 END FROM TRANSLATION),?,?,?,?,?)";
			console.log("SQL:" + sql);
			console.log("PARAMS: [" + args.langId + "," + args.bid + "," + args.lastUpdate + "," + args.lastSynch + "," + args.resourceData + "]");
			tx.executeSql(sql, [args.langId, args.bid, args.lastUpdate, args.lastSynch, args.resourceData], updateSuccess, errorCB);
		}
	}
	
	function updateSuccess(){
		console.log("success: _insertUpdateTranslation");
		if(successCB){
			successCB(_parse(args.resourceData));
		}
	}
	
	function errorCB(param1, param2){
		var err = param1.code? param1:param2;
		
		console.log("Error processing SQL: "+ err.code + "-" + err.message);
		if(failureCB){
			failureCB({message: "Error processing SQL: "+ err.message});
		}
	}
	
	if(Object.getOwnPropertyNames(_parse(args.resourceData)).length > 0){
		db.transaction(updateDB, errorCB);
	}else{
		failureCB({message: "Resource not found!"});
	}
};

/**
 * update translation in cache if necessary first
 * load translation from cache and return it to successCB
 * _args.srcPath: it is the absolute path of mobile system.
 */
Client.prototype.getTranslation = function(_args, _successCB, _failureCB){
	var client = this;
	var fc = function(args, successCB, failureCB){
		//Load transaction from plugin database if error happens during download
		var callback = function(err){
			console.log("Error happens during download:" + err.message);
			
			var _loadSF = function(err){
				console.log("ERROR:" + err.message);
				_loadSourceFile(args.srcPath, successCB, failureCB);
			}
			
			client.loadTranslationInCache(args, successCB, _loadSF);
		}
		client.download(args, successCB, callback);	
	}
	
	this._init(fc, _args, _successCB, _failureCB);
};

/**
 * Load translation from plugin database 
 */
Client.prototype.loadTranslationInCache = function(_args, _successCB, _failureCB){
	var client = this;
	var fc = function(args, successCB, failureCB){
		var needAll = ' - expected {args: { instanceId: ...,  bundleId: ..., langId: ...}}';
		if(!args){
			throw new Error("loadTranslationInCache: missing 'args', " + needAll);
		}else if(!args.instanceId){
			throw new Error("loadTranslationInCache: missing 'args.instanceId', " + needAll);
		}else if(!args.bundleId){
			throw new Error("loadTranslationInCache: missing 'args.bundleId', " + needAll);
		}else if(!args.langId){
			throw new Error("loadTranslationInCache: missing 'args.langId', " + needAll);
		}else if(!client._fallback(args.langId)){
			throw new Error("download: not supported args.langId, " + args.langId);
		}
		
		args.langId = client._fallback(args.langId);
		var db = _getConnection();
		
		function querySuccess(tx, results){
			if(results.rows.length > 0){
				var result = results.rows.item(0).resourceData;
				console.log("success: loadTranslationInCache. Resource data: " + result);
				successCB(result);
			}else{
				failureCB({message: "Resource not found!"});
			}
		}
		
		function queryDB(tx){
			var sql = "SELECT resourceData FROM TRANSLATION T INNER JOIN BUNDLE B ON B.ID = T.BUNID WHERE T.LANGUAGEID = ? AND B.BUNDLEID = ? AND INSTANCEID = ?";
			console.log("SQL:" + sql);
			console.log("PARAMS: [" + args.langId + "," + args.bundleId + "," + args.instanceId + "]");
			tx.executeSql(sql, [args.langId, args.bundleId, args.instanceId], querySuccess, errorCB);
		}

		function errorCB(param1, param2){
			var err = param1.code? param1:param2;
			
			console.log("Error processing SQL: "+ err.code + "-" + err.message);
			if(failureCB){
				failureCB({message: "Error processing SQL: "+ err.message});
			}
		}
		
		db.transaction(queryDB, errorCB);
	}
	
	this._init(fc, _args, _successCB, _failureCB);
};

/**
 * Load source file from local folder
 * @Param path, absolute path in your project.
 */
_loadSourceFile = function(path, successCB, failureCB){
	var localURL = path;

	function errorCB(err) {
        console.log(err.code);
		if(failureCB){
			failureCB({message: err.code});
		}
    }

    function gotFile(file){
		var reader = new FileReader();
	
		reader.onloadend = function(evt) {
			console.log("Read as text");
			console.log(evt.target.result);
			var result = _parse(evt.target.result);
			if(evt.target.result && typeof result == 'object'){
				if(successCB){
					console.log("Success callback");
					successCB(result);
				}
			}
		};
		
		reader.onerror = function(err){
			console.log("File error code: " + err.code);
			failureCB({message: "File error code: " + err.code});
		};
		
		reader.readAsText(file);
    }

    function gotFileEntry(fileEntry) {
        fileEntry.file(gotFile, errorCB);
    }

	if(path && "" != path){
		console.log("Start to load file from local folder:" + localURL);
		window.resolveLocalFileSystemURL(localURL, gotFileEntry, errorCB);	
	}else{
		failureCB({message: "No source file path provided!"});
	}

}

/**
 * initial XMLHttpRequest object
 */
function _getXHR(){
	var xhr = null;
	try{
		xhr = new XMLHttpRequest();
	}catch(e){
		try{
			xhr = new ActiveXObject("Msxml2.XMLHTTP");			
		}catch(err){
			try{
				xhr = new ActiveXObject("Microsoft.XMLHTTP");
			}catch(error){
				throw new Error("XMLHttpRequest is not supported!");
			}
		}
	}
	
	return xhr;
};

/**
 * function for internal invocation
 */
Client.prototype._ajaxCall = function(url, method, params, successCB, failureCB){
	var xhr = _getXHR();
	xhr.onreadystatechange = function(){
		if(xhr.readyState == 4){
			if(xhr.status == 200){
				if(successCB){
					console.log("Success:"+xhr.responseText);
					var result = _parse(xhr.responseText);
					if(result.bundle){
						result = result.bundle;
					}
					successCB(result);
				}
			}else{
				if(failureCB){
					console.log("Failure:"+xhr.responseText);
					var err = _parse(xhr.responseText);
					failureCB(err);
				}
			}
		}
		
		try{
			delete xhr;
		}catch(e){			
		}
	}

	if(method == 'POST'){
		xhr.open('POST', url, true);
		xhr.setRequestHeader('Authorization', "Basic " + _encode64(this._args.username + ":" + this._args.password));
		xhr.setRequestHeader('Content-type', 'application/x-www-form-urlencoded');
		xhr.send(params);
	}else if(method == 'GET'){
		xhr.open('GET', url, true);
		xhr.setRequestHeader('Authorization', "Basic " + _encode64(this._args.username + ":" + this._args.password));
		xhr.send(null);
	}else{
		throw new Error("Ajax method '" + method + "' is not supported!");
	}
};

/**
 * Ajax get
 */
Client.prototype.ajaxGet = function(url, successCB, failureCB){
	this._ajaxCall(url, 'GET', null, successCB, failureCB);
};

/**
 * Ajax post
 */
Client.prototype.ajaxPost = function(url, params, successCB, failureCB){
	this._ajaxCall(url, 'POST', params, successCB, failureCB);
};

/**
 * Parse object string to object using eval()
 */
function _parse(res){
	return eval('(' + res + ')');
};

/**
 * @Class ResourceData
 * key/value pairs for source/target property
 */
 
function ResourceData(props){
	if ( props ) {
		for(var k in props) {
		  this[k] = props[k];
		}
	}
};

function _removeTrailing(str, chr) {
      if (!str || (str=="")) return str;
	  
      var newIdx = str.length - chr.length;
      if(newIdx < 0) return str;
	  
      if (str.substring(newIdx, str.length) == chr) {
        return str.substring(0, newIdx);
      } else {
        return str;
      }
};

/**
 * Base64 encode 
 */ 
function _encode64(source) {
	var allChars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=";
	var result = "";
	var char1, char2, char3, idx1, idx2, idx3, idx4;
	var i = 0;
	while (i < source.length) {

		char1 = source.charCodeAt(i++);
		char2 = source.charCodeAt(i++);
		char3 = source.charCodeAt(i++);

		idx1 = char1 >> 2;
		idx2 = ((char1 & 3) << 4) | (char2 >> 4);
		idx3 = ((char2 & 15) << 2) | (char3 >> 6);
		idx4 = char3 & 63;

		if (isNaN(char2)) {
			idx3 = idx4 = 64;
		} else if (isNaN(char3)) {
			idx4 = 64;
		}

		result += allChars.charAt(idx1) + allChars.charAt(idx2) +
		allChars.charAt(idx3) + allChars.charAt(idx4);
	}

	return result;
}	


// Export a global object for IBM Globalization Pipeline
var igp = {
	getClient : function(args){
		return new Client(args);
	}
};

module.exports = igp;

