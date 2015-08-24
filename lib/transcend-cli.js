#!/usr/bin/env node

'use strict';

var path = require('path');
var dateFormat = require('dateformat');
var _ = require('underscore');
var watchr = require('watchr');
var yargs = require('yargs');
require('colors');

var transcend = require('./transcend.js');

var app = {

    project: null,

    run: function() {
        try
        {
            process.title = 'transcend';

            var argv = yargs
                .usage('Usage: $0 <command> [options]')
                .config('config', 'Specifies an alternate configuration file')
                .default('config', 'transcend.json')
                .demand(1, '')
                .command('watch', 'Watches the directory and recompiles when changes occur.')
                .command('compile', 'Does a one-shot compilation of the directory.')
                .argv;

            var configFile = path.normalize(process.cwd() + path.sep + argv.config);
            transcend.log('Loaded config file:'.green + '\n' + configFile.white);

            app.project = new transcend.Project(configFile, _.omit(argv, '_', 'config', '$0'));

            app.compileProjectDebounced = _.debounce(app.compileProject, 100, false);

            if (app.commands[argv._[0]])
                app.commands[argv._[0]]();
            else
                yargs.showHelp();
        }
        catch(e)
        {
            transcend.log('Error initializing Transcend:'.red + '\n' + e.message.white);
        }
    },

    compileProject: function() {
        try {
            app.project.compile();
        } catch(e) {
            transcend.log('Error: \n'.red + e.message);
        }
        app.project.reset();
    },

    compileProjectDebounced: null,

    commands: {

        compile: function() {
            transcend.log('Transcend is running...'.green);
            app.compileProject();
            transcend.log('Done!'.green);
        },

        watch: function() {
            transcend.log('Transcend is watching for changes.'.green, 'Press ctrl-C to stop.'.red);

            watchr.watch({
                paths: app.project.input,
                listeners: {
                    log: function(logLevel) {
                    },
                    error: function (err) {
                        transcend.log('File watch error:'.red + '\n' + err);
                    },
                    watching: function(err, watcher, isWatching) {
                    },
                    change: function(changeType, filePath, fileCurrentStat, filePreviousStat) {
                        transcend.log(
                            'Detected change in '.yellow +
                            filePath.replace(app.project.input + '/', '').white +
                            ', recompiling '.yellow +
                            ('[' + dateFormat(new Date(), 'yyyy-mm-dd hh:MM:ss TT') + ']').green
                        );
                        app.compileProjectDebounced();
                    }
                },
                next: function(err, watchers) {
                    app.compileProject();
                }
            });
        }

    }

};

app.run();
