module.exports = function(grunt) {
  "use strict";

  grunt.initConfig({
    jshint: {
      files: ['Gruntfile.js', 'src/**/*.js', 'test/*.js'],
      options: {
	    strict : true, undef : true,
		curly : true,
		eqeqeq : true,
		maxcomplexity : 10,
		maxdepth : 3,
		browser : true,
		worker : true,
		qunit : true,

        globals: {
			Q : true,
			EventEmitter : true,
			module : true,
			console : true,
			WebWorker : true,
			define : true,
			PRODUCTION : true
        },
      }
    },
    watch: {
      files: ['<%= jshint.files %>'],
      tasks: ['build-dev']
    },
	connect : {
		server : {
			options : {
				port : 9999,
				base : "."
			}
		}
	},
	qunit : {
		all : {
			options : {
				urls : [
					"http://localhost:9999/test/test1.html"
				]
			}
		}
	},
	'saucelabs-qunit' : {
		all : {
			options : {
				username : "gpolecle",
				key : "0378d0f9-c37e-43e3-890b-7fd08234f41a",
				urls : [
					"http://localhost:9999/test/test1.html"
				],
				testname : "Main test of WebWorker on saucelabs",
				'max-duration' : 1000,
				browsers : [
					["Linux", "chrome", "dev"],
					["Linux", "firefox", "dev"],
					["Linux", "android", "4.4"],
					["Linux", "android", "5.1"],
					["Windows 10", "firefox", "39"],
					["Windows 10", "Internet Explorer", "11"],
					["Windows 7", "Internet Explorer", "10"],
					["OS X 10.11", "safari", "8.1"],
					["OS X 10.8", "safari", "6"],
				]
			}
		}
	},
	uglify : {
		build : {
			files : {
				"build/WebWorker.js" : ["src/WebWorker.js"],
				"build/workerCode.js" : ["src/workerCode.js"]
			},
			options : {
				compress : {
					drop_console : true
				}
			}
		},
		dev : {
			files : {
				"build/WebWorker.js" : ["src/WebWorker.js"],
				"build/workerCode.js" : ["src/workerCode.js"]
			},
			options : {
				sourceMap : true,
				sourceMapIncludeSources : true,
				beautify : true
			}
		}
	}
  });

  grunt.loadNpmTasks('grunt-contrib-jshint');
  grunt.loadNpmTasks('grunt-contrib-watch');
  grunt.loadNpmTasks('grunt-contrib-qunit');
  grunt.loadNpmTasks('grunt-contrib-connect');
  grunt.loadNpmTasks('grunt-saucelabs');
  grunt.loadNpmTasks('grunt-contrib-uglify');

  grunt.registerTask('default', ['jshint']);
  grunt.registerTask('test', ['build', 'connect', 'qunit']);
  grunt.registerTask('build-dev', ['jshint', 'uglify:dev']);
  grunt.registerTask('build', ['jshint', 'uglify:build']);
  grunt.registerTask('test-full', ['test', 'saucelabs-qunit']);

};
