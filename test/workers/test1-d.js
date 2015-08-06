define([],{
	workSync : function(argument, progress) {
		"use strict";
		for (var i = 0 ; i < argument; ++i) {
			progress(i);
		}
		return argument;
	}
});

