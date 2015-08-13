define([],{
	work : function(argument, callback, progress, registerEvents) {
		"use strict";
		var myEvent = function(data) {
			callback(null, [argument, data]);
		};
		registerEvents({
			"event": myEvent
		});
	},
});

