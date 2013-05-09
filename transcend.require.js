'use strict';


var fs = require('fs');
var path = require('path');
var os = require('os');
require('./util.js');
var _ = require('underscore');

var Transcend = require('./transcend.core.js');




// Create 'require' and 'master' directives.

Transcend.setHandler('require', {

    /**
     * @param {Transcend.File} file
     */
    prepare: function(file) {
        this.ensurePrepared('if');
        getRequires(file, this);
    },

    process: function(file) {
        includeDependencies(file);
    }

});


Transcend.setHandler('master', {

    /**
     * @param {Transcend.File} file
     */
    prepare: function(file) {
        this.ensurePrepared('require');
        getMasterDependencies(file, this);
    }

});




/**
 * @param {Transcend.File} file
 */
function includeDependencies(file) {
    for(var i in file.data.includes)
    {
        var include = file.data.includes[i];

        file.writeLine('/***** Required '+include.path+' *****/');

        for(var j in include.lines)
            file.writeLine(include.lines[j]);

        file.writeLine('/***** Ending '+include.path+' *****/');
        file.writeLine('');
    }
};




/**
 * @param {Transcend.File} file
 * @return {Array}
 */
function getRequires(file, transcend) {

    if(file.data.includes) return file.data.includes;
    var includes = file.data.includes = [];

    var args = file.directiveArgs('require').map(function(item) {
        var p = transcend.resolvePath(path.dirname(file.path), item);
        if(!p || !transcend.files[p]) throw new Error('@require argument "'+item+'" could not be resolved in '+file.path+'.');
        return transcend.files[p];
    });

    for(var i in args)
    {
        includes.push.apply(includes, getRequires(args[i], transcend));
        includes.push(args[i]);
    }
    includes.unique();
    includes.remove(includes.indexOf(file));
    return includes;
};



/**
 * Master dependencies are all the common sub-@requires of a file's @requires.
 * @param {Transcend.File} file
 */
function getMasterDependencies(file, transcend) {

    if(file.data.masters) return;
    file.data.masters = true;

    var masters = file.directiveArgs('master');
    if(!masters.length) return;

    var common = [];
    masters = masters.map(function(item) {
            var p = transcend.resolvePath(path.dirname(file.path), item);
            if(!p || !transcend.files[p]) throw new Error('@master argument "'+item+'" could not be resolved in '+file.path+'.');
            return transcend.files[p];
        });

    // For now, common is an array of arrays, with each child array being the dependencies of each source
    for(var i in masters)
    {
        getMasterDependencies(masters[i], transcend);
        if(masters[i].data.includes)
            common.push(masters[i].data.includes);
    }

    // reduce common files to only those that exist in all child arrays
    common = _.intersection.apply(_, common);

    // master dependencies is all of the "requires" plus the intersection of all the master source dependencies

    file.data.includes = file.data.includes || [];
    file.data.includes.push.apply(file.data.includes, common);
    file.data.includes.unique();

    // remove all of this file's dependencies from the dependencies themselves, so there is no overlap
    for(var j in masters)
        masters[j].data.includes = _.difference(masters[j].data.includes, file.data.includes);
};


