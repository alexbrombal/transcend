'use strict';


var fs = require('fs');
var path = require('path');
require('./util.js');
var _ = require('underscore');

var Transcend = require('./transcend.core.js');


/**
 * This callback is used by both require & master directives.
 * @param {Transcend.File} file
 */
var includeDependencies = function(file) {
    // Keep track of which files I've been run on. I can only run once per file
    // (even though I get called for both @require and @master directives).
    includeDependencies.files = includeDependencies.files || {};
    if(includeDependencies.files[file.path]) return;
    includeDependencies.files[file.path] = true;

    var deps = file.data.dependencies;
    for(var d in deps)
    {
        var prefix = new Buffer('/***** Required '+deps[d]+' *****/\n', 'utf8');
        fs.writeSync(file.fd, prefix, 0, prefix.length, null);

        var buffer = fs.readFileSync(path.normalize(this.absDir + deps[d]));
        fs.writeSync(file.fd, buffer, 0, buffer.length, null);

        var postfix = new Buffer('\n/***** Ending '+deps[d]+' *****/\n\n', 'utf8');
        fs.writeSync(file.fd, postfix, 0, postfix.length, null);
    }
};


// Create 'require' and 'master' directives.

Transcend.setHandler('require', {

    /**
     * @param {Transcend.File} file
     */
    prepare: function(file) {
        file.data.dependencies = this.getDependencies(file);
    },

    process: includeDependencies,

    eachLine: function(file, line, num) {
    },

    finalize: function(file) {
    }

});

Transcend.setHandler('master', {

    /**
     * @param {Transcend.File} file
     */
    prepare: function(file) {
        this.ensurePrepared('require');

        var deps = [],
            sources = file.directiveArgs('master').map(function(item) {
                var p = this.files[this._resolvePath(path.dirname(file.path), item)];
                if(!p) throw new Error('@import argument '+item+' could not be resolved.');
                return p;
            }.bind(this));

        // deps is an array of arrays, with each child array being the dependencies of the master sources
        for(var i in sources)
            deps.push(sources[i].data.dependencies);

        // master dependencies is the intersection of all the source dependencies
        file.data.master = _.intersection.apply(_, deps);
        file.data.dependencies = file.data.dependencies || [];
        file.data.dependencies.push.apply(file.data.dependencies, file.data.master);
        file.data.dependencies = _.unique(file.data.dependencies);

        for(var i in sources)
            sources[i].data.dependencies = _.difference(sources[i].data.dependencies, file.data.dependencies);
    },

    process: includeDependencies,

    eachLine: function(file, line, num) {
    },

    finalize: function(file) {
    },

    reset: function() {
        includeDependencies.files = {};
    }

});


/**
 * @param {Transcend.File} file
 * @param {Object} _processed
 * @return {Array}
 */
Transcend.prototype.getDependencies = function(file, _processed) {
    var deps = file.data.dependencies || [];
    if(deps.length) return deps;
    var args = file.directiveArgs('require').map(function(item) { return this._resolvePath(path.dirname(file.path), item); }.bind(this));
    _processed = _processed || {};
    _processed[file.path] = true;
    for(var i in args)
    {
        if(!_processed[args[i]]) deps.push.apply(deps, this.getDependencies(this.files[args[i]], _processed));
        deps.push(args[i]);
    }
    deps = _.unique(deps);
    deps.remove(deps.indexOf(file));
    return file.data.dependencies = deps;
};
