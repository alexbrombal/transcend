'use strict';


var fs = require('fs');
var path = require('path');
var uglify = require('uglify-js');

var Transcend = require('./transcend.core.js');

Transcend.setHandler('uglify', {

    /**
     * @param {Transcend.File} file
     */
    finalize: function(file) {
        if(!this.config.uglify) return;
        var result;
        try {
            result = uglify.minify(file.absOutputPath);
        } catch(e) {
            console.log(e.message);
            console.log(e.stack);
            // Uglify errors are output to the console
        }
        fs.writeFile(file.absOutputPath, result.code, 'utf8');
    }

});
