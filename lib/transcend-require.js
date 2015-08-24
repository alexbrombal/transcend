'use strict';

var _ = require('underscore');

module.exports = {

    require: {

        prepare: function(file) {
            this.doPhase('prepare', 'if');

            /**
             * @param {File} file
             * @return {Array}
             */
            var getRequires = function getRequires(file) {
                if(file.data.requires) return file.data.requires;
                var requires = [];

                var args = _.flatten(_.map(file.directives.require || {}, function(directive, line) {
                    return _.map(directive.args.split(','), function(filepath) {
                        var p = file.resolvePath(filepath.trim());
                        if(!p)
                            throw new Error('@require argument "' + filepath + '" could not be resolved in ' + file.path + '.');
                        return p;
                    });
                }));

                for(var i in args)
                {
                    requires.push.apply(requires, getRequires(args[i]));
                    requires.push(args[i]);
                }
                requires = _.unique(requires);
                requires = _.without(requires, file);
                return file.data.requires = requires;
            };

            getRequires(file);
        },

        process: function(file) {
            var requireLines = [];
            _.each(file.data.requires, function(require) {
                requireLines.push([
                    '/***** Required '+require.path+' *****/',
                    require.lines.slice(),
                    '/***** Ending '+require.path+' *****/',
                    ''
                ]);
            });
            file.lines.unshift(requireLines);
        }

    },

    parent: {

        prepare: function(file) {
            this.doPhase('prepare', 'require');

            var parentDirective = _.find(file.directives.parent || {}, function() { return true; });
            if (!parentDirective) return;

            var filepath = parentDirective.args.trim();
            var parent = file.resolvePath(filepath);
            if (!parent)
                throw new Error('@parent argument "' + filepath + '" could not be resolved in ' + file.path + '.');

            parent.data.parent = parent.data.parent || {};
            parent.data.parent.children = parent.data.parent.children || {};
            parent.data.parent.children[file.path] = file;
        },

        allPrepared: function() {

            var getChildRequireCounts = function(file, memo) {
                if (!file.data.parent || !file.data.parent.children || file.data.parent.children.length == 0) return {};
                _.each(file.data.parent.children, function(child) {
                    getChildRequireCounts(child, memo);
                    _.each(child.data.requires, function(require) {
                        memo[require.path] = (memo[require.path] || 0) + 1;
                    });
                });
                return memo;
            };

            var removeRequires = function(file, removes) {
                if (!file.data.parent || !file.data.parent.children || file.data.parent.children.length == 0)
                    return;
                _.each(file.data.parent.children, function(child) {
                    child.data.requires = _.without.apply(null, [ child.data.requires ].concat(removes));
                    removeRequires(child, removes);
                });
            };

            var bubbleRequires = function(file) {
                if (!file.data.parent || !file.data.parent.children || file.data.parent.bubbled)
                    return;

                // Run recursively on each child first
                _.each(file.data.parent.children, bubbleRequires);

                // Get the counts of every child's required files
                // requireCounts = { 'path/one': 2, 'path/two': 1, ... }
                var requireCounts = getChildRequireCounts(file, {});

                // Add all required files that were required by two or more descendants
                file.data.requires = _.union(
                    file.data.requires,
                    _.compact(_.map(requireCounts, function(count, filepath) { return count >= 2 ? file.project.files[filepath] : ''; }))
                );

                // Remove all of this File's requires from each child
                removeRequires(file, file.data.requires);

                file.data.parent.bubbled = true;
            };

            _.each(this.files, bubbleRequires);
        }
    }

};

