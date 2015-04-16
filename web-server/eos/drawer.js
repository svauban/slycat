var Drawer = (function() {
  'use strict';

  var draw = function(that) {
    that.data.forEach(function(set, i) {
      that.svg.select('.x.axis').call(that.xaxis);
      that.svg.select('.y.axis').call(that.yaxis);
      that.svg.select('#line_' + i).attr('d', that.line);
    });
  };

  var onzoom = function(that) {
    draw(that);
  };


  function Drawer(selector) {
    this.selector = selector;
    this.data = null;
    this.generator = null;
    this.xaxis = null;
    this.yaxis = null;
    this.line = null;
  }

  Drawer.prototype.init = function(nlines, npoints) {
    var that = this;

    that.generator = new Generator(nlines);
    that.data = that.generator.generate(npoints);
  };

  Drawer.prototype.draw = function() {
    var that = this;
    var margins = { top: 20, right: 20, bottom: 30, left: 50 };
    var width = parseInt(d3.select(that.selector).style('width'), 10) - margins.left - margins.right;
    var height = parseInt(d3.select(that.selector).style('height'), 10) - margins.top - margins.bottom;

    var x = d3.scale.linear()
      .range([0, width])
      .domain([0, that.data[0].length]);

    var ymax = Number.MIN_VALUE;
    that.data.forEach(function(set) {
      var tmp = d3.max(set);
      ymax = tmp > ymax ? tmp : ymax;
    });

    var y = d3.scale.linear()
      .range([height, 0])
      .domain([1, ymax]);

    that.xaxis = d3.svg.axis()
      .scale(x)
      .orient('bottom');

    that.yaxis = d3.svg.axis()
      .scale(y)
      .orient('left');

    that.line = d3.svg.line()
      .x(function(d, i) {
        return x(i);
      })
      .y(function(d, i) {
        return y(d);
      });

    var zoom = d3.behavior.zoom()
      .x(x)
      .y(y)
      .on('zoom', function() { onzoom(that); })

    that.svg = d3.select(that.selector).append('svg')
      .attr('width', width + margins.left + margins.right)
      .attr('height', height + margins.top + margins.bottom)
      .append('g')
        .attr('transform', 'translate(' + margins.left + ', ' + margins.top + ')');

    that.svg.append('clipPath')
      .attr('id', 'clip')
    .append('rect')
      .attr('x', x(0))
      .attr('y', y(1))
      .attr('width', x(1) - x(0))
      .attr('height', y(0) - y(1));

    that.svg.append('g')
      .classed('x axis', true)
      .attr('transform', 'translate(0,' + height + ')');

    that.svg.append('g')
      .classed('y axis', true);

    that.svg.append('path')
      .attr('class', 'line')
      .attr('clip-path', 'url(#clip)');

    that.svg.append('rect')
      .attr('id', 'pane')
      .attr('width', width)
      .attr('height', height)
      .call(zoom);

    that.data.forEach(function(set, i) {
      that.svg.append('path')
        .datum(set)
        .classed('line', true)
        .attr('id', 'line_' + i);
    });        

    /** initial render */
    draw(that);
  };

  return Drawer;

})();