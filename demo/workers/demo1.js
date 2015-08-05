define([], {
	workSync : function(args, progress) {
		var output = "";
		for (var i = 0 ; i < 100; ++i) {
			output += args;
			progress(i);
		}
		return output;
	}
});
