function sendMessage(evtName, data) {
	"use strict";
	var out = [ evtName ];
	if (typeof data !== "undefined") {
		out.push(data);
	}
	postMessage(out);
}

var defined = null;

function define(dependencies, definition) {
	"use strict";
	if (defined !== null) {
		return sendMessage("error", "You can define your worker only once !");
	}
	for (var i in dependencies) {
		importScripts(dependencies[i]);
	}
	if (!definition || typeof definition !== "object") {
		sendMessage("error", new Error("The second argument of the define function should be an object"));
	}

	var availableMethods = [];

	for (var j in definition) {
		if (j !== "load" && j !== "loadSync") { //we don't want to expose the loading methods
			j = j.replace(/Sync$/, "");
			availableMethods.push(j);
		}
	}

	var loadedCallback = function() {
		sendMessage("loaded", availableMethods);
	};

	if (definition.loadSync && typeof definition.loadSync === "function") {
		try {
			definition.loadSync();
			loadedCallback();
		} catch (error) {
			sendMessage("error", error);
		}
	} else if (definition.load && typeof definition.load === "function") {
		definition.load(function(error) {
			if (error) {
				sendMessage("error", error);
			} else {
				loadedCallback();
			}
		});
	} else {
		loadedCallback();
	}

	defined = definition;
}

var handler = {
	load : function(message) {
		"use strict";
		try {
			importScripts(message);
		} catch (e) {
			sendMessage("error", {
				name : e.name,
				message : e.message
			});
		}
	},

	work : function(params) {
		"use strict";

		var methodName = params[0];
		var methodNameSync = methodName + "Sync";
		var args = params[1];
		
		var progressCallback = function(progress) {
			sendMessage("progress", progress);
		};

		sendMessage("startWorking");
		if (defined[methodNameSync] && typeof defined[methodNameSync] === "function") {
			try {
				var result = defined[methodNameSync](args, progressCallback);
				return sendMessage("finishedWorking", result);
			} catch (e) {
				return sendMessage("error", e);
			}
		} else if (defined[methodName] && typeof defined[methodName] === "function") {
			defined[methodName](args, function(error, result) {
				if (error) {
					return sendMessage("error", error);
				} else {
					return sendMessage("finishedWorking", result);
				}
			}, progressCallback);
		} else {
			return sendMessage("error", methodName + " and " + methodNameSync + " are not available in the worker");
		}
	}
};

self.onmessage = function(e) {
	"use strict";
	var message = e.data;
	var messageName = message[0];
	var data = message[1];
	if (typeof handler[messageName] === "function") {
		handler[messageName](data);
	}
};

sendMessage("preloaded");
