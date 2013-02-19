'use strict';

var LineReader = require('./linereader.js');

var l = new LineReader('linereader.test.txt', function() {

    l.readLines(5, function(line, num, n) {
        console.log('a', num, n, line);
    }, function() {
        console.log('complete a');
    });

    l.readLines(5, function(line, num, n) {
        console.log('b', num, n, line);
    }, function() {
        console.log('complete b');
    });

});