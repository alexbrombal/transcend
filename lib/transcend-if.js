'use strict';

var _ = require('underscore');

var If = {};

module.exports = {

    if: {

        initialize: function() {
            If.script = '';
            for(var i in this.config) If.script += 'var '+i+' = '+JSON.stringify(this.config[i])+';';
        },

        /**
         * @param {File} file
         */
        prepare: function(file) {
            for(var i in file.lines)
            {
                var directive =
                    (file.directives.if || [])[i] ||
                    (file.directives.else || [])[i] ||
                    (file.directives.elseif || [])[i] ||
                    (file.directives.endif || [])[i];

                if(directive && (directive.keyword == 'if' || directive.keyword == 'elseif'))
                {
                    try {
                        file.data.ifTest = !!eval(If.script + directive.args);
                    } catch(e) {
                        throw new Error('Error evaluating expression: ' + e.message + ' in ' + file.path + ':' + (parseInt(i)+1));
                    }
                }
                else if(directive && directive.keyword == 'else')
                {
                    file.data.ifTest = !file.data.ifTest;
                }
                else if(directive && directive.keyword == 'endif')
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
    }

};

