WebWorker.libPath = "./src/";
WebWorker.workersPath = "../workers/";

function start() {
	new WebWorker("demo1.js")
		.doWork("hello", console.log.bind(console, "progress : "))
		.then(function(value) {
			console.log(value);
		});
}
