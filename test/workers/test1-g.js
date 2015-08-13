var eventCalls = 0;
define([],{
	work : function(argument, callback, progress, registerEvents) {
		"use strict";
		var myEvent = function(data) {
			eventCalls++;
			callback(null, [eventCalls, data]);
		};
		registerEvents({
			"event": myEvent
		});
	},
});

