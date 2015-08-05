function sendMessage(evtName, data) {
	var out = [ evtName ];
	if (typeof data !== "undefined") out.push(data);
	postMessage(out);
}

var defined = null;

function define(dependencies, definition) {
	if (defined !== null) {
		return sendMessage("error", "You can define your worker only once !");
	}
	for (var i in dependencies) {
		importScripts(dependencies[i]);
	}
	if (!definition || typeof definition !== "object") {
		sendMessage("error", new Error("The second argument of the define function should be an object"));
	}

	if (definition.loadSync && typeof definition.loadSync === "function") {
		try {
			definition.loadSync();
			sendMessage("loaded");
		} catch (error) {
			sendMessage("error", error)
		}
	} else if (definition.load && typeof definition.load === "function") {
		definition.load(function(error) {
			if (error) {
				sendMessage("error", error);
			} else {
				sendMessage("loaded");
			}
		});
	} else {
		sendMessage("loaded");
	}

	defined = definition;
}

var handler = {
	load : function(message) {
		importScripts(message);
	},

	work : function(args) {
		
		var progressCallback = function(progress) {
			sendMessage("progress", progress);
		}

		sendMessage("startWorking");
		if (defined.workSync && typeof defined.workSync === "function") {
			try {
				var result = defined.workSync(args, progressCallback);
				return sendMessage("finishedWorking", result);
			} catch (e) {
				return sendMessage("error", e);
			}
		} else if (defined.work && typeof defined.work === "function") {
			defined.work(args, function(error, result) {
				if (error) {
					return sendMessage("error", error);
				} else {
					return sendMessage("finishedWorking", result);
				}
			}, progressCallback);
		} else {
			return sendMessage("error", "No work or workSync defined in the worker");
		}
	}
}

self.onmessage = function(e) {
	var message = e.data;
	var messageName = message[0];
	var data = message[1];
	if (typeof handler[messageName] === "function") {
		handler[messageName](data);
	}
}

sendMessage("preloaded");
