function WebWorker(script) {
	"use strict";
	var that = this;
	var booked = false;
	var eventsRegistered = false;
	var eventQueue = {};
	var nextTaskId = 0;
	var runningTask = -1;

	EventEmitter.call(that);
	that.script = script || "simulate.js";
	that.state = "loading";
	that.worker = new Worker(WebWorker.libPath + "workerCode.js");
	that.taskQueue = [];

	var sendMessage = function (evtName, data) {
		var out = [ evtName ];
		if (typeof data !== "undefined") { out.push(data);
		}
		that.worker.postMessage(out);
	};

	var newTaskId = function() {
		return ++nextTaskId;
	};

	var load = function() {
		console.log("PRELOAEDDED");
		that.state = "preloaded";
		sendMessage("load", WebWorker.workersPath + that.script);
	};

	var resetEvents = function() {
		eventsRegistered = false;
	};

	var ready = function() {
		console.log("Worker ready");
		that.state = "ready";
		runningTask = -1;
		if (that.isReady()) {
			that.emitEvent("ready", [that]);
		} else {
			dequeueTask();
		}
	};

	var finished = function(messageData) {
		that.emitEvent("resultAvailable", [messageData]);
		resetEvents();
		ready();
	};

	var error = function(error) {
		if (that.state !== "busy") {
			console.log("Error", JSON.stringify(error));
			that.state = "error";
			that.emitEvent("error", [error]);
		} else {
			that.emitEvent("runError", [error]);
			resetEvents();
			ready();
		}
	};

	var progress = function(data) {
		that.emitEvent("progress", [data]);
	};

	var registerMethods = function(methodNames) {
		for (var mIndex in methodNames) {
			var method = methodNames[mIndex];
			// we make sure we do not override a worker method
			if (typeof that[method] === "undefined") {
				that.emitEvent("methodAvailable", [method]);
				that[method] = that.doWork.bind(that, method);
			}
		}
	};

	var eventsRegisteredCallback = function() {
		eventsRegistered = true;
		processQueueEvent();
	};

	that.terminate = function () {
		that.worker.terminate();
		that.state = "terminated";
	};

	var processQueueEvent = function() {
		while (eventsRegistered &&  eventQueue[runningTask] && eventQueue[runningTask].length > 0) {
			var event = eventQueue[runningTask].shift();
			sendMessage(event.name, event.data);
		}	
	};

	var sendEventToTask = function(taskId, message, value) {
		eventQueue[taskId] = eventQueue[taskId] || [];
		eventQueue[taskId].push({
			name : "custom-" + message,
			data : value
		});
		processQueueEvent();
	};

	that.book = function() {
		booked = true;
	};

	that.isReady = function() {
		return that.state === "ready" && that.taskQueue.length === 0 && !booked;
	};

	that.worker.addEventListener("message", function(e) {
		var message = e.data;
		var messageName = message[0];
		var messageData = message[1];
		switch (messageName) {
			case "error" : 
				error(messageData);
				break;
			case "preloaded" : 
				load();
				console.log("Loaded");
				break;
			case "loaded" :
				//registerMethods(messageData);
				ready();
				break;
			case "startWorking" :
				console.log("start working");
				that.state = "busy";
				break;
			case "progress" :
				progress(messageData);
				break;
			case "finishedWorking" :
				console.log("finished working");
				finished(messageData);
			   break;
			case "eventsRegistered" : 
			   eventsRegisteredCallback();
			   break;
			default :
			   that.emitEvent(messageName, [messageData]);
		}
	});

	var dequeueTask = function() {

		if (that.state !== "ready" || that.taskQueue.length === 0) {
			return;
		} else {
			that.state = "busy";
		}

		var task = that.taskQueue.shift();
		var work = task.work;
		var defered = task.defered;
		var progress = task.progressCallback;
		var methodName = task.methodName;
		var taskId = task.id;


		runningTask = taskId;

		sendMessage("work", [methodName, work]);

		if (typeof progress === "function") {
			that.addListener("progress", progress);
		}

		that.addOnceListener("resultAvailable", function(result) {
			if (typeof progress === "function") {
				that.removeListener("progress", progress);
			}
			defered.resolve(result);
		});
		that.addOnceListener("runError", function(error) {
			that.removeListener("progress", progress);
			defered.reject(error);
		});
	};

	that.doWork = function(methodName, work, progressCallback) {
		booked = false;
		var taskId = newTaskId();
		var defered = Q.defer();

		var task = {
			id : taskId,
			methodName : methodName,
			work : work,
			progressCallback : progressCallback,
			defered : defered
		};

		that.taskQueue.push(task);
		dequeueTask();

		var toReturn = defered.promise;
		toReturn.sendEvent = function(name, message) {
			console.log(message, work, taskId);
			sendEventToTask(taskId, name, message);
		};

		return toReturn;
	};
}

WebWorker.libPath = "workers/";
WebWorker.workersPath = "workers/";

WebWorker.prototype = Object.create(EventEmitter.prototype);
WebWorker.prototype.constructor = WebWorker;

function WorkerPool(minSize, maxSize, script) {
	"use strict";
	var that = this;

	if (typeof minSize !== "number" ||
			typeof maxSize !== "number" ||
			typeof script !== "string"){
		throw "Invalid arguments";
	}

	
	var workers = [];

	that.workers = workers;

	var waitQueue = [];

	var workerReadyCallback = function() {
		while(waitQueue.length > 0 && freeWorker()) {
			var resolved = waitQueue.shift();
			var worker = freeWorker();
			worker.book();
			resolved.resolve(worker);
		}
	};
	
	var methodAvailable = function(methodName) {
		var batchMethodName = methodName + "Batch";
		// we make sure we are not overwriting an existing method
		if (typeof that[methodName] === "undefined") {
			that[methodName] = that.doWork.bind(this, methodName);
		}
		// we make sure we are not overwriting an existing method
		if (typeof that[batchMethodName] === "undefined") {
			that[batchMethodName] = that.doWorkBatch.bind(this, methodName);
		}
	};

	var createWorker = function() {
		var w = new WebWorker(script);
		if (w) { //only if the worker was created
			w.addListener("ready", workerReadyCallback);
			w.addListener("methodAvailable", methodAvailable);
			workers.push(w);
		}
		return w;
	};

	var freeWorker = function() {
		for (var i in workers) {
			if (workers[i].isReady()) {
				console.log("assigning " + i);
				return workers[i];
			}
		}
		return undefined;
	};

	var getWorker = function() {
		var defered = Q.defer();
		var worker = freeWorker();

		if (worker) {
			worker.book();
			defered.resolve(worker);
			console.log("using a free worker");
			return defered.promise;
		} else if (workers.length < maxSize) {
			console.log("dynamically creating a new worker");
			worker = createWorker();
			if (worker) {
				worker.book();
				defered.resolve(worker);
				return defered.promise;
			} else {
				console.log("unable to create more workers");
			}
		}
		console.log("waiting a worker to be ready");
		waitQueue.push(defered);
		return defered.promise;
	};

	for (var i = 0 ; i < minSize ; ++i) {
		createWorker();
	}

	that.terminate = function() {
		for (var i in workers) {
			workers[i].terminate();
		}
	};

	 that.doWork = function() {
		var args = arguments;
		var eventQueue = [];
		var task = null;
		var toReturn = getWorker().then(function(worker) {
			task = worker.doWork.apply(worker, args);
			while (eventQueue.length > 0) {
				var event = eventQueue.shift();
				task.sendEvent(event.name, event.data);
			}
			return task;
		}).fail(function(error) {
			throw error;
		});

		toReturn.sendEvent = function(name , data) {
			if (task === null) {
				eventQueue.push({
					name : name,
					data : data
				});
			} else {
				task.sendEvent(name, data);
			}
		};

		return toReturn;
	};

	that.doWorkBatch = function(methodName, jobs) {
		var promises = [];
		for (var i in jobs) {
			var prom = that.doWork(methodName, jobs[i]);
			promises.push(prom);
		}
		return Q.all(promises);
	};
}
