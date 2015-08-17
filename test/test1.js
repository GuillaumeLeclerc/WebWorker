// -------------------------
// SAUCE LAB CODE
// -------------------------
var log = [];
var testName;

QUnit.done(function (test_results) {
	"use strict";
  var tests = []; for(var i = 0, len = log.length; i < len; i++) {
    var details = log[i];
    tests.push({
      name: details.name,
      result: details.result,
      expected: details.expected,
      actual: details.actual,
      source: details.source
    });
  }
  test_results.tests = tests;

  window.global_test_results = test_results;
});
QUnit.testStart(function(testDetails){
	"use strict";
  QUnit.log(function(details){
    if (!details.result) {
      details.name = testDetails.name;
      log.push(details);
    }
  });
});

WebWorker.libPath = "./build/";
WebWorker.workersPath = "/test/workers/";

QUnit.test("Qunit working", function(assert) {
	"use strict";
	assert.ok(true, "True is ok");
});


QUnit.test("A worker with wrong file name should fire an error event", function(assert) {
	"use strict";
	var done = assert.async();
	var w = new WebWorker("unexisting_file.js");
	w.addListener("error", function(error) {
		assert.ok(error.name.length > 0 ,  "The error has a name");
		assert.ok(error.message.length > 0, "The error has a message");
		assert.equal(w.state, "error", "The state of the worker is : error");
		w.terminate();
		done();
	});
});

QUnit.test("Simple worker with not arguments ", function(assert) {
	"use strict";
	var done = assert.async();
	var w = new WebWorker("test1-a.js");
	w.doWork("work").then(function(result) {
		assert.equal(result, 2, "The result from the worker should be 2");
		w.terminate();
		done();
	});
});

QUnit.test("Arguments are passed to a workSync callback", function(assert) {
	"use strict";
	var done = assert.async();
	var w = new WebWorker("test1-b.js");
	var value = Math.random();
	w.doWork("work", value).then(function(result) {
		assert.equal(result, value, "The value return should be the value we sent");
		w.terminate();
		done();
	});
});

QUnit.test("Nullable arguments are returned", function(assert) {
	"use strict";
	var done = assert.async();
	var w = new WebWorker("test1-b.js");
	w.doWork("work", 0).then(function(result) {
		assert.equal(result, 0, "The value return should be the value we sent");
		w.terminate();
		done();
	});
});

QUnit.test("Arguments are passed to a an async work callback", function(assert) {
	"use strict";
	var done = assert.async();
	var w = new WebWorker("test1-c.js");
	var value = Math.random();
	var startTime = new Date().getTime();
	w.doWork("work", value).then(function(result) {
		var elapsed = (new Date().getTime()) - startTime;
		assert.ok(elapsed > 300, "The callback was not called too early");
		assert.equal(result, value, "The value return should be the value we sent");
		w.terminate();
		done();
	});
});

var  testQueued  = function (testId, assert) {
	"use strict";
	var done = assert.async();
	var nbTasks = 10;
	var AlltaskPushed = false;
	var taskDone = [];
	var w = new WebWorker("test1-"+testId + ".js");
	var checkHandler = function(it) {
		taskDone.push(false);
		w.doWork("work", 0).then(function(result) {
			taskDone[it] = true;
			assert.ok(AlltaskPushed, "Call to doWork should not be blocking");
			for (var i = 0 ; i < nbTasks ; ++i) {
				if (i < it) {
					assert.ok(taskDone[i]);
				} else if (i === it) {
					taskDone[it] = true;
				} else {
					assert.notOk(taskDone[i]);
				}
			}
			if (it === nbTasks - 1) {
				w.terminate();
				done();
			}
		});
	};

	for (var i = 0 ; i < nbTasks ; ++i) {
		checkHandler(i);
	}
	AlltaskPushed = true;
};

QUnit.test("Tasks are queued (short Async Version)", function(assert) {
	"use strict";
	testQueued("c", assert);
});

QUnit.test("Tasks are queued (Long Sync Version)", function(assert) {
	"use strict";
	testQueued("b", assert);
});

QUnit.test("Progress funciton is working", function(assert) {
	"use strict";
	var w = new WebWorker("test1-d.js");
	var done = assert.async();
	var nbProgess = Math.round(Math.random()*19) + 1;
	var lastProgress = -1;
	var result = w.doWork("work", nbProgess, function progress(p) {
		assert.equal(p, lastProgress + 1, "Progress call are in order");
		lastProgress = p;
	});
	result.then(function(res) {
		assert.equal(res, nbProgess, "The number of progress was correctly passed to the worker");
		assert.equal(lastProgress, nbProgess - 1, "All the progress function were called");
		w.terminate();
		done();
	});
});

QUnit.test("Not setting a progress callback on a worker that send progress will not cause an exception", function(assert) {
	"use strict";
	var w = new WebWorker("test1-d.js");
	var done = assert.async();
	var nbProgess = Math.round(Math.random()*19) + 1;
	var result = w.doWork("work", nbProgess);
	result.then(function(res) {
		assert.equal(res, nbProgess, "The number of progress was correctly passed to the worker");
		w.terminate();
		done();
	});
});


QUnit.test("Terminating a worker", function(assert) {
	"use strict";
	var w = new WebWorker("test1-a.js");
	assert.notOk(w.state === "terminated", "a worker is not terminated when created");
	w.terminate();
	assert.equal(w.state, "terminated", "a worker state is updated after the terminated method()");
});

QUnit.test("Multiple methods in a single worker", function(assert) {
	"use strict";
	var w = new WebWorker("test1-e.js");
	var done = assert.async();
	Q.all([
		w.doWork("work2"),
		w.doWork("work3")
	]).then(function(results) {
		assert.equal(results[0], 19, "the second method should return 19");
		assert.equal(results[1], 42, "the third method should return 42");
		w.terminate();
		done();
	});
});

QUnit.test("Trying to create a worker pool without arguments throw an error" , function(assert) {
	"use strict";
	assert.throws(function() {
		new WorkerPool();
	});
	assert.throws(function() {
		new WorkerPool(1);
	});
});

QUnit.test("We can send batch to a worker pool", function(assert) {
	"use strict";
	var done = assert.async();
	var w = new WorkerPool(1, 5, "test1-b.js");
	var args = [];
	for (var i = 0 ; i < 100 ; ++i) {
		args.push(Math.random());
	}
	w.doWorkBatch("work", args).then(function(results) {
		assert.deepEqual(results, args, "The value return should be the value we sent");
		w.terminate();
		done();
	});
});

QUnit.test("We can send custom event to async jobs", function(assert) {
	"use strict";
	var done = assert.async();
	var data = Math.random();
	var w = new WebWorker("test1-f.js");
	var task1 = w .doWork("work");
	task1.then(function(result) {
		assert.equal(result, data, "the data should be the same as transmitted");
		done();
	});
	task1.sendEvent("event", data);
});

QUnit.test("We can send custom event to async jobs way after their creation", function(assert) {
	"use strict";
	var done = assert.async();
	var data = Math.random();
	var w = new WebWorker("test1-f.js");
	var task1 = w .doWork("work");
	task1.then(function(result) {
		assert.equal(result, data, "the data should be the same as transmitted");
		done();
	});
	setTimeout(function() {
		task1.sendEvent("event", data);
	}, 1000);
});

QUnit.test("Custom events are cleared between jobs", function(assert) {
	"use strict";
	var done = assert.async();
	var w = new WebWorker("test1-g.js");
	var w1 = w.doWork("work", 1);
	var w2 = w.doWork("work", 2);
	w1.sendEvent("event", 1);
	w2.sendEvent("event", 2);
	Q.all([w1, w2]).then(function(results) {
		assert.deepEqual(results, [[1, 1], [2,2]], "the data should be corretly passed");
		done();
	});
});

QUnit.test("We can send custom event to async jobs in a Worker Pool", function(assert) {
	"use strict";
	var done = assert.async();
	var pool = new WorkerPool(1, 2, "test1-h.js");
	var w1 = pool.doWork("work", 1);
	var w2 = pool.doWork("work", 2);
	var w3 = pool.doWork("work", 3);
	w1.sendEvent("event",1);
	w2.sendEvent("event",2);
	w3.sendEvent("event",3);

	Q.all([w1, w2, w3]).then(function(results) {
		assert.deepEqual(results, [[1,1], [2,2], [3,3]], "the events should be sent to the correct jobs");
		done();
	});

});


QUnit.test("Progress funciton is working in batch processing", function(assert) {
	"use strict";
	var w = new WorkerPool(3,3,"test1-d.js");
	var done = assert.async();
	var nbProgess = Math.round(Math.random()*19) + 1;
	var lastProgress = -1;
	var result = w.doWork("work", [nbProgess], function progress(p) {
		assert.equal(p, lastProgress + 1, "Progress call are in order");
		lastProgress = p;
	});
	result.then(function(res) {
		assert.equal(res[0], nbProgess, "The number of progress was correctly passed to the worker");
		assert.equal(lastProgress, nbProgess - 1, "All the progress function were called");
		done();
	});
});
