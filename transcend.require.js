'use strict';


var fs = require('fs');
var path = require('path');
var os = require('os');
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
    if(includeDependencies.files[file.path]) return;
    includeDependencies.files[file.path] = true;

    var deps = file.data.requires;
    for(var d in deps)
    {
        var relPath = (typeof deps[d]  === 'string' ? deps[d] : deps[d].path);
        var absPath = (typeof deps[d]  === 'string' ? deps[d] : deps[d].absPath);

        var prefix = new Buffer('/***** Required '+relPath+' *****/'+os.EOL, 'utf8');
        fs.writeSync(file.fd, prefix, 0, prefix.length, null);

        var buffer = fs.readFileSync(absPath);
        fs.writeSync(file.fd, buffer, 0, buffer.length, null);

        var postfix = new Buffer(os.EOL+'/***** Ending '+relPath+' *****/'+os.EOL+os.EOL, 'utf8');
        fs.writeSync(file.fd, postfix, 0, postfix.length, null);
    }
};
includeDependencies.files = {};






/**
 * @param {Transcend.File} file
 * @return {Array}
 */
Transcend.prototype.getRequires = function(file) {
    // file may be null if a file outside the project directory is referenced.
    if(!file) return [];

    if(file.data.requires) return file.data.requires;
    var reqs = file.data.requires = [];

    var args = file.directiveArgs('require').map(function(item) {
        var p = this._resolvePath(path.dirname(file.path), item);
        if(!p) throw new Error('@require argument "'+item+'" could not be resolved in '+file.path+'.');
        return this.files[p] ? this.files[p] : p;
    }.bind(this));

    for(var i in args)
    {
        if(typeof args[i] !== 'string')
            reqs.push.apply(reqs, this.getRequires(args[i]));
        reqs.push(args[i]);
    }
    reqs.unique();
    reqs.remove(reqs.indexOf(file));
    return reqs;
};






// Create 'require' and 'master' directives.

Transcend.setHandler('require', {

    /**
     * @param {Transcend.File} file
     */
    prepare: function(file) {
        this.getRequires(file);
    },

    process: includeDependencies,

    eachLine: function(file, line, num) {
    },

    finalize: function(file) {
    }

});





/**
 * Master dependencies are all the "required" files, plus the master dependencies (recursive) of the "master" sources.
 * This method populates file.data.requires with all the master dependencies.
 * @param {Transcend.File} file
 */
Transcend.prototype.getMasterDependencies = function(file) {
    var masters = file.directiveArgs('master');
    if(!masters.length) return;
    if(file.data.masters) return;

    var deps = [], //file.data.requires ? [file.data.requires.slice()] : [], // duplicate
        sources = masters.map(function(item) {
            var p = this.files[this._resolvePath(path.dirname(file.path), item)];
            if(!p) throw new Error('@master argument "'+item+'" could not be resolved in '+file.path+'.');
            return p;
        }.bind(this));

    file.data.masters = sources;

    // deps is an array of arrays, with each child array being the master dependencies of each source
    for(var i in sources)
    {
        this.getMasterDependencies(sources[i]);
        if(sources[i].data.requires)
            deps.push(sources[i].data.requires);
    }

    // master dependencies is all of the "requires" plus the intersection of all the master source dependencies
    file.data.requires = file.data.requires || [];
    file.data.requires.push.apply(file.data.requires, _.intersection.apply(_, deps));
    file.data.requires.unique();

    for(var j in sources)
        sources[j].data.requires = _.difference(sources[j].data.requires, file.data.requires);
};



Transcend.setHandler('master', {

    /**
     * @param {Transcend.File} file
     */
    prepare: function(file) {
        this.ensurePrepared('require');
        this.getMasterDependencies(file);
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

