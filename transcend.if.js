'use strict';


var fs = require('fs');
var path = require('path');
require('./util.js');
var _ = require('underscore');

var Transcend = require('./transcend.core.js');

var If = {};

Transcend.setHandler('if', {

    initialize: function() {
        If.script = '';
        for(var i in this.config) If.script += 'var '+i+' = '+JSON.stringify(this.config[i])+';';
    },

    /**
     * @param {Transcend.File} file
     */
    prepare: function(file) {
        for(var i in file.lines)
        {
            var directive = file.directiveLines[i];

            if(directive && (directive.name == 'if' || directive.name == 'elseif'))
            {
                try {
                    file.data.ifTest = !!eval(If.script + directive.args[0]);
                } catch(e) {
                    throw new Error('Error evaluating expression: ' + e.message + ' in ' + file.path + ':' + (parseInt(i)+1));
                }
            }
            else if(directive && directive.name == 'else')
            {
                file.data.ifTest = !file.data.ifTest;
            }
            else if(directive && directive.name == 'endif')
            {
                file.data.ifTest = undefined;
            }
            else
            {
                if(file.data.ifTest === false)
                    delete file.lines[i];
            }
        }
    }

});



