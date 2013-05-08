"use strict";

    //@require /tools/tool1, /tools/tool2, /tools/tool4

//@if test == "a"
test == "a"
//@elseif test == "b"
test == "b"
//@elseif test == "c"
test == "c"
//@endif


var page1 = {

	something: function() {
		var longVariableName = "test";
		alert(longVariableName);
		// call ajax...
	}

};
