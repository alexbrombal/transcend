"use strict";

//@require /tools/tool1, /tools/tool2, /tools/tool4

//@if bar.baz == 2
aaaa
//@elseif foo == 2
bbbb
//@endif

var page1 = {

	something: function() {
		var longVariableName = "test";
		alert(longVariableName);
		// call ajax...
	}

};
