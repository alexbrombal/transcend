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
                If.mode = 'if';
                if(!If.script) {
                    If.script = '';
                    for(var i in this.args) If.script += 'var '+i+' = '+JSON.stringify(this.args[i])+';';
                }
                If.test = eval(If.script + directive.args[0]);
            }
        }
        else if(directiveText == 'else')
        {
            If.mode = 'else';
        }
        else if(directiveText == 'endif')
        {
            If.mode = '';
        }
        else
        {
            if(If.mode == 'if') return If.test;
            if(If.mode == 'else') return !If.test;
        }
    },

    finalize: function(file) {
    }

});



