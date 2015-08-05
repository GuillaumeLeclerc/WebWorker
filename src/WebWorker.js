function WebWorker(script) {
	var that = this;
	var booked = false;
	EventEmitter.call(that);
	that.script = script || "simulate.js";
	that.state = "loading";
	that.worker = new Worker(WebWorker.libPath + "workerCode.js");
	that.taskQueue = [];

	var sendMessage = function (evtName, data) {
		var out = [ evtName ];
		if (typeof data !== "undefined") out.push(data);
		that.worker.postMessage(out);
	}

	var load = function() {
		console.log("PRELOAEDDED");
		that.state = "preloaded";
		sendMessage("load", WebWorker.workersPath + that.script);
	}

	var ready = function() {
		that.state = "ready";
		if (that.isReady()) {
			that.emitEvent("ready", [that]);
		} else {
			dequeueTask();
		}
	}

	var finished = function(messageData) {
		that.emitEvent("resultAvailable", [messageData]);
		ready();
	}

	var error = function(error) {
		if (that.state !== "busy") {
			that.state = "error";
			throw error;
		} else {
			that.emitEvent("runError", [error]);
			ready();
		}
	}

	var progress = function(data) {
		that.emitEvent("progress", [data]);
	}

	that.book = function() {
		booked = true;
	}

	that.isReady = function() {
		return that.state === "ready" && that.taskQueue.length === 0 && !booked;
jj	}

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
			default :
			   that.emitEvent(messageName, [messageData])
		}
	});

	var dequeueTask = function() {

		if (that.state !== "ready") {
			return;
		} else {
			that.state = "busy";
		}

		var task = that.taskQueue.shift();
		var work = task.work;
		var defered = task.defered;
		var progress = task.progressCallback;

		sendMessage("work", work);

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
	}

	that.doWork = function(work, progressCallback) {
		booked = false;
		var defered = Q.defer();

		var task = {
			work : work,
			progressCallback : progressCallback,
			defered : defered
		};

		that.taskQueue.push(task);
		dequeueTask();
		return defered.promise;
	}
}

WebWorker.libPath = "workers/";
WebWorker.workersPath = "workers/";

WebWorker.prototype = Object.create(EventEmitter.prototype);
WebWorker.prototype.constructor = WebWorker;

function WorkerPool(minSize, maxSize, script) {
	var that = this;
	
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
	}

	var createWorker = function() {
		var w = new WebWorker(script);
		w.addListener("ready", workerReadyCallback);
		workers.push(w);
		return w;
	}

	var freeWorker = function() {
		for (var i in workers) {
			if (workers[i].isReady()) {
				console.log("assigning " + i);
				return workers[i];
			}
		}
		return undefined;
	}

	var getWorker = function() {
		var defered = Q.defer();
		var worker = freeWorker();

		if (worker) {
			worker.book();
			defered.resolve(worker);
			console.log("using a free worker");
		} else if (workers.length < maxSize) {
			console.log("dynamically creating a new worker");
			worker = createWorker();
			worker.book();
			defered.resolve(worker);
		} else {
			console.log("waiting a worker to be ready");
			waitQueue.push(defered);
		}
		return defered.promise;
	}

	for (var i = 0 ; i < minSize ; ++i) {
		createWorker();
	}

	that.doWork = function() {
		var args = arguments;
		return getWorker().then(function(worker) {
			return worker.doWork.apply(worker, args);
		}).fail(function(error) {
			throw error;
		});
	}


}
