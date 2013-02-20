'use strict';


var fs = require('fs');
var path = require('path');
var uglify = require('uglify-js');

var Transcend = require('./transcend.core.js');

Transcend.setHandler('uglify', {

    /**
     * @param {Transcend.File} file
     */
    prepare: function(file) {
    },

    process: function() { },

    eachLine: function(file, line, num) {
    },

    finalize: function(file) {
        /**
         * @type {Transcend.File}
         */
        if(file.hidden()) return;

        var result = uglify.minify(file.absOutputPath);
        fs.writeFile(file.absOutputPath, result.code, 'utf8');
    }

});
