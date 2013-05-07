'use strict';

(function(module) {

    var fs = require('fs');
    var path = require('path');
    var os = require('os');
    var LineReader = require('./linereader.js');
    var _ = require('underscore');

    function Transcend(options) {
        this.dir = options.dir || '.'+path.sep;
        this.cwd = process.cwd() + path.sep;
        this.absDir = path.normalize(this.cwd + this.dir + path.sep);
        this.output = options.output || 'build';
        this.absOutput = path.normalize(this.cwd + this.output + path.sep);
        this.args = options.args || {};

        if (!fs.existsSync(this.absDir)) {
            throw new Error(this.absDir + ' does not exist!');
        }

        this.files = { _count: 0, _completed: 0 };
        Object.defineProperties(this.files, {
            _count: {
                value: 0,
                enumerable: false,
                writable: true
            },
            _completed: {
                value: 0,
                enumerable: false,
                writable: true
            }
        });
    }


    _.extend(Transcend.prototype, {

        /**
         * Processes the project directory. 'complete' is called when finished.
         * @param {Function} complete
         */
        process: function (complete) {

            // Verify the output dir exists and is writable
            try {
                fs.existsSync(this.absOutput);
                var fd = fs.openSync(this.absOutput + '.transcend', 'w');
                fs.closeSync(fd);
                fs.unlink(this.absOutput + '.transcend');
            } catch (e) {
                try {
                    fs.mkdirSync(this.absOutput);
                } catch (e) {
                    if(e.code !== 'EEXIST')
                        return complete.call(this, new Error('Output directory could not be created'));
                }
            }

            this._readDir(this.absDir, function()
            {
                for(var directive in Transcend._handlers)
                    try { this.ensurePrepared(directive); } catch(e) { return complete.call(this, e); }

                for(directive in Transcend._handlers)
                    try { this.ensureProcessed(directive); } catch(e) { return complete.call(this, e); }

                this._writeFiles(function() {
                    for(var directive in Transcend._handlers)
                        try { this.ensureFinalized(directive); } catch(e) { return complete.call(this, e); }

                    complete.call(this);
                });
            });
        },

        reset: function() {
            for(var i in this.files)
            {
                this.files[i]._reset();
                delete this.files[i];
            }
            this.files._count = 0;
            this.files._completed = 0;
            for(var directive in Transcend._handlers)
                if(Transcend._handlers[directive].reset) Transcend._handlers[directive].reset.call(this);
        },

        /**
         * Reads the specified directory recursively and populates this.files with all the directives.
         * Used internally and should not be called outside of this file.
         *
         * @param {String} dir
         * @param {Function} complete
         * @private
         */
        _readDir: function(dir, complete)
        {
            var _this = this;

            fs.readdirSync(dir).forEach(function(item, i, files)
            {
                var absItem = path.normalize(dir + path.sep + item);
                item = absItem.replace(_this.absDir, path.sep);

                try {
                    if(fs.statSync(absItem).isFile())
                    {
                        if(item.substr(-3) !== '.js') return;

                        _this.files._count++;

                        var f = new LineReader(absItem, function() {

                            var file = _this.files[item] = new Transcend.File(item, _this);

                            f.readLines(Infinity, function(line, lineNum) {
                                if(line.trim().indexOf('//@') === 0)
                                    file._addDirective(new Transcend.Directive(line, lineNum));
                            }, function() {
                                _this.files._completed++;
                                if(_this.files._completed === _this.files._count)
                                    complete.call(_this);
                            });
                        });
                    }
                    else
                        _this._readDir(absItem, complete);
                } catch(e) {}
            });
        },

        /**
         * Ensures that a specified directive is prepared. This should only be called from another
         * directive's "prepare" callback.  Care should be taken to avoid circular dependencies.
         * @param {String} directive
         */
        ensurePrepared: function(directive)
        {
            for(var f in this.files)
            {
                if(this.files[f]._directives[directive] &&
                    !this.files[f]._directives[directive].prepare)
                {
                    var r = this._runHandler(this.files[f], directive, 'prepare');
                    if(r === false) this.files[f].hidden(true);
                }
            }
        },

        /**
         * Ensures that a specified directive is processed. This should only be called from another
         * directive's "process" callback.
         * @param {String} directive
         */
        ensureProcessed: function(directive)
        {
            for(var f in this.files)
            {
                if(!this.files[f].hidden() &&
                    this.files[f]._directives[directive] &&
                    !this.files[f]._directives[directive].process)
                {
                    this._runHandler(this.files[f], directive, 'process');
                }
            }
        },

        /**
         * Ensures that a specified directive is finalized. This should only be called from another
         * directive's "finalize" callback.
         * @param {String} directive
         */
        ensureFinalized: function(directive)
        {
            for(var f in this.files)
            {
                if(!this.files[f].hidden() &&
                    this.files[f]._directives[directive] &&
                    !this.files[f]._directives[directive].finalize)
                {
                    this._runHandler(this.files[f], directive, 'finalize');
                }
            }
        },

        /**
         * @param {Transcend.File} file
         * @param {String} directive
         * @param {String} stage
         * @param {Array} args
         * @private
         */
        _runHandler: function(file, directive, stage, args)
        {
            if(Transcend._handlers[directive] &&
                Transcend._handlers[directive][stage] &&
                file._directives[directive])
            {
                file._directives[directive][stage] = true;
                args = args || [];
                args.unshift(file);
                return Transcend._handlers[directive][stage].apply(this, args);
            }
        },


        /**
         * Loops through each writable source file and writes it to the corresponding output file.
         * @param {Function} callback
         * @private
         */
        _writeFiles: function(callback)
        {
            var completed = 0,
                count = 0,
                _this = this,

                lineReaderReady = function(file, err) {
                    // Pass the current file as the first parameter to the callbacks
                    this.readLines(Infinity, handleLine.curry(file), lineReaderComplete.curry(file));
                },

                /**
                 * @param {Transcend.File} file
                 * @param {String} text
                 * @param {Number} lineNum
                 * @param {Number} localLineNum
                 * @param {LineReader} lineReader
                 */
                handleLine = function(file, text, lineNum, localLineNum, lineReader) {
                    var r = true;

                    for(var directive in Transcend._handlers)
                        r = (_this._runHandler(file, directive, 'eachLine', [text, lineNum]) !== false) && r;

                    if(r !== false && text.indexOf('//@') !== 0)
                    {
                        if(text.charCodeAt(0) === 65279) // Byte order mark
                            text = text.substring(1);
                        var buf = new Buffer(text + os.EOL);
                        fs.writeSync(file.fd, buf, 0, buf.length, null);
                    }
                },

                lineReaderComplete = function(file) {
                    completed++;
                    if(completed === count)
                        callback.call(_this);
                };

            this.files._completed = 0;
            for(var f in this.files)
            {
                /**
                 * @type {Transcend.File}
                 */
                var file = this.files[f];
                if(file.hidden()) continue;

                count++;

                // Pass the current file as the first parameter to the 'ready' callback.
                var l = new LineReader(file.absPath, lineReaderReady.curry(file));
            }
        },



        // Utility functions.

        /**
         * Resolves a path against the watch folder, possibly by adding a '.js' extension or an underscore prefix.
         */
        _resolvePath: function(cwd, p)
        {
            cwd = path.normalize(cwd);
            p = path.normalize(p);

            if(p[0] === path.sep) cwd = '';
            cwd += path.sep;

            var test;
            try {
                test = path.normalize(this.absDir + cwd + path.dirname(p) + path.sep + path.basename(p).replace(/^_/, '').replace(/\.js$/, '') + '.js');
                if(test.replace(this.absDir, path.sep) in this.files) return test.replace(this.absDir, path.sep);
                else if(fs.existsSync(test)) return test;
            } catch(e) { }

            try {
                test = path.normalize(this.absDir + cwd + path.dirname(p) + path.sep + '_' + path.basename(p).replace(/^_/, '').replace(/\.js$/, '') + '.js');
                if(test.replace(this.absDir, path.sep) in this.files) return test.replace(this.absDir, path.sep);
                else if(fs.existsSync(test)) return test;
            } catch(e) { }
        }

    });



    /**
     * Handlers are a set of callbacks that process directives at various stages in the
     * compilation lifecycle.  These stages are as follows:
     * 'prepare' - Called once for every file that contains at least one of the given directive. Returning false from this function will cause the file to be hidden.
     * 'process' - Called once for every writable file that contains at least one of this directive. The file handle is open and ready for writing.
     * 'eachLine' - Called once per line in every file that contains at least one of this directive. Returning false from this will prevent the line from being written to the output file.
     * 'finalize' - Called once for every file that contains at least one of this directive.
     */
    Transcend.setHandler = function(directive, callbacks) {
        Transcend._handlers = Transcend._handlers || {};
        Transcend._handlers[directive] = callbacks;
    };




    /**
     * @param {String} filePath
     * @param {Transcend} transcend
     * @private
     * @constructor
     */
    Transcend.File = function(filePath, transcend) {

        this.transcend = transcend;
        this.path = filePath;
        this.absPath = path.normalize(transcend.absDir + filePath);
        this.absOutputPath = path.normalize(transcend.absOutput + filePath);
        this.data = {};
        this._directives = { _lines: {} };

        // We really want the properties above to be read-only, so this overwrites each property with a read-only version.
        // This overwriting is so that an IDE will do auto-complete properly (based on the assignments above).
        for(var i in this)
            Object.defineProperty(this, i, { value: this[i], writable: false, enumerable: false });

        this.fd = null;
        this._fd = null;
        Object.defineProperty(this, 'fd', {
            get: function() {
                if(this._fd) return this._fd;

                if(!this.hidden())
                {
                    try {
                        fs.mkdirSync(path.dirname(this.absOutputPath));
                    } catch(e) { }

                    try {
                        return this._fd = fs.openSync(this.absOutputPath, 'w');
                    } catch(e) { throw new Error('Output file '+this.absPath+' could not be created!'); }
                }
            }
        });

        this._hidden = undefined;

        Object.seal(this);
    };


    _.extend(Transcend.File.prototype, {

        /**
         * If name is not given, returns an array of all Transcend.Directive objects that appeared in this file.
         * If name is given, returns an array of all Transcend.Directive objects of the type specified.
         * @param {String} name
         * @returns {Array}
         */
        directives: function(name) {
            if(name === undefined)
                return _.values(this._directives._lines);
            else
                return this._directives[name] || [];
        },

        /**
         * Returns an array with all arguments of the specified directive type that appeared anywhere in the file.
         * @param {String} name
         * @return {Array}
         */
        directiveArgs: function(name) {
            var args = [],
                directives = this.directives(name);
            for(var i in directives)
                args.push.apply(args, directives[i].args);
            return args;
        },

        hidden: function(hidden) {
            if(hidden !== undefined)
                this._hidden = !!hidden;
            return this._hidden === undefined ? path.basename(this.path)[0] === '_' : this._hidden;
        },

        /**
         * @param {Transcend.Directive} directive
         * @private
         */
        _addDirective: function(directive) {
            this._directives[directive.name] = this._directives[directive.name] || [];
            this._directives[directive.name].push(directive);
            this._directives._lines[directive.lineNum] = directive;
        },

        _reset: function() {
            if(this._fd)
                try { fs.closeSync(this._fd); } catch(e) { }
        }
    });




    Transcend.Directive = function(line, lineNum)
    {
        this.text = line.trim();
        this.lineNum = lineNum;
        var m = this.text.match(/@([^\s]+)(?:\s+(.*))?/);
        this.name = m[1];
        this.args = m[2] ? m[2].split(/\s*,\s*/) : [];
    };



    module.exports = Transcend;
})(module);
