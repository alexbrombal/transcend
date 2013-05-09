#!/usr/bin/env node

'use strict';


var fs = require('fs');
var path = require('path');

var Transcend = require('./transcend.core.js');
require('./transcend.require.js');
require('./transcend.uglify.js');
require('./transcend.if.js');
var vm = require('vm');

var _ = require('underscore');


var argv = require('optimist')
    .usage('Usage: transcend [--watch] [--minify] input-dir output-dir')
    .boolean(['watch', 'minify'])
    .check(function(argv) {
        if(!(argv._[0] && argv._[1])) throw "Both input and output directories are required.";
    })
    .argv;

try {

    var t = new Transcend({
        dir: argv._[0],
        output: argv._[1],
        args: argv
    });

    var processProject = function() {
        try {
            t.process();
            console.log('JavaScript processed successfully. ['+new Date().toISOString().replace(/T/, ' ').replace(/\..+/, '') +']');
        } catch(e) {
            console.log(e);
        };
        t.reset();
    };
    var processDelay = _.debounce(processProject, 500, false);

    if(argv.watch)
    {
        var watchDir = function(dir)
        {
            fs.watch(dir, processDelay);
            fs.readdirSync(dir).forEach(function(item, i, files)
            {
                item = path.normalize(dir + path.sep + item);
                if(fs.statSync(item).isDirectory())
                {
                    watchDir(item);
                }
            });
        };

        watchDir(t.absDir);
    }
    processProject();

} catch(e) {
    throw e;
    process.exit(1);
}

