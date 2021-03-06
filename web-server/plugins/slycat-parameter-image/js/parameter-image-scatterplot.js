/*
Copyright 2013, Sandia Corporation. Under the terms of Contract
DE-AC04-94AL85000 with Sandia Corporation, the U.S. Government retains certain
rights in this software.
*/

//////////////////////////////////////////////////////////////////////////////////
// d3js.org scatterplot visualization, for use with the parameter-image model.

define("slycat-parameter-image-scatterplot", ["slycat-server-root", "d3", "URI", "slycat-remotes"], function(server_root, d3, URI, remotes)
{
  $.widget("parameter_image.scatterplot",
  {
    options:
    {
      width : 300,
      height : 300,
      pick_distance : 3,
      drag_threshold : 3,
      indices : [],
      x_label : "X Label",
      y_label : "Y Label",
      v_label : "V Label",
      x : [],
      y : [],
      v : [],
      x_string : false,
      y_string : false,
      v_string : false,
      images : [],
      selection : [],
      colorscale : d3.scale.linear().domain([-1, 0, 1]).range(["blue", "white", "red"]),
      border : 25,
      open_images : [],
      gradient : null,
      hidden_simulations : [],
      filtered_indices : [],
      filtered_selection : [],
      filtered_x : [],
      filtered_y : [],
      filtered_v : [],
      scale_x : [],
      scale_y : [],
      scale_v: [],
      "auto-scale" : true,
      canvas_square_size : 8,
      canvas_square_border_size : 1,
      canvas_selected_square_size : 16,
      canvas_selected_square_border_size : 2,
      pinned_width : 200,
      pinned_height : 200,
      hover_time : 250,
      image_cache : {},
      video_file_extensions : [
        '3gp','3g2','h261','h263','h264','jpgv','jpm','jpgm','mj2','mjp2','mp4','mp4v','mpg4','mpeg','mpg','mpe','m1v','m2v','ogv','qt','mov','uvh','uvvh','uvm','uvvm','uvp','uvvp',
        'uvs','uvvs','uvv','uvvv','dvb','fvt','mxu','m4u','pyv','uvu','uvvu','viv','webm','f4v','fli','flv','m4v','mkv','mk3d','mks','mng','asf','asx','vob','wm','wmv','wmx','wvx','avi',
        'movie','smv','ice',
      ],
    },

  _create: function()
  {
    var self = this;

    if(self.options["auto-scale"])
    {
      self.options.filtered_x = self._filterValues(self.options.x);
      self.options.filtered_y = self._filterValues(self.options.y);
      self.options.filtered_v = self._filterValues(self.options.v);
      self.options.scale_x = self.options.filtered_x;
      self.options.scale_y = self.options.filtered_y;
      self.options.scale_v = self.options.filtered_v;
    }
    else
    {
      self.options.scale_x = self.options.x;
      self.options.scale_y = self.options.y;
      self.options.scale_v = self.options.v;
    }

    this.remotes = remotes.create_pool();

    self.hover_timer = null;
    self.close_hover_timer = null;

    self.hover_timer_canvas = null;

    self.opening_image = null;
    self.state = "";
    self.start_drag = null;
    self.current_drag = null;
    self.end_drag = null;

    // Setup the scatterplot ...
    self.media_layer = d3.select(self.element.get(0)).append("div").attr("class", "media-layer bootstrap-styles");
    $('.media-layer').delegate('*', 'mousedown', function(){return false;});
    self.svg = d3.select(self.element.get(0)).append("svg").style({
      "opacity": ".99",
      // "position": "absolute", // Setting position to absolute also brings the svg element in front of .media-layer but keeps .image-frames on top of everything
    });
    self.x_axis_layer = self.svg.append("g").attr("class", "x-axis");
    self.y_axis_layer = self.svg.append("g").attr("class", "y-axis");
    self.legend_layer = self.svg.append("g").attr("class", "legend");
    self.legend_axis_layer = self.legend_layer.append("g").attr("class", "legend-axis");
    self.canvas_datum = d3.select(self.element.get(0)).append("canvas")
      .style({'position':'absolute'}).node()
      ;
    self.canvas_datum_layer = self.canvas_datum.getContext("2d");
    self.canvas_selected = d3.select(self.element.get(0)).append("canvas")
      .style({'position':'absolute'}).node()
      ;
    self.canvas_selected_layer = self.canvas_selected.getContext("2d");
    self.selection_layer = self.svg.append("g").attr("class", "selection-layer");
    self.line_layer = self.svg.append("g").attr("class", "line-layer");

    self.options.image_cache = {};

    self.updates = {};
    self.update_timer = null;
    self._schedule_update({
      update_indices:true,
      update_width:true,
      update_height:true,
      update_x:true,
      update_y:true,
      update_x_label:true,
      update_y_label:true,
      render_data:true,
      render_selection:true,
      open_images:true,
      render_legend:true,
      update_legend_colors:true,
      update_legend_position:true,
      update_legend_axis:true,
      update_v_label:true,
    });

    self.legend_layer
      .call(
        d3.behavior.drag()
          .on('drag', function(){
            // Make sure mouse is inside svg element
            if( 0 <= d3.event.y && d3.event.y <= self.options.height && 0 <= d3.event.x && d3.event.x <= self.options.width ){
              var theElement = d3.select(this);
              var transx = Number(theElement.attr("data-transx"));
              var transy = Number(theElement.attr("data-transy"));
              transx += d3.event.dx;
              transy += d3.event.dy;
              theElement.attr("data-transx", transx);
              theElement.attr("data-transy", transy);
              theElement.attr('transform', "translate(" + transx + ", " + transy + ")");
            }
          })
          .on("dragstart", function() {
            self.state = "moving";
            d3.event.sourceEvent.stopPropagation(); // silence other listeners
          })
          .on("dragend", function() {
            self.state = "";
            // self._sync_open_images();
            d3.select(this).attr("data-status", "moved");
          })
      )
      ;

    self.element.mousedown(function(e)
    {
      //console.log("#scatterplot mousedown");
      e.preventDefault();
      output = e
      self.start_drag = [e.originalEvent.offsetX || e.originalEvent.layerX, e.originalEvent.offsetY || e.originalEvent.layerY];
      s_d = self.start_drag;
      self.end_drag = null;
      s_e = self.start_drag;
    });

    self.element.mousemove(function(e)
    {
      if(self.start_drag === null)
      {
        self._schedule_hover_canvas(e);
      }
      else if(self.start_drag) // Mouse is down ...
      {
        if(self.end_drag) // Already dragging ...
        {
          self.end_drag = [e.originalEvent.offsetX || e.originalEvent.layerX, e.originalEvent.offsetY || e.originalEvent.layerY];
          output = e;

          var width = self.element.width();
          var height = self.element.height();

          self.selection_layer.selectAll(".rubberband")
              .attr("x", Math.min(self.start_drag[0], self.end_drag[0]))
              .attr("y", Math.min(self.start_drag[1], self.end_drag[1]))
              .attr("width", Math.abs(self.start_drag[0] - self.end_drag[0]))
              .attr("height", Math.abs(self.start_drag[1] - self.end_drag[1]))
            ;
        }
        else
        {
          if(Math.abs((e.originalEvent.offsetX || e.originalEvent.layerX) - self.start_drag[0]) > self.options.drag_threshold || Math.abs((e.originalEvent.offsetY || e.originalEvent.layerY) - self.start_drag[1]) > self.options.drag_threshold) // Start dragging ...
          {
            self.state = "rubber-band-drag";
            self.end_drag = [e.originalEvent.offsetX || e.originalEvent.layerX, e.originalEvent.offsetY || e.originalEvent.layerY];
            self.selection_layer.append("rect")
              .attr("class", "rubberband")
              .attr("x", Math.min(self.start_drag[0], self.end_drag[0]))
              .attr("y", Math.min(self.start_drag[1], self.end_drag[1]))
              .attr("width", Math.abs(self.start_drag[0] - self.end_drag[0]))
              .attr("height", Math.abs(self.start_drag[1] - self.end_drag[1]))
              .attr("fill", "rgba(255, 255, 0, 0.3)")
              .attr("stroke", "rgb(255, 255, 0)")
              .attr("linewidth", 2)
              ;
          }
        }
      }
    });

    self.element.mouseout(function(e){
      self._cancel_hover_canvas();
    });

    self.element.mouseup(function(e)
    {
      if(self.state == "resizing" || self.state == "moving")
        return;

      //console.log("#scatterplot mouseup");
      if(!e.ctrlKey && !e.metaKey)
      {
        self.options.selection = [];
        self.options.filtered_selection = [];
      }

      var x = self.options.x;
      var y = self.options.y;
      var count = x.length;
      var x_coord, y_coord;

      if(self.state == "rubber-band-drag") // Rubber-band selection ...
      {
        self.selection_layer.selectAll(".rubberband").remove();

        if(self.start_drag && self.end_drag) {
          var x1 = Math.min(self.start_drag[0], self.end_drag[0]);
          var x2 = Math.max(self.start_drag[0], self.end_drag[0]);
          var y1 = Math.min(self.start_drag[1], self.end_drag[1]);
          var y2 = Math.max(self.start_drag[1], self.end_drag[1]);

          for(var i = 0; i != count; ++i)
          {
            x_coord = self.x_scale(x[i]);
            y_coord = self.y_scale(y[i]);
            if(x1 <= x_coord && x_coord <= x2 && y1 <= y_coord && y_coord <= y2)
            {
              var index = self.options.selection.indexOf(self.options.indices[i]);
              if(index == -1)
                self.options.selection.push(self.options.indices[i]);
            }
          }
        }
      }
      else // Pick selection ...
      {
        var x1 = (e.originalEvent.offsetX || e.originalEvent.layerX) - self.options.pick_distance;
        var x2 = (e.originalEvent.offsetX || e.originalEvent.layerX) + self.options.pick_distance;
        var y1 = (e.originalEvent.offsetY || e.originalEvent.layerY) - self.options.pick_distance;
        var y2 = (e.originalEvent.offsetY || e.originalEvent.layerY) + self.options.pick_distance;

        for(var i = count - 1; i > -1; i--)
        {
          x_coord = self.x_scale(x[i]);
          y_coord = self.y_scale(y[i]);
          if(x1 <= x_coord && x_coord <= x2 && y1 <= y_coord && y_coord <= y2)
          {
            // Update the list of selected points ...
            var index = self.options.selection.indexOf(self.options.indices[i]);
            if(index == -1)
            {
              // Selecting a new point.
              self.options.selection.push(self.options.indices[i]);
            }
            else
            {
              // Deselecting an existing point.
              self.options.selection.splice(index, 1);
            }

            break;
          }
        }
      }

      self.start_drag = null;
      self.end_drag = null;
      self.state = "";

      self._filterIndices();
      self.options.selection = self.options.filtered_selection.slice(0);
      self._schedule_update({render_selection:true});
      self.element.trigger("selection-changed", [self.options.selection]);
    });
    self._filterIndices();
  },

  _filterIndices: function()
  {
    var self = this;
    var x = self.options.x;
    var y = self.options.y;
    var indices = self.options.indices;
    var selection = self.options.selection;
    var hidden_simulations = self.options.hidden_simulations;
    var filtered_indices = self._cloneArrayBuffer(indices);
    var filtered_selection = selection.slice(0);
    var length = indices.length;

    // Remove hidden simulations and NaNs and empty strings
    for(var i=length-1; i>=0; i--){
      var hidden = $.inArray(indices[i], hidden_simulations) > -1;

      if(hidden || !self._validateValue(x[i]) || !self._validateValue(y[i])) {
        filtered_indices.splice(i, 1);
        var selectionIndex = $.inArray(indices[i], filtered_selection);
        if( selectionIndex > -1 ) {
          filtered_selection.splice(selectionIndex, 1);
        }
      }
    }

    self.options.filtered_indices = filtered_indices;
    self.options.filtered_selection = filtered_selection;
  },

  // Filters source values by removing hidden_simulations
  _filterValues: function(source)
  {
    var self = this;
    var hidden_simulations = self.options.hidden_simulations.sort(d3.ascending);
    var length = hidden_simulations.length;

    var filtered = self._cloneArrayBuffer(source);

    for(var i=length-1; i>=0; i--)
    {
      filtered.splice(hidden_simulations[i], 1);
    }

    return filtered;
  },

  // Clones an ArrayBuffer or Array
  _cloneArrayBuffer: function(source)
  {
    // Array.apply method of turning an ArrayBuffer into a normal array is very fast (around 5ms for 250K) but doesn't work in WebKit with arrays longer than about 125K
    // if(source.length > 1)
    // {
    //   return Array.apply( [], source );
    // }
    // else if(source.length == 1)
    // {
    //   return [source[0]];
    // }
    // return [];

    // For loop method is much shower (around 300ms for 250K) but works in WebKit. Might be able to speed things up by using ArrayBuffer.subarray() method to make smallery arrays and then Array.apply those.
    var clone = [];
    for(var i = 0; i < source.length; i++)
    {
      clone.push(source[i]);
    }
    return clone;
  },

  _createScale: function(string, values, range, reverse)
  {
    if(!string)
    {
      var domain = [d3.min(values), d3.max(values)];
      if(reverse === true)
      {
        domain.reverse();
      }
      return d3.scale.linear()
        .domain(domain)
        .range(range)
        ;
    }
    else
    {
      var uniqueValues = d3.set(values).values().sort();
      if(reverse === true)
      {
        uniqueValues.reverse();
      }
      return d3.scale.ordinal()
        .domain(uniqueValues)
        .rangePoints(range)
        ;
    }
  },

  _getDefaultXPosition: function(imageIndex, imageWidth)
  {
    // We force the image to the left or right side of the screen, based on the target point position.
    var self = this;
    var width = self.svg.attr("width");
    var range = self.x_scale.range();
    var rangeLast = range.length - 1;
    var relx = (self.x_scale(self.options.x[imageIndex]) - range[0]) / (range[rangeLast] - range[0]);
    var x;

    if(relx < 0.5)
      x = relx * range[0];
    else
      x = width - ((width - range[rangeLast]) * (1.0 - relx)) - imageWidth;

    return parseInt(x);
  },

  _getDefaultYPosition: function(imageIndex, imageHeight)
  {
    var self = this;
    var height = self.svg.attr("height");
    var target_y = self.y_scale(self.options.y[imageIndex]);
    return parseInt((target_y / height) * (height - imageHeight));
  },

  _validateValue: function(value)
  {
    var self = this;
    if(typeof value == "number" && !isNaN(value))
      return true;
    if(typeof value == "string" && value.trim() != "")
      return true;
    return false;
  },

  _setOption: function(key, value)
  {
    var self = this;

    //console.log("parameter_image.scatterplot._setOption()", key, value);
    self.options[key] = value;

    if(key == "indices")
    {
      self._filterIndices();
      self._schedule_update({update_indices:true, render_selection:true});
    }

    else if(key == "x_label")
    {
      self._schedule_update({update_x_label:true});
    }

    else if(key == "y_label")
    {
      self._schedule_update({update_y_label:true});
    }

    else if(key == "v_label")
    {
      self._schedule_update({update_v_label:true});
    }

    else if(key == "x")
    {
      if(self.options["auto-scale"])
      {
        self.options.filtered_x = self._filterValues(self.options.x);
        self.options.scale_x = self.options.filtered_x;
      }
      else
      {
        self.options.scale_x = self.options.x;
      }
      self._filterIndices();
      self._close_hidden_simulations();
      self._schedule_update({update_x:true, update_leaders:true, render_data:true, render_selection:true});
    }

    else if(key == "y")
    {
      if(self.options["auto-scale"])
      {
        self.options.filtered_y = self._filterValues(self.options.y);
        self.options.scale_y = self.options.filtered_y;
      }
      else
      {
        self.options.scale_y = self.options.y;
      }
      self._filterIndices();
      self._close_hidden_simulations();
      self._schedule_update({update_y:true, update_leaders:true, render_data:true, render_selection:true});
    }

    else if(key == "v")
    {
      if(self.options["auto-scale"])
      {
        self.options.filtered_v = self._filterValues(self.options.v);
        self.options.scale_v = self.options.filtered_v;
      }
      else
      {
        self.options.scale_v = self.options.v;
      }
      self._schedule_update({render_data:true, render_selection:true, update_legend_axis:true});
    }

    else if(key == "images")
    {
    }

    else if(key == "selection")
    {
      self._filterIndices();
      self._schedule_update({render_selection:true});
    }

    else if(key == "colorscale")
    {
      self._schedule_update({render_data:true, render_selection:true});
    }

    else if(key == "width")
    {
      self._schedule_update({update_width:true, update_x_label:true, update_x:true, update_leaders:true, render_data:true, render_selection:true});
    }

    else if(key == "height")
    {
      self._schedule_update({update_height:true, update_y:true, update_y_label:true, update_leaders:true, render_data:true, render_selection:true, update_legend_position:true, update_legend_axis:true, update_v_label:true,});
    }

    else if(key == "border")
    {
      self._schedule_update({update_x:true, update_y:true, update_leaders:true, render_data:true, render_selection:true, update_legend_position:true, update_v_label:true,});
    }

    else if(key == "gradient")
    {
      self._schedule_update({update_legend_colors:true, });
    }

    else if(key == "hidden_simulations")
    {
      self._filterIndices();
      if(self.options["auto-scale"])
      {
        self.options.filtered_x = self._filterValues(self.options.x);
        self.options.filtered_y = self._filterValues(self.options.y);
        self.options.filtered_v = self._filterValues(self.options.v);
        self.options.scale_x = self.options.filtered_x;
        self.options.scale_y = self.options.filtered_y;
        self.options.scale_v = self.options.filtered_v;
      }
      else
      {
        self.options.scale_x = self.options.x;
        self.options.scale_y = self.options.y;
        self.options.scale_v = self.options.v;
      }
      self._schedule_update({update_x:true, update_y:true, update_leaders:true, render_data:true, render_selection:true, update_legend_axis:true});
      self._close_hidden_simulations();
    }

    else if(key == "auto-scale")
    {
      if(self.options["auto-scale"])
      {
        self.options.filtered_x = self._filterValues(self.options.x);
        self.options.filtered_y = self._filterValues(self.options.y);
        self.options.filtered_v = self._filterValues(self.options.v);
        self.options.scale_x = self.options.filtered_x;
        self.options.scale_y = self.options.filtered_y;
        self.options.scale_v = self.options.filtered_v;
      }
      else
      {
        self.options.scale_x = self.options.x;
        self.options.scale_y = self.options.y;
        self.options.scale_v = self.options.v;
      }
      self._schedule_update({update_x:true, update_y:true, update_leaders:true, render_data:true, render_selection:true, update_legend_axis:true});
    }
  },

  update_color_scale_and_v: function(data)
  {
    var self = this;
    self.options.colorscale = data.colorscale;
    self.options.v = data.v;
    if(data.v_string !== undefined)
    {
      self.options.v_string = data.v_string;
    }
    if(self.options["auto-scale"])
    {
      self.options.filtered_v = self._filterValues(self.options.v);
      self.options.scale_v = self.options.filtered_v;
    }
    else
    {
      self.options.scale_v = self.options.v;
    }
    self._schedule_update({render_data:true, render_selection:true, update_legend_axis:true});
  },

  _schedule_update: function(updates)
  {
    var self = this;

    for(var key in updates)
      self.updates[key] = updates[key];

    if(self.update_timer)
      return;

    self.update_timer = window.setTimeout(function() { self._update(); }, 0);
  },

  _update: function()
  {
    var self = this;

    //console.log("parameter_image.scatterplot._update()", self.updates);
    self.update_timer = null;

    var xoffset = 0;
    var legend_width = 150;

    if(self.updates["update_width"])
    {
      self.element.attr("width", self.options.width);
      self.svg.attr("width", self.options.width);
      self.media_layer.style({"width": self.options.width + "px"});

      var total_width = self.options.width;
      var total_height = self.options.height;
      var width = Math.min(total_width, total_height);
      var width_offset = (total_width - width) / 2;

      d3.select(self.canvas_datum)
        .style({
          "left" : (width_offset + self.options.border - (self.options.canvas_square_size / 2)) + "px",
        })
        .attr("width", (width - (2 * self.options.border)) - xoffset + self.options.canvas_square_size)
        ;
      d3.select(self.canvas_selected)
        .style({
          "left" : (width_offset + self.options.border - (self.options.canvas_selected_square_size / 2)) + "px",
        })
        .attr("width", (width - (2 * self.options.border)) - xoffset + self.options.canvas_selected_square_size)
        ;
    }

    if(self.updates["update_height"])
    {
      self.element.attr("height", self.options.height);
      self.svg.attr("height", self.options.height);
      self.media_layer.style({"height": self.options.height + "px"});

      var total_width = self.options.width;
      var total_height = self.options.height;
      var height = Math.min(total_width, total_height);
      var height_offset = (total_height - height) / 2;
      d3.select(self.canvas_datum)
        .style({
          "top" : (height_offset + self.options.border - (self.options.canvas_square_size / 2)) + "px",
        })
        .attr("height", (height - (2 * self.options.border)) - 40 + self.options.canvas_square_size)
        ;
      d3.select(self.canvas_selected)
        .style({
          "top" : (height_offset + self.options.border - (self.options.canvas_selected_square_size / 2)) + "px",
        })
        .attr("height", (height - (2 * self.options.border)) - 40 + self.options.canvas_selected_square_size)
        ;
    }

    if(self.updates["update_x"])
    {
      var total_width = self.options.width;
      var total_height = self.options.height;
      var width = Math.min(self.options.width, self.options.height);
      var width_offset = (total_width - width) / 2;

      var range = [0 + width_offset + self.options.border, total_width - width_offset - self.options.border - xoffset];
      var range_canvas = [0, width - (2 * self.options.border) - xoffset];

      self.x_scale = self._createScale(self.options.x_string, self.options.scale_x, range, false);
      self.x_scale_canvas = self._createScale(self.options.x_string, self.options.scale_x, range_canvas, false);

      var height = Math.min(self.options.width, self.options.height);
      var height_offset = (total_height - height) / 2;
      self.x_axis_offset = total_height - height_offset - self.options.border - 40;
      self.x_axis = d3.svg.axis().scale(self.x_scale).orient("bottom");
      self.x_axis_layer
        .attr("transform", "translate(0," + self.x_axis_offset + ")")
        .call(self.x_axis)
        ;
    }

    if(self.updates["update_y"])
    {
      var total_width = self.options.width;
      var total_height = self.options.height;
      var width = Math.min(self.options.width, self.options.height);
      var height = Math.min(self.options.width, self.options.height);
      var width_offset = (total_width - width) / 2
      var height_offset = (total_height - height) / 2
      var range = [total_height - height_offset - self.options.border - 40, 0 + height_offset + self.options.border];
      var range_canvas = [height - (2 * self.options.border) - 40, 0];
      self.y_axis_offset = 0 + width_offset + self.options.border;

      self.y_scale = self._createScale(self.options.y_string, self.options.scale_y, range, false);
      self.y_scale_canvas = self._createScale(self.options.y_string, self.options.scale_y, range_canvas, false);

      self.y_axis = d3.svg.axis().scale(self.y_scale).orient("left");
      self.y_axis_layer
        .attr("transform", "translate(" + self.y_axis_offset + ",0)")
        .call(self.y_axis)
        ;
    }

    if(self.updates["update_indices"])
    {
      self.inverse_indices = {};
      var count = self.options.indices.length;
      for(var i = 0; i != count; ++i)
        self.inverse_indices[self.options.indices[i]] = i;
    }

    if(self.updates["update_x_label"])
    {
      var x = self.svg.attr("width") / 2;
      var y = 40;

      self.x_axis_layer.selectAll(".label").remove()
      self.x_axis_layer.append("text")
        .attr("class", "label")
        .attr("x", x)
        .attr("y", y)
        .style("text-anchor", "middle")
        .style("font-weight", "bold")
        .text(self.options.x_label)
        ;
    }

    if(self.updates["update_y_label"])
    {
      self.y_axis_layer.selectAll(".label").remove();

      var y_axis_width = self.y_axis_layer.node().getBBox().width;
      var x = -(y_axis_width+15);
      var y = self.svg.attr("height") / 2;

      self.y_axis_layer.append("text")
        .attr("class", "label")
        .attr("x", x)
        .attr("y", y)
        .attr("transform", "rotate(-90," + x +"," + y + ")")
        .style("text-anchor", "middle")
        .style("font-weight", "bold")
        .text(self.options.y_label)
        ;
    }

    if(self.updates["render_data"])
    {
      var x = self.options.x,
          y = self.options.y,
          v = self.options.v,
          filtered_indices = self.options.filtered_indices,
          canvas = self.canvas_datum_layer,
          i = -1,
          n = filtered_indices.length,
          cx,
          cy,
          color,
          square_size = self.options.canvas_square_size,
          border_width = self.options.canvas_square_border_size,
          half_border_width = border_width / 2,
          fillWidth = fillHeight = square_size - (2 * border_width),
          strokeWidth = strokeHeight = square_size - border_width;

      // Draw points on canvas ...
      var time = Date;
      if(window.performance)
        time = window.performance;
      var start = time.now();

      canvas.clearRect(0, 0, self.canvas_datum.width, self.canvas_datum.height);
      canvas.strokeStyle = "black";
      canvas.lineWidth = border_width;

      while (++i < n) {
        var index = filtered_indices[i];
        var value = v[index];
        if(!self._validateValue(value))
          color = $("#color-switcher").colorswitcher("get_null_color");
        else
          color = self.options.colorscale(value);
        canvas.fillStyle = color;
        cx = Math.round( self.x_scale_canvas( x[index] ) );
        cy = Math.round( self.y_scale_canvas( y[index] ) );
        canvas.fillRect(cx + border_width, cy + border_width, fillWidth, fillHeight);
        canvas.strokeRect(cx + half_border_width, cy + half_border_width, strokeWidth, strokeHeight);
      }
      // Test point for checking position and border
      // canvas.fillStyle = "white";
      // canvas.fillRect(0 + 0.5, 0 + 0.5, width, height);
      // canvas.strokeRect(0 + 0.5, 0 + 0.5, width, height);
      var end = time.now();
      console.log("Time to render " + filtered_indices.length + " canvas points: " + (end-start) + " milliseconds.");
    }

    if(self.updates["render_selection"])
    {
      var x = self.options.x,
          y = self.options.y,
          v = self.options.v,
          filtered_selection = self.options.filtered_selection,
          canvas = self.canvas_selected_layer,
          i = -1,
          n = filtered_selection.length,
          cx,
          cy,
          color,
          square_size = self.options.canvas_selected_square_size,
          border_width = self.options.canvas_selected_square_border_size,
          half_border_width = border_width / 2,
          fillWidth = fillHeight = square_size - (2 * border_width),
          strokeWidth = strokeHeight = square_size - border_width;

      canvas.clearRect(0, 0, self.canvas_selected.width, self.canvas_selected.height);
      canvas.strokeStyle = "black";
      canvas.lineWidth = border_width;

      while (++i < n) {
        var index = filtered_selection[i];
        var value = v[index];
        if(!self._validateValue(value))
          color = $("#color-switcher").colorswitcher("get_null_color");
        else
          color = self.options.colorscale(value);
        canvas.fillStyle = color;
        cx = Math.round( self.x_scale_canvas( x[index] ) );
        cy = Math.round( self.y_scale_canvas( y[index] ) );
        canvas.fillRect(cx + border_width, cy + border_width, fillWidth, fillHeight);
        canvas.strokeRect(cx + half_border_width, cy + half_border_width, strokeWidth, strokeHeight);
      }
    }

    // Used to open an initial list of images at startup only
    if(self.updates["open_images"])
    {
      // This is just a convenience for testing - in practice, these parameters should always be part of the open image specification.
      self.options.open_images.forEach(function(image)
      {
        if(image.uri === undefined)
          image.uri = self.options.images[image.index];
        if(image.width === undefined)
          image.width = self.options.pinned_width;
        if(image.height === undefined)
          image.height = self.options.pinned_height;
      });

      // Transform the list of initial images so we can pass them to _open_images()
      var width = Number(self.svg.attr("width"));
      var height = Number(self.svg.attr("height"));

      var images = [];
      self.options.open_images.forEach(function(image, index)
      {
        images.push({
          index : image.index,
          uri : image.uri.trim(),
          image_class : "open-image",
          x : width * image.relx,
          y : height * image.rely,
          width : image.width,
          height : image.height,
          target_x : self.x_scale(self.options.x[image.index]),
          target_y : self.y_scale(self.options.y[image.index]),
          });
      });
      self._open_images(images);
    }

    // Update leader targets anytime we resize or change our axes ...
    if(self.updates["update_leaders"])
    {
      $(".open-image").each(function(index, frame)
      {
        var frame = $(frame);
        var image_index = Number(frame.attr("data-index"));
        var uri = frame.attr("data-uri");
        self.line_layer.select("line[data-uri='" + uri + "']")
          .attr("x2", self.x_scale(self.options.x[image_index]) )
          .attr("y2", self.y_scale(self.options.y[image_index]) )
          .attr("data-targetx", self.x_scale(self.options.x[image_index]))
          .attr("data-targety", self.y_scale(self.options.y[image_index]))
          ;
      });
    }

    if(self.updates["render_legend"])
    {
      var gradient = self.legend_layer.append("defs").append("linearGradient");
      gradient.attr("id", "color-gradient")
        .attr("x1", "0%").attr("y1", "0%")
        .attr("x2", "0%").attr("y2", "100%")
        ;

      var colorbar = self.legend_layer.append("rect")
        .classed("color", true)
        .attr("width", 10)
        .attr("height", 200)
        .attr("x", 0)
        .attr("y", 0)
        .style("fill", "url(#color-gradient)")
        ;
    }

    if(self.updates["update_legend_colors"])
    {
      var gradient = self.legend_layer.select("#color-gradient");
      var stop = gradient.selectAll("stop").data(self.options.gradient);
      stop.exit().remove();
      stop.enter().append("stop");
      stop
        .attr("offset", function(d) { return d.offset + "%"; })
        .attr("stop-color", function(d) { return d.color; })
        ;
    }

    if(self.updates["update_legend_position"])
    {
      var total_width = Number(self.options.width);
      var total_height = Number(self.options.height);
      var width = Math.min(self.options.width, self.options.height);
      var height = Math.min(self.options.width, self.options.height);
      var rectHeight = parseInt((height - self.options.border - 40)/2);
      var y_axis_layer_width = self.y_axis_layer.node().getBBox().width;
      var x_axis_layer_width = self.x_axis_layer.node().getBBox().width;
      var width_offset = (total_width + x_axis_layer_width) / 2;

      if( self.legend_layer.attr("data-status") != "moved" )
      {
        var transx = parseInt(y_axis_layer_width + 10 + width_offset);
        var transy = parseInt((total_height/2)-(rectHeight/2));
         self.legend_layer
          .attr("transform", "translate(" + transx + "," + transy + ")")
          .attr("data-transx", transx)
          .attr("data-transy", transy)
          ;
      }

      self.legend_layer.select("rect.color")
        .attr("height", rectHeight)
        ;
    }

    if(self.updates["update_legend_axis"])
    {
      var range = [0, parseInt(self.legend_layer.select("rect.color").attr("height"))];

      self.legend_scale = self._createScale(self.options.v_string, self.options.scale_v, range, true);

      self.legend_axis = d3.svg.axis().scale(self.legend_scale).orient("right");
      self.legend_axis_layer
        .attr("transform", "translate(" + parseInt(self.legend_layer.select("rect.color").attr("width")) + ",0)")
        .call(self.legend_axis)
        ;
    }

    if(self.updates["update_v_label"])
    {
      // console.log("updating v label.");
      self.legend_layer.selectAll(".label").remove();

      var rectHeight = parseInt(self.legend_layer.select("rect.color").attr("height"));
      var x = -15;
      var y = rectHeight/2;

      self.legend_layer.append("text")
        .attr("class", "label")
        .attr("x", x)
        .attr("y", y)
        .attr("transform", "rotate(-90," + x +"," + y + ")")
        .style("text-anchor", "middle")
        .style("font-weight", "bold")
        .text(self.options.v_label)
        ;
    }

    self.updates = {}
  },

  _sync_open_images: function()
  {
    var self = this;

    // Get the scatterplot width so we can convert absolute to relative coordinates.
    var width = Number(self.svg.attr("width"));
    var height = Number(self.svg.attr("height"));
    var open_images = [];
    $(".open-image").each(function(index, frame)
    {
      var frame = $(frame);
      open_images.push({
        index : Number(frame.attr("data-index")),
        uri : frame.attr("data-uri"),
        relx : Number(frame.attr("data-transx")) / width,
        rely : Number(frame.attr("data-transy")) / height,
        width : frame.outerWidth(),
        height : frame.outerHeight(),
        });
    });
    self.element.trigger("open-images-changed", [open_images]);
  },

  _open_images: function(images)
  {
    var self = this;

    // If the list of images is empty, we're done.
    if(images.length == 0)
      return;
    var image = images[0];

    // Don't open images for hidden simulations
    if($.inArray(image.index, self.options.hidden_simulations) != -1) {
      self._open_images(images.slice(1));
      return;
    }

    // Don't open image if it's already open
    if($(".open-image[data-uri='" + image.uri + "']:not(.scaffolding)").size() > 0) {
      self._open_images(images.slice(1));
      return;
    }

    // If image is hover and we are no longer loading this image, we're done.
    if( image.image_class == "hover-image" &&
        self.opening_image != image.index
      )
    {
      return;
    }
    // Create scaffolding and status indicator if we already don't have one
    if( self.media_layer.select("div[data-uri='" + image.uri + "']").filter("." + image.image_class + ",.open-image").empty() ){

      // Define a default size for every image.
      if(!image.width)
        image.width = self.options.pinned_width;
      if(!image.height)
        image.height = self.options.pinned_height;

      // Define a default position for every image.
      if(image.x === undefined)
      {
        image.x = self._getDefaultXPosition(image.index, image.width);
      }
      if(image.y === undefined)
      {
        image.y = self._getDefaultYPosition(image.index, image.height);
      }

      var frame_html = self.media_layer.append("div")
        .attr("data-uri", image.uri)
        .attr("data-transx", image.x)
        .attr("data-transy", image.y)
        .style({
          "left": image.x + "px", 
          "top": image.y + "px",
          "width": image.width + "px",
          "height": image.height + "px",
          "z-index": 1,
        })
        .attr("class", image.image_class + " image-frame scaffolding html")
        .attr("data-index", image.index)
        .attr("data-uri", image.uri)
        .call(
          d3.behavior.drag()
            .on('drag', function(){
              // console.log("frame html drag");
              // Make sure mouse is inside svg element
              if( 0 <= d3.event.y && d3.event.y <= self.options.height && 0 <= d3.event.x && d3.event.x <= self.options.width ){
                var theElement = d3.select(this);
                var transx = Number(theElement.attr("data-transx"));
                var transy = Number(theElement.attr("data-transy"));
                transx += d3.event.dx;
                transy += d3.event.dy;
                theElement.attr("data-transx", transx);
                theElement.attr("data-transy", transy);
                theElement.style({
                  "left": transx + "px", 
                  "top": transy + "px",
                })

                // Adjust leader line
                self._adjust_leader_line(theElement);
              }
            })
            .on("dragstart", function() {
              // console.log("frame html dragstart");
              self.state = "moving";
              // Verify source event target
              var sourceEventTarget = d3.select(d3.event.sourceEvent.target);
              if(sourceEventTarget.classed("image-frame") || sourceEventTarget.classed("image"))
              {
                d3.event.sourceEvent.stopPropagation(); // silence other listeners
                // Reset tracking of hover image if we are starting to drag a hover image
                var frame = d3.select(this);
                if(frame.classed("hover-image"))
                {
                  self.opening_image = null;
                  if(self.close_hover_timer)
                  {
                    window.clearTimeout(self.close_hover_timer);
                    self.close_hover_timer = null;
                  }
                  frame.classed("hover-image", false).classed("open-image", true);
                  image.image_class = "open-image";
                }
              }
            })
            .on("dragend", function() {
              // console.log("frame html dragend");
              self.state = "";
              self._sync_open_images();
            })
        )
        .on("mousedown", function(){
          // console.log("frame html mousedown");
          //d3.event.stopPropagation();
          // Verify that click is on image, not something else like the close button
          if(d3.event.target.classList.contains("image"))
          {
            // Move this image to the top of the Z order ...
            $(d3.event.target.parentNode).detach().appendTo(self.media_layer.node());
          }
          else if(d3.event.target.classList.contains("image-frame"))
          {
            // Move this image to the top of the Z order ...
            $(d3.event.target).detach().appendTo(self.media_layer.node());
          }
        })
        .on("mouseup", function(){
          // console.log("frame html mouseup");
          //d3.event.stopPropagation();
        })
        ;

      // Create a close button ...
      var close_button_html = frame_html.append("span")
        .attr("class", "close-button frame-icon")
        .on("mousedown", function(){
          //console.log("close button mousedown");
          d3.event.stopPropagation(); // silence other listeners
        })
        .on("mouseup", function(){
          //console.log("close button mouseup");
          d3.event.stopPropagation(); // silence other listeners
        })
        .on("click", function()
        {
          //console.log("close button click");
          d3.event.stopPropagation(); // silence other listeners
          var frame = d3.select(d3.event.target.parentNode);
          self._remove_image_and_leader_line(frame);
          self._sync_open_images();
        })
        ;

      // Create the leader line ...
      if("target_x" in image && "target_y" in image)
      {
        self.line_layer.append("line")
          .attr("data-uri", image.uri)
          .attr("class", "leader")
          .attr("x1", image.x + (image.width / 2))
          .attr("y1", image.y + (image.height / 2))
          .attr("x2", image.target_x)
          .attr("y2", image.target_y)
          .attr("data-targetx", image.target_x)
          .attr("data-targety", image.target_y)
          .style("stroke", "black")
          .style("stroke-width", 1.0)
          ;
      }

      // Create the loading image ...
      var loading_image = frame_html.append("img")
        .attr("class", "loading-image")
        .attr("src", server_root + "resources/models/parameter-image/" + "ajax-loader.gif")
        ;

      // Schedule timeout for hover
      self.element.one("mousemove", function(){
        self.close_hover_timer = window.setTimeout(function() {self._hover_timeout(image.index, 0);}, 1000);
      });
    }

    // If the image is already in the cache, display it.
    if(image.uri in self.options.image_cache)
    {
      console.log("Displaying image " + image.uri + " from cache");
      var url_creator = window.URL || window.webkitURL;
      var blob = self.options.image_cache[image.uri];
      var image_url = url_creator.createObjectURL(blob);

      // Define a default size for every image.
      if(image.width === undefined)
      {
        image.width = self.options.pinned_width;
      }
      if(image.height === undefined)
      {
        image.height = self.options.pinned_height;
      }
      // Define a default position for every image.
      if(image.x === undefined)
      {
        image.x = self._getDefaultXPosition(image.index, image.width);
      }
      if(image.y === undefined)
      {
        image.y = self._getDefaultYPosition(image.index, image.height);
      }

      var frame_html = self.media_layer.select("div." + image.image_class + "[data-uri='" + image.uri + "']");
      frame_html.classed("scaffolding", false);
      frame_html.select("span.reload-button").remove();

      if(blob.type.indexOf('image/') == 0)
      {
        // Create the html image ...
        var htmlImage = frame_html.append("img")
          .attr("class", "image resize")
          .attr("src", image_url)
          .attr("data-ratio", image.width / image.height)
          .style({
            "display": "none",
          })
          .on("load", function(){
            // Get the actual image dimensions
            // console.log("about to get actual image dimensions");
            var width = this.naturalWidth;
            var height = this.naturalHeight;
            var ratio = width/height;
            var target_width = self._scale_width(ratio, image.width, image.height);
            // Adjust dimensions of frame now that we know the dimensions of the image
            frame_html
              .attr("data-width", width)
              .attr("data-height", height)
              .attr("data-ratio", ratio)
              .style({
                "width": target_width + "px",
                "height": "auto",
              })
              ;
            htmlImage
              .style({
                "display": "block",
              })
              ;
            self._adjust_leader_line(frame_html);
          })
          ;
      }
      else if(blob.type.indexOf('video/') == 0)
      {
        // Create the video ...
        var video = frame_html
          .append("video")
          .attr("data-uri", image.uri)
          .attr("src", image_url)
          .attr("controls", true)
          .style({
            "display": "none",
          })
          .on("mousedown", function(){
            //console.log("video mousedown");
            d3.event.stopPropagation(); // silence other listeners
          })
          .on("mouseup", function(){
            //console.log("video mouseup");
            d3.event.stopPropagation(); // silence other listeners
          })
          .on("loadedmetadata", function(){
            // debugger;
            // console.log("video loaded metadata");
            var width = this.videoWidth;
            var height = this.videoHeight;
            var ratio = width/height;
            var target_width = self._scale_width(ratio, image.width, image.height);
            // Remove dimensions from parent frame to have it size to image
            frame_html
              .attr("data-width", width)
              .attr("data-height", height)
              .attr("data-ratio", ratio)
              .style({
                "width": target_width + "px",
                "height": "auto",
              });
            video
              .style({
                "display": "block",
              })
              ;
            self._adjust_leader_line(frame_html);
          })
          ;
      }

      // Remove loading indicator image
      frame_html.select(".loading-image").remove();

      // Adjust leader line
      self._adjust_leader_line(frame_html);

      // Create a resize handle
      var resize_handle_html = frame_html.append("span")
        .attr("class", "resize-handle frame-icon")
        .call(
          d3.behavior.drag()
            .on('drag', function(){
              // console.log("resize html drag");
              // Make sure mouse is inside svg element
              if( 0 <= d3.event.y && d3.event.y <= self.options.height && 0 <= d3.event.x && d3.event.x <= self.options.width ){
                var frame = d3.select(this.parentNode);
                var x = d3.event.x;
                var y = d3.event.y;
                var min = 50;
                if(x > min && y > min)
                {
                  var target_width = self._scale_width( frame.attr("data-ratio"), x, y );
                  frame.style({
                    "width": target_width + "px",
                  });
                  // Adjust leader line
                  self._adjust_leader_line(frame);
                }
              }
            })
            .on("dragstart", function() {
              // console.log("resize html dragstart");
              self.state = "resizing";
              d3.selectAll([this.parentNode, d3.select("#scatterplot").node()]).classed("resizing", true);
              d3.event.sourceEvent.stopPropagation(); // silence other listeners
              // Reset tracking of hover image if we are starting to drag a hover image
              var frame = d3.select(this.parentNode);
              if(frame.classed("hover-image"))
              {
                self.opening_image = null;
                if(self.close_hover_timer)
                {
                  window.clearTimeout(self.close_hover_timer);
                  self.close_hover_timer = null;
                }
                frame.classed("hover-image", false).classed("open-image", true);
                image.image_class = "open-image";
              }
            })
            .on("dragend", function() {
              // console.log("resize html dragend");
              d3.selectAll([this.parentNode, d3.select("#scatterplot").node()]).classed("resizing", false);
              self.state = "";
              self._sync_open_images();
            })
        )
        .on("mousedown", function(){
          //console.log("resize mousedown");
          //d3.event.stopPropagation(); // silence other listeners
        })
        .on("mouseup", function(){
          //console.log("resize mouseup");
          //d3.event.stopPropagation(); // silence other listeners
        })
        ;

      // Create a pin button ...
      var pin_button_html = frame_html.append("span")
        .attr('class', 'pin-button frame-icon')
        .on("mousedown", function(){
          // console.log("html pin button mousedown");
          d3.event.stopPropagation(); // silence other listeners
        })
        .on("mouseup", function(){
          // console.log("html pin button mouseup");
          d3.event.stopPropagation(); // silence other listeners
        })
        .on("click", function()
        {
          d3.event.stopPropagation(); // silence other listeners
          // Reset tracking of hover image
          self.opening_image = null;
          if(self.close_hover_timer)
          {
            window.clearTimeout(self.close_hover_timer);
            self.close_hover_timer = null;
          }

          var frame = d3.select(d3.event.target.parentNode);
          var theImage = frame.select(".resize");
          frame.classed("hover-image", false)
            .classed("open-image", true)
            ;

          // Adjust image position
          var imageWidth = self.options.pinned_width;
          var imageHeight = self.options.pinned_height;
          var target_width = self._scale_width(frame.attr("data-ratio"), self.options.pinned_width, self.options.pinned_height);

          var x = self._getDefaultXPosition(image.index, imageWidth);
          var y = self._getDefaultYPosition(image.index, imageHeight);

          frame
            .attr("data-transx", x)
            .attr("data-transy", y)
            .style({
              "left": x + "px", 
              "top": y + "px",
              "width": target_width + "px",
            })
            ;

          // Adjust leader line
          self._adjust_leader_line(frame);

          self._sync_open_images();
        })
        ;

      if(!image.no_sync)
        self._sync_open_images();
      self._open_images(images.slice(1));
      return;
    }

    // If we don't have a session for the image hostname, create one.
    var uri = URI(image.uri);

    var cached_uri = URI(server_root + "projects/" + model.project + "/cache/" + URI.encode(uri.host() + uri.path()))


    console.log("Attempting to load image from server-side cache");
    // Retrieve the image.
    console.log("Loading image " + image.uri + " from server");

    var xhr = new XMLHttpRequest();
    var api = "/file";
    if(self.options.video_file_extensions.indexOf(uri.suffix()) > -1)
    {
      api = "/file";
    }
    xhr.image = image;
    xhr.open("GET", server_root + "projects/" + model.project + "/cache/" + URI.encode(uri.host() + uri.path()), true);
    xhr.responseType = "arraybuffer";
    xhr.onload = function(e)
    {
      //If the image isn't in cache, open an agent session:
      if(this.status == 404)
      {
        self.remotes.get_remote(
        {
          hostname: uri.hostname(),
          title: "Login to " + uri.hostname(),
          message: "Loading " + uri.pathname(),
          cancel: function()
          {
            var jFrame = $(".scaffolding." + image.image_class + "[data-uri=\"" + image.uri + "\"]");
            var frame = d3.select(jFrame[0]);
            var related_frames = jFrame.closest('.media-layer').children('.scaffolding').filter(function(_,x){ return URI($(x).attr("data-uri")).hostname() == uri.hostname(); });
            related_frames.find(".loading-image").remove();

            var reload_button = d3.selectAll(related_frames.filter(":not(:has(>.reload-button))")).append("span")
              .attr("class", "fa fa-refresh reload-button")
              .attr("title", "Could not load image. Click to reconnect.")
              .each(function(){
                var parent = d3.select(this.parentNode);
                d3.select(this).style({
                  top: (parseInt(parent.style("height"))/2 - 16) + "px",
                  left: (parseInt(parent.style("width"))/2 - 16) + "px",
                  cursor: "pointer"})})
              .on("click", (function(img, frame){
                return function(){
                  var hostname = URI(img.uri).hostname();
                  var images = $(this).closest(".media-layer").children(".scaffolding").filter(function(_,x){ return URI($(x).attr("data-uri")).hostname() == hostname; })
                  var loading_image = d3.selectAll(images).append("img")
                    .attr("class", "loading-image")
                    .attr("src", server_root + "resources/models/parameter-image/" + "ajax-loader.gif")
                    ;
                  images.find(".reload-button").remove();
                  self._open_images(images.map(function(_,x){ return {uri: $(x).attr("data-uri"), image_class: image.image_class}; }));
                }})(image, frame));
          },
          success: function(sid)
          {
            var xhr = new XMLHttpRequest();
            var api = "/file";
            if(self.options.video_file_extensions.indexOf(uri.suffix()) > -1)
            {
              api = "/file";
            }
            xhr.image = image;
            //Double encode to avoid cherrypy's auto unencode in the controller
            xhr.open("GET", server_root + "remotes/" + sid + api + uri.pathname() + "?cache=project&project=" + model.project + "&key=" + URI.encode(URI.encode(uri.host() + uri.path())), true);
            xhr.responseType = "arraybuffer";
            xhr.onload = function(e)
            {
              // If we get 404, the remote session no longer exists because it timed-out.
              // If we get 500, there was an internal error communicating to the remote host.
              // Either way, delete the cached session and create a new one.
              if(this.status == 404 || this.status == 500)
              {
                self.remotes.delete_remote(uri.hostname());
                self._open_session(images);
                return;
              }
              // If we get 400, it means that the session is good and we're
              // communicating with the remote host, but something else went wrong
              // (probably file permissions issues).
              if(this.status == 400)
              {
                console.log(this);
                console.log(this.getAllResponseHeaders());
                var message = this.getResponseHeader("slycat-message");
                var hint = this.getResponseHeader("slycat-hint");

                if(message && hint)
                {
                  window.alert(message + "\n\n" + hint);
                }
                else if(message)
                {
                  window.alert(message);
                }
                else
                {
                  window.alert("Error loading image " + this.image.uri + ": " + this.statusText);
                }
                return;
              }
              else
              {
                console.debug("Loaded image");
                // We received the image, so put it in the cache and start-over.
                var array_buffer_view = new Uint8Array(this.response);
                var blob = new Blob([array_buffer_view], {type:this.getResponseHeader('content-type')});
                self.options.image_cache[image.uri] = blob;
                self._open_images(images);
              }
            }
            xhr.send();
          },
        })
      }
      else
      {
        // We received the image, so put it in the cache and start-over.
        var array_buffer_view = new Uint8Array(this.response);
        var blob = new Blob([array_buffer_view], {type:this.getResponseHeader('content-type')});
        self.options.image_cache[image.uri] = blob;
        self._open_images(images);
      }
    }
    xhr.send();
  },

  _close_hidden_simulations: function()
  {
    var self = this;
    $(".media-layer div.image-frame")
      .filter(function(){
        return $.inArray($(this).data("index"), self.options.filtered_indices) == -1
      })
      .each(function(){
        self._remove_image_and_leader_line(d3.select(this));
      })
      ;
  },

  close_all_simulations: function()
  {
    var self = this;
    $(".media-layer div.image-frame")
      .each(function(){
        self._remove_image_and_leader_line(d3.select(this));
      })
      ;
    self._sync_open_images();
  },

  _schedule_hover_canvas: function(e)
  {
    var self = this;
    self._cancel_hover_canvas();

    // Disable hovering whenever anything else is going on ...
    if(self.state != "")
      return;

    self.hover_timer_canvas = window.setTimeout( function(){ self._open_hover_canvas(e) }, self.options.hover_time );
  },

  _open_hover_canvas: function(e)
  {
    var self = this;

    // Disable hovering whenever anything else is going on ...
    if(self.state != "")
      return;

    var x = e.originalEvent.offsetX || e.originalEvent.layerX,
        y = e.originalEvent.offsetY || e.originalEvent.layerY,
        filtered_indices = self.options.filtered_indices,
        filtered_selection = self.options.filtered_selection,
        square_size = self.options.canvas_square_size,
        shift = (square_size / 2),
        selected_square_size = self.options.canvas_selected_square_size,
        selected_shift = (selected_square_size / 2),
        index;

    var selected_match = self._open_first_match(x, y, filtered_selection, selected_shift, selected_square_size);
    if(!selected_match)
      self._open_first_match(x, y, filtered_indices, shift, square_size);
  },

  _open_first_match: function(x, y, indices, shift, size)
  {
    var self = this,
        xvalues = self.options.x,
        yvalues = self.options.y;
    for(var i = indices.length-1; i > -1; i-- )
    {
      index = indices[i];
      x1 = Math.round( self.x_scale( xvalues[index] ) ) - shift;
      y1 = Math.round( self.y_scale( yvalues[index] ) ) - shift;
      x2 = x1 + size;
      y2 = y1 + size;

      if(x >= x1 && x <= x2 && y >= y1 && y <= y2)
      {
        // Disable hovering when there is no uri
        if(self.options.images[index].trim() != "")
        {
          self._open_hover(index);
        }

        return true;
      }
    }
    return false;
  },

  _open_hover: function(image_index)
  {
    var self = this;

    self._close_hover();
    self.opening_image = image_index;

    var width = self.svg.attr("width");
    var height = self.svg.attr("height");
    var hover_width = Math.min(width, height) * 0.85;
    var hover_height = Math.min(width, height) * 0.85;

    self._open_images([{
      index : self.options.indices[image_index],
      uri : self.options.images[self.options.indices[image_index]].trim(),
      image_class : "hover-image",
      x : Math.min(self.x_scale(self.options.x[image_index]) + 10, width  - hover_width  - self.options.border - 10),
      y : Math.min(self.y_scale(self.options.y[image_index]) + 10, height - hover_height - self.options.border - 10),
      width : hover_width,
      height : hover_height,
      target_x : self.x_scale(self.options.x[image_index]),
      target_y : self.y_scale(self.options.y[image_index]),
      no_sync : true,
    }]);
  },

  _cancel_hover_canvas: function()
  {
    var self = this;

    if(self.hover_timer_canvas)
    {
      window.clearTimeout(self.hover_timer_canvas);
      self.hover_timer_canvas = null;
    }
  },

  _hover_timeout: function(image_index, time)
  {
    var self = this;
    var checkInterval = 50;
    var cutoff = 1000;

    if(time > cutoff)
    {
      self._close_hover();
      return;
    }
    else if(self._is_hovering(image_index))
    {
      self.close_hover_timer = window.setTimeout(function(){self._hover_timeout(image_index, 0);}, checkInterval);
    }
    else
    {
      self.close_hover_timer = window.setTimeout(function(){self._hover_timeout(image_index, time+checkInterval);}, checkInterval);
    }
  },

  _is_hovering: function(image_index)
  {
    var self = this;
    //var hoverEmpty = self.image_layer.selectAll(".hover-image[data-index='" + image_index + "']:hover").empty();
    var hoverEmpty = self.media_layer.selectAll(".hover-image[data-index='" + image_index + "']:hover").empty();

    // if(!hoverEmpty)
    // {
    //   return true;
    // }

    // self.image_layer.selectAll(".hover-image").each(function(){
    //   var data_uri = d3.select(this).attr("data-uri");
    //   var videoHoverEmpty = self.video_layer.selectAll("video[data-uri='" + data_uri + "']:hover").empty();
    //   if(!videoHoverEmpty)
    //   {
    //     hoverEmpty = videoHoverEmpty;
    //   }
    // });

    return !hoverEmpty;
  },

  _close_hover: function()
  {
    var self = this;

    self.opening_image = null;

    if(self.close_hover_timer)
    {
      window.clearTimeout(self.close_hover_timer);
      self.close_hover_timer = null;
    }

    // Cancel any pending hover ...
    self._cancel_hover_canvas();

    // Close any current hover images and associated videos ...
    self.media_layer.selectAll(".hover-image").each(function(){
      self._remove_image_and_leader_line(d3.select(this));
    });
  },

  _adjust_leader_line: function(frame_html)
  {
    var self = this;
    var width = $(frame_html.node()).width();
    var height = $(frame_html.node()).height();
    var uri = frame_html.attr("data-uri");
    var x1 = Number(frame_html.attr("data-transx")) + (width / 2);
    var y1 = Number(frame_html.attr("data-transy")) + (height / 2);
    var line = self.line_layer
      .select("line[data-uri='" + uri + "']")
      .attr("x1", x1)
      .attr("y1", y1)
      ;
  },

  _remove_image_and_leader_line: function(frame_html)
  {
    var self = this;
    var uri = frame_html.attr("data-uri");
    var line = self.line_layer.select("line[data-uri='" + uri + "']");
    frame_html.remove();
    line.remove();
  },

  _scale_width: function(ratio, target_width, target_height)
  {
    var target_ratio = target_width / target_height;
    if(ratio > target_ratio)
    {
      return target_width;
    }
    else
    {
      return ratio * target_height;
    }
  },

  pin: function(simulations)
  {
    var self = this;

    // Set default image size
    var imageWidth = self.options.pinned_width;
    var imageHeight = self.options.pinned_height;

    var images = [];
    simulations.forEach(function(image_index, loop_index)
    {
      images.push({
        index : self.options.indices[image_index],
        uri : self.options.images[self.options.indices[image_index]].trim(),
        image_class : "open-image",
        x : self._getDefaultXPosition(image_index, imageWidth),
        y : self._getDefaultYPosition(image_index, imageHeight),
        width : imageWidth,
        height : imageHeight,
        target_x : self.x_scale(self.options.x[image_index]),
        target_y : self.y_scale(self.options.y[image_index]),
        });
    });
    self._open_images(images);
  },
  });
});
