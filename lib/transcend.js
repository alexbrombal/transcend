'use strict';

(function(module) {

    var fs = require('fs');
    var path = require('path');
    var os = require('os');
    var _ = require('underscore');
    var util = require('util');

    var phases = {
        initialize: { allFiles: false, includeHidden: false },
        prepare: { allFiles: true, includeHidden: true },
        allPrepared: { allFiles: false, includeHidden: false },
        process: { allFiles: true, includeHidden: false },
        allProcessed: { allFiles: false, includeHidden: false },
        complete: { allFiles: true, includeHidden: false },
        allCompleted: { allFiles: false, includeHidden: false },
        reset: { allFiles: false, includeHidden: false }
    };



    function Project(cwd, config) {

        // Store the original options
        this.config = config;

        if (!config.output)
            throw new Error('Please specify a "output" property in your config file!');
        if (!config.input)
            throw new Error('Please specify in "input" property in your config file!');

        // Normalize paths in the config
        this.cwd = path.dirname(path.normalize(cwd));
        this.output = path.normalize(this.cwd + path.sep + config.output);
        this.input = path.normalize(this.cwd + path.sep + config.input);

        this.files = {};

        // Load available directives

        this._directives = {};

        _.extend(this._directives, require('./transcend-require.js'));
        _.extend(this._directives, require('./transcend-if.js'));

        for (var d in this._directives)
            this._directives[d].__phaseComplete = {};

        /*
        var cp = require('child_process');
        var exts = _.filter(
            _.keys(
                _.extend(
                    JSON.parse(cp.execSync('npm ls -g --depth=0 --json')).dependencies,
                    JSON.parse(cp.execSync('npm ls --depth=0 --json')).dependencies
                )
            ),
            function(value) {
                return value.indexOf('transcend-') === 0;
            }
        );
        */
    };

    _.extend(Project.prototype, {

        /**
         * Processes the project directory.
         *
         * 'initialize' - Fired once when processing begins
         * 'prepare' - Fired once for each File object
         * 'all-prepared' - Fired once when all File objects have been prepared
         * 'process' - Fired once for each non-hidden File object
         * The file's .lines property is written out to the file at this point.
         * 'all-processed' - Fired once when all File objects have been processed
         * 'complete' - Fired once for each non-hidden File object
         * 'all-completed' - Fired once when processing completes
         */
        compile: function () {

            // Verify the input directory exists
            if (!fs.existsSync(this.input) || !fs.statSync(this.input).isDirectory())
                throw new Error('Input directory ' + this.input + ' does not exist or is not a directory!');

            // Verify the output dir exists and is writable
            try {
                fs.existsSync(this.output);
                var fd = fs.openSync(this.output + '/.transcend', 'w');
                fs.closeSync(fd);
                fs.unlink(this.output + '/.transcend');
            } catch (e) {
                try {
                    fs.mkdirSync(this.output);
                } catch (e) {
                    if(e.code !== 'EEXIST')
                        throw new Error('Unable to create output directory: ' + this.output + '\nMessage: ' + e.message);
                }
            }

            // Call 'initialize' once
            this.doPhase('initialize');

            // Read in all the files
            this._readDir(this.input);

            // Run "prepare" on all the files
            this.doPhase('prepare');

            // Run "allProcessed" once
            this.doPhase('allPrepared');

            // Run "process" on all the non-hidden files
            this.doPhase('process');

            // Run "allProcessed" once
            this.doPhase('allProcessed');

            // Write the files' contents
            _.each(this.files, function(file) {
                if(file.hidden())
                    return;
                file._writeLine(file.lines);
            });

            // Run "finalize" on all the non-hidden files
            this.doPhase('complete');

            // Run "allCompleted" once
            this.doPhase('allCompleted');
        },

        doPhase: function(phaseName, directiveName)
        {
            var phase = phases[phaseName];
            if (!phase)
                throw new Error('Invalid phase requested: ' + phaseName);

            var doPhaseForDirective = function(directive) {
                if (!directive || !directive[phaseName] || typeof directive[phaseName] !== 'function')
                    return;

                if (directive.__phaseComplete[phaseName]) return;
                directive.__phaseComplete[phaseName] = true;

                if (phase.allFiles) {
                    _.each(this.files, function (file) {
                        if (phase.includeHidden || !file.hidden())
                            directive[phaseName].call(this, file);
                    }.bind(this));
                }
                else {
                    directive[phaseName].call(this);
                }
            }.bind(this);

            if (!directiveName)
                _.each(this._directives, doPhaseForDirective);
            else
                doPhaseForDirective(this._directives[directiveName]);
        },

        reset: function() {
            for(var i in this.files)
                this.files[i]._reset();
            this.files = {};

            for (var d in this._directives)
                this._directives[d].__phaseComplete = {};

            this.doPhase('reset');
        },

        /**
         * Reads the specified directory recursively and populates this.files with all the directives.
         * Used internally and should not be called outside of this file.
         *
         * @param {String} dir
         * @param {Function} complete
         * @private
         */
        _readDir: function(dir)
        {
            var files = fs.readdirSync(dir);
            for(var i in files)
            {
                var item = files[i];
                var absItem = path.normalize(dir + path.sep + item);
                item = absItem.replace(this.input + '/', '');

                var isFile = false;
                try {
                    isFile = fs.statSync(absItem).isFile();
                } catch(e) {}

                if(isFile)
                {
                    if(item.substr(-3) !== '.js') continue;
                    this.files[item] = new File(item, this);
                }
                else
                    this._readDir(absItem);
            }
        }

    });




    /**
     * A File object represents a file from the input directory.
     *
     * - .project - The Project instance to which this File belongs.
     * - .path - The file path relative to the Project's input directory
     * - .absInput - The absolute input file path
     * - .absOutput - The absolute output file path
     * - .data - An map that can be used by directives to collect information during the various processing phases
     * - .directives - A map of Directive objects, grouped by keyword and line number
     * - .lines - An array of strings, containing each line of the file as it will be written to the output file
     * - .fd - The file descriptor for the output file
     * - .hidden([hidden]) - Gets or sets whether this file is hidden from output. By default, this is determined by
     *     whether any part of the path begins with a '_', but it can be overridden by a directive.
     * - .resolvePath(filepath) - Given a path, locates another File object relative to this File's location.
     *
     * @param {String} filePath
     * @param {Project} project
     * @constructor
     */
    function File(filePath, project) {

        filePath = path.normalize(filePath).replace(/^\//, '');

        this.project = project;
        this.path = filePath;
        this.absInput = path.normalize(project.input + '/' + filePath);
        this.absOutput = path.normalize(project.output + '/' +filePath);
        this.data = {};
        this.directives = { };

        var contents = fs.readFileSync(this.absInput, 'utf8');
        this.lines = contents.split(/\r?\n/);

        // We really want the properties above to be read-only, so this overwrites each property with a read-only version.
        // This overwriting is so that an IDE will do auto-complete properly (based on the assignments above).
        for(var i in this)
            Object.defineProperty(this, i, { value: this[i], writable: false, enumerable: false });

        _.each(this.lines, function(line, i) {
            if(line.trim().indexOf('//@') === 0)
                this._addDirective(new Directive(line, i, this));
        }.bind(this));

        this.fd = null;
        this._fd = null;
        Object.defineProperty(this, 'fd', {
            get: function() {
                if(this._fd) return this._fd;

                if(!this.hidden())
                {
                    try {
                        fs.mkdirSync(path.dirname(this.absOutput));
                    } catch(e) { }

                    try {
                        return this._fd = fs.openSync(this.absOutput, 'w');
                    } catch(e) { throw new Error('Output file ' + this.absOutput + ' could not be created!'); }
                }
            }
        });

        this._hidden = undefined;

        Object.seal(this);
    };

    _.extend(File.prototype, {

        hidden: function(hidden) {
            if(hidden !== undefined)
                this._hidden = !!hidden;
            return this._hidden === undefined ? _.any(this.path.split('/'), function(segment) { return segment[0] == '_'; }) : this._hidden;
        },

        /**
         * Resolves "filepath" relative to this file's location, and returns the associated File object.
         * If filepath begins with a slash, resolves the path relative to the Project's "input" path property.
         * Every directory segment in filepath is also checked for an directory beginning with an underscore.
         * If the filepath does not end with a file extension, ".js" will automatically be added.
         */
        resolvePath: function(filepath) {
            // Add .js extension if there is none
            if (!filepath.match(/\.[^\.\/]+$/))
                filepath += '.js';

            // Get the base directory; the Project's input path if filepath starts with '/',
            // otherwise this File's directory
            var base = path.dirname(this.absInput);
            if (filepath[0] == '/')
                base = this.project.input;

            // Remove the starting slash if necessary (we already have the base path)
            filepath = filepath.replace(/^\//, '');

            // 'tries' contains an array of paths to try; each directory segment is prepended with '_'.
            var tries = _.filter(
                [ filepath ].concat(
                    _.map(filepath.split('/'), function(segment, i, segments) {
                        if (segment == '.' || segment == '..' || segment[0] == '_')
                            return '';
                        var s = segments.slice(); // clone
                        s[i] = '_' + segment;
                        return s.join('/');
                    })
                )
            );

            // Find the first path that actually exists, relative to the base directory
            var existingPath = _.find(tries, function(trypath) {
                return fs.existsSync(path.normalize(base + '/' + trypath));
            });

            // Get the path relative to Project's base input directory
            existingPath = path.normalize(base + '/' + existingPath).replace(this.project.input + '/', '');

            // Return the actual File object
            return this.project.files[existingPath];
        },

        _writeLine: function(text) {
            if(typeof text === 'undefined') return;

            if (text.constructor === Array)
            {
                _.each(text, this._writeLine.bind(this));
                return;
            }

            if (text.constructor !== String)
                return;

            if(text.charCodeAt(0) === 65279) // Byte order mark
                text = text.substring(1);
            if(text.trim().indexOf('//@') === 0) return;
            var buf = new Buffer(text + os.EOL);
            fs.writeSync(this.fd, buf, 0, buf.length, null);
        },

        /**
         * @param {Directive} directive
         * @private
         */
        _addDirective: function(directive) {
            this.directives[directive.keyword] = this.directives[directive.keyword] || {};
            this.directives[directive.keyword][directive.lineNum] = directive;
        },

        _reset: function() {
            if(this._fd)
                try { fs.closeSync(this._fd); } catch(e) { }
        },

        inspect: function() {
            return '{ path: "' + this.path + '" }';
        }
    });

    /**
     * A Directive represents a line in a file that contains a directive and its optional arguments. It also contains
     * information about the File it was contained in and the line number where it appeared. The containing File object
     * also keeps a reference to the Directive objects contained within it.
     *
     * Properties:
     * - .text - The full text of the directive line
     * - .file - The File object that contains this Directive
     * - .lineNum - The line number on which this directive appeared
     * - .keyword - The directive keyword (e.g. 'require', 'parent', etc)
     * - .args - The argument string that followed the keyword
     *
     * @param line
     * @param lineNum
     * @param {File} file
     * @constructor
     */
    function Directive(line, lineNum, file)
    {
        this.text = line.trim();
        this.file = file;
        this.lineNum = parseInt(lineNum);
        var parts = this.text.match(/@([^\s]+)(.*)?/);
        if(!parts || parts.length !== 3)
            throw new Error('Invalid directive');
        this.keyword = parts[1];
        this.args = (parts[2] || '').trim();
    };




    function log() {
        var args = _.toArray(arguments);
        args = _.map(args, function(a) {
            a = a || '';
            return (a.constructor === String ? a : util.inspect(a)).replace('\n', '\n      ');
        });
        args.unshift('>>>'.white);
        console.log.apply(this, args);
    };



    module.exports = {
        Project: Project,
        File: File,
        Directive: Directive,
        log: log
    };
})(module);
