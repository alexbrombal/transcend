'use strict';

(function(module) {

    var fs = require('fs');
    var path = require('path');
    var os = require('os');
    var _ = require('underscore');

    function Transcend(options) {
        this.dir = options.dir || '.'+path.sep;
        this.cwd = process.cwd() + path.sep;
        this.absDir = path.normalize(this.cwd + this.dir + path.sep);
        this.output = options.output || 'build';
        this.absOutput = path.normalize(this.cwd + this.output + path.sep);
        this.args = options.args || {};
        this.configFile = this.args.config || 'transcend.json';

        if (!fs.existsSync(this.absDir)) {
            throw new Error(this.absDir + ' does not exist!');
        }

        this.files = {};
    }


    _.extend(Transcend.prototype, {

        /**
         * Processes the project directory.
         */
        process: function () {

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
                        throw new Error('Output directory could not be created');
                }
            }

            // Pull in the config file
            try {
                delete require.cache[this.absDir + this.configFile];
                this.config = require(this.absDir + this.configFile);
            } catch(e) {
                this.config = {};
            }
            _.extend(this.config, this.args);

            // Call initialize on all handlers
            for(var i in Transcend._handlers) {
                if(typeof Transcend._handlers[i].initialize === 'function')
                    Transcend._handlers[i].initialize.call(this);
            }

            // Read in all the files
            this._readDir(this.absDir);


            // Run "prepare" on all the files
            for(var directive in Transcend._handlers)
                this.ensurePrepared(directive);

            // Run "process" on all the non-hidden files
            for(var f in this.files)
            {
                var file = this.files[f];
                if(file.hidden()) continue;
                for(var directive in Transcend._handlers)
                {
                    var handler = Transcend._handlers[directive].process;
                    if(!handler) continue;
                    Transcend._handlers[directive].process.call(this, file);
                }
                for(var i in file.lines)
                {
                    var text = file.lines[i];
                    file.writeLine(text);
                }
            }
        },

        ensurePrepared: function(directive) {
            if(Transcend._handlers[directive] && Transcend._handlers[directive].prepare)
            {
                var handler = Transcend._handlers[directive].prepare;
                for(var f in this.files)
                {
                    var file = this.files[f];
                    if(file.prepared[directive]) continue;
                    file.prepared[directive] = true;
                    Transcend._handlers[directive].prepare.call(this, file);
                }
            }
        },

        reset: function() {
            for(var i in this.files)
            {
                this.files[i]._reset();
                delete this.files[i];
            }
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
        _readDir: function(dir)
        {
            var files = fs.readdirSync(dir);
            for(var i in files)
            {
                var item = files[i];
                var absItem = path.normalize(dir + path.sep + item);
                item = absItem.replace(this.absDir, path.sep);

                try {
                    var isFile = fs.statSync(absItem).isFile();
                } catch(e) {}

                if(isFile)
                {
                    if(item.substr(-3) !== '.js') continue;
                    this.files[item] = new Transcend.File(item, this);
                }
                else
                    this._readDir(absItem);
            }
        },


        // Utility functions.

        /**
         * Resolves a path against the watch folder, possibly by adding a '.js' extension or an underscore prefix.
         */
        resolvePath: function(cwd, p)
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
     * 'initialize' - Called once each time a build is about to occur.
     * 'process' - Called once for every writable file that contains at least one of this directive.
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
        this.directives = { };
        this.directiveLines = { };
        this.prepared = {};

        var contents = fs.readFileSync(this.absPath, 'utf8');
        this.lines = contents.split(contents.indexOf('\r\n') !== -1 ? '\r\n' : '\n');

        // We really want the properties above to be read-only, so this overwrites each property with a read-only version.
        // This overwriting is so that an IDE will do auto-complete properly (based on the assignments above).
        for(var i in this)
            Object.defineProperty(this, i, { value: this[i], writable: false, enumerable: false });

        for(var i in this.lines) {
            var line = this.lines[i];
            if(line.trim().indexOf('//@') === 0)
            {
                try {
                    this._addDirective(new Transcend.Directive(line, parseInt(i)+1));
                } catch(e) {}
            }
        }

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
         * Returns an array with all arguments of the specified directive type that appeared anywhere in the file.
         * @param {String} name
         * @return {Array}
         */
        directiveArgs: function(name) {
            var args = [],
                directives = this.directives[name] || [];
            for(var i in directives)
                args.push.apply(args, directives[i].args);
            return args;
        },

        hidden: function(hidden) {
            if(hidden !== undefined)
                this._hidden = !!hidden;
            return this._hidden === undefined ? path.basename(this.path)[0] === '_' : this._hidden;
        },

        writeLine: function(text) {
            if(typeof text === 'undefined') return;
            if(text.charCodeAt(0) === 65279) // Byte order mark
                text = text.substring(1);
            if(text.trim().indexOf('//@') === 0) return;
            var buf = new Buffer(text + os.EOL);
            fs.writeSync(this.fd, buf, 0, buf.length, null);
        },

        /**
         * @param {Transcend.Directive} directive
         * @private
         */
        _addDirective: function(directive) {
            this.directives[directive.name] = this.directives[directive.name] || [];
            this.directives[directive.name].push(directive);
            this.directiveLines[directive.lineNum-1] = directive;
        },

        _reset: function() {
            if(this._fd)
                try { fs.closeSync(this._fd); } catch(e) { }
        }
    });




    Transcend.Directive = function(line, lineNum)
    {
        this.text = line.trim();
        this.lineNum = parseInt(lineNum);
        var m = this.text.match(/@([^\s]+)(?:\s+(.*))?/);
        if(!m || m.length !== 3)
            throw new Error('Invalid directive');
        this.name = m[1];
        this.args = m[2] ? m[2].split(/\s*,\s*/) : [];
    };



    module.exports = Transcend;
})(module);
