"use strict";

Object.defineProperty(Array.prototype, 'remove', {
    value: function(i) {
        if(i >= 0 && i < this.length)
            return this.splice(i, 1)[0];
    }
});

Object.defineProperty(Array.prototype, 'unique', {
    value: function() {
        for(var i = this.length-1; i >= 0; i--)
            if(this.indexOf(this[i]) !== i)
                this.remove(i);
        return this;
    }
});

Object.defineProperty(Function.prototype, 'curry', {
    value: function() {
        if (arguments.length < 1)
            return this;
        var __method = this;
        var args = Array.prototype.slice.call(arguments);
        return function() {
            return __method.apply(this, args.concat(Array.prototype.slice.call(arguments)));
        };
    }
});
