define([],{
	work : function(argument, callback) {
		"use strict";
		setTimeout(function() {
			callback(null, argument); // no error
		}, 300);
	}
});

