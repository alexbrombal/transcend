'use strict';


var fs = require('fs');
var path = require('path');
var uglify = require('uglify-js');

var Transcend = require('./transcend.core.js');

Transcend.setHandler('uglify', {

    finalize: function(file) {
        /**
         * @type {Transcend.File}
         */
        if(file.hidden()) return;

        var result;
        try {
            result = uglify.minify(file.absOutputPath);

        } catch(e) {
            // Uglify errors are output to the console
        }
        fs.writeFile(file.absOutputPath, result.code, 'utf8');
    }

});
