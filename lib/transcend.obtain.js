'use strict';


var fs = require('fs');
var path = require('path');
require('./util.js');
var _ = require('underscore');

var Transcend = require('./transcend.core.js');

var code =
    'if(!window.obtain)' +
        '(function (global) {' +

            'var modules = {};' +

            'global.declare = function (name, module) {' +
                'if(!modules[name]) modules[name] = module;' +
            '};' +

            'global.obtain = function (module) {' +
                'if (!modules[module]) return undefined;' +
                'if (modules[module].constructor === Function && !modules[module].__obtained)' +
                    'modules[module] = modules[module](), modules[module].__obtained = true;' +
                'return modules[module];' +
            '};' +

        '})(window);';

Transcend.setHandler('module', {

    /**
     * @param {Transcend.File} file
     */
    prepare: function(file) {
        if(file.directives.module)
        {
            file.lines.unshift(";declare('"+file.path+"', function() {");
            file.lines.push('});');
        }
    }

});



