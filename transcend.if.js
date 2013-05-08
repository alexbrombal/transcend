'use strict';


var fs = require('fs');
var path = require('path');
var os = require('os');
require('./util.js');
var _ = require('underscore');

var Transcend = require('./transcend.core.js');

var If = {
    mode: ''
};

Transcend.setHandler('if', {

    initialize: function() {
        If.script = '';
        for(var i in this.config) If.script += 'var '+i+' = '+JSON.stringify(this.config[i])+';';
    },

    /**
     * @param {Transcend.File} file
     */
    prepare: function(file) {
    },

    process: function() {

    },

    eachLine: function(file, line, num) {
        var directiveText = (line.match(/^\s*\/\/@(if|else|elseif|endif)\b/) || ['',''])[1];
        if(directiveText == 'if' || directiveText == 'elseif')
        {
            var directive = _.find(file.directives(directiveText), function(directive) { return directive.lineNum == num; });
            if(directive) {
                file.data.ifMode = 'if';
                file.data.ifTest = eval(If.script + directive.args[0]);
            }
        }
        else if(directiveText == 'else')
        {
            file.data.ifMode = 'else';
        }
        else if(directiveText == 'endif')
        {
            file.data.ifMode = '';
        }
        else
        {
            if(file.data.ifMode == 'if') return file.data.ifTest;
            if(file.data.ifMode == 'else') return !file.data.ifTest;
        }
    },

    finalize: function(file) {
    }

});



