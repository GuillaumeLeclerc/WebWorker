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

WebWorker.libPath = "./lib/";
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
		done();
	});
});

QUnit.test("Simple worker with not arguments ", function(assert) {
	"use strict";
	var done = assert.async();
	var w = new WebWorker("test1-a.js");
	w.doWork().then(function(result) {
		assert.equal(result, 2, "The result from the worker should be 2");
		done();
	});
});

QUnit.test("Arguments are passed to a workSync callback", function(assert) {
	"use strict";
	var done = assert.async();
	var w = new WebWorker("test1-b.js");
	var value = Math.random();
	w.doWork(value).then(function(result) {
		assert.equal(result, value, "The value return should be the value we sent");
		done();
	});
});

QUnit.test("Nullable arguments are returned", function(assert) {
	"use strict";
	var done = assert.async();
	var w = new WebWorker("test1-b.js");
	w.doWork(0).then(function(result) {
		assert.equal(result, 0, "The value return should be the value we sent");
		done();
	});
});

QUnit.test("Arguments are passed to a an async work callback", function(assert) {
	"use strict";
	var done = assert.async();
	var w = new WebWorker("test1-c.js");
	var value = Math.random();
	var startTime = new Date().getTime();
	w.doWork(value).then(function(result) {
		var elapsed = (new Date().getTime()) - startTime;
		assert.ok(elapsed > 300, "The callback was not called too early");
		assert.equal(result, value, "The value return should be the value we sent");
		done();
	});
});

function testQueued (testId, assert) {
	"use strict";
	var done = assert.async();
	var nbTasks = 10;
	var AlltaskPushed = false;
	var taskDone = [];
	var w = new WebWorker("test1-"+testId + ".js");
	for (var i = 0 ; i < nbTasks ; ++i) {
		(function (it) {
			taskDone.push(false);
			w.doWork(0).then(function(result) {
				taskDone[it] = true;
				assert.ok(AlltaskPushed, "Call to doWork should not be blocking");
				for (var i = 0 ; i < nbTasks ; ++i) {
					if (i < it) {
						assert.ok(taskDone[i]);
					} else if (i == it) {
						taskDone[it] = true;
					} else {
						assert.notOk(taskDone[i]);
					}
				}
				if (it == nbTasks - 1) {
					done();
				}
			});
		})(i);
	}
	AlltaskPushed = true;
}

QUnit.test("Tasks are queued (short Async Version)", testQueued.bind(null, "c"));

QUnit.test("Tasks are queued (short Sync Version)", testQueued.bind(null, "b"));


