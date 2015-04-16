var Generator = (function(){
  'use strict';

  var Y_THRESHOLD = 1000;
  var NEXT_STEP = 7;

  var generate = function(npoints) {
    var arr = [];
    var seed = Math.random() * Y_THRESHOLD;
    arr.push(seed);

    for (var i = 0; i < npoints-1; i += 1) {
      var val = Math.random() > 0.5 ? seed + (NEXT_STEP * Math.random()) : seed - (NEXT_STEP * Math.random());

      if (val < 0) val = 0;
      if (val > Y_THRESHOLD) val = Y_THRESHOLD;

      arr.push(val);
      seed = val;
    }

    return arr;
  };


  function Generator(nlines) {
    nlines = nlines || 1;
    this.lines = [];
    this.nlines = nlines;
  }

  Generator.prototype.generate = function(npoints) {
    var that = this;

    for (var i = 0; i < that.nlines; i += 1)
      that.lines.push(generate(npoints));

    return that.lines;
  };

  return Generator;

})();