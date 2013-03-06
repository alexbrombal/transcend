'use strict';

var fs = require('fs');

(function(module) {

    var defaults = {
        bufferLength: 256
    };

    var LineReader = function(filename, ready) {
        this.filename = filename;
        this.offset = 0;
        this.lineNum = 1;
        this.lines = [''];
        this.bufferLength = defaults.bufferLength;

        fs.open(this.filename, 'r', null, function(err, fd) {
            this.file = fd;
            if (ready) ready.call(this, err);
        }.bind(this));
    };

    LineReader.prototype.setBufferLength = function(length) {
        if(typeof length !== 'number' || length <= 0) throw new Error('Buffer length must be numeric and greater than 0.');
        this.bufferLength = length || defaults.bufferLength;
    };

    /**
     *
     * @param num
     * @param {Function} callback Receives (text, lineNum, lineNum (during this read), LineReader object)
     * @param {Function} complete Receives (lineNum, lineNum (during this read), LineReader object)
     */
    LineReader.prototype.readLines = function(num, callback, complete) {

        if(!this.buffer) this.buffer = new Buffer(this.bufferLength);

        if (this.lines.length > 1) {
            var c = Math.min(num === null ? Infinity : num, this.lines.length - 1);
            var r = this.lines.slice(0, c);
            this.lines = this.lines.slice(c);
            for(var i in r)
            {
                callback.count = callback.count || 1;
                process.nextTick(callback.bind(this, r[i], this.lineNum, callback.count++, this));
                num--;
                this.lineNum++;
            }
        }

        if (num === 0 || this.done())
        {
            if(complete) process.nextTick(complete.bind(this, this.lineNum, callback.count, this));
            return;
        }

        fs.read(this.file, this.buffer, 0, this.bufferLength, null, function(err, bytesRead, buffer) {
            if (bytesRead)
            {
                var lines = buffer.toString('utf8', 0, bytesRead).split('\n');

                // Trim any stray \r characters from the end of the first line,
                // then append it to the last line of the cache
                if(lines[0][lines[0].length-1] == '\r') lines[0] = lines[0].substr(0, lines[0].length-1);
                this.lines[this.lines.length - 1] += lines[0];

                // For each remaining line, trim \r characters and add to the cache
                lines.slice(1).forEach(function(line) {
                    if(line[line.length-1] == '\r') line = line.substr(0, line.length-1);
                    this.lines.push(line);
                }.bind(this));
            }

            if (bytesRead < this.bufferLength)
            {
                try { fs.close(this.file); } catch(e) { }
                this.lines.push(null);
            }

            this.readLines(num, callback, complete);
        }.bind(this));
    };

    LineReader.prototype.eof = function() {
        return this.lines[this.lines.length-1] === null;
    };

    LineReader.prototype.done = function() {
        return this.lines.length === 1 && this.eof();
    };

    module.exports = LineReader;

})(module);
