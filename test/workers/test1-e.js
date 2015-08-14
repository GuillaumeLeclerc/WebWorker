define([],{
	work : function(argument, callback) {
		"use strict";
		setTimeout(function() {
			callback(null, argument); // no error
		}, 300);
	},
	work2Sync : function(argument, callback) {
		"use strict";
		return 19;
	},
	work3 : function(argument, callback) {
		"use strict";
		setTimeout(callback, 10, null, 42);
	}
});

