/*
 Copyright 2013, Sandia Corporation. Under the terms of Contract
 DE-AC04-94AL85000 with Sandia Corporation, the U.S. Government retains certain
 rights in this software.
 */

function Movie(plot) {
  // a plot has access to the image set for the specific cell of the grid
  this.plot = plot;
  this.built = false;
  this.open = false;
  this.stopped = true;
  this.container = this.plot.plot_ref + " .movie";
  this.frame = null;
  this.d3_movie = null;
  this.interval = 400;
  this.current_image = null;
  // TODO leverage bookmarker here for state of movie
  // start out of range and we increment when we ask for the next image
  this.current_image_index = -1;
  this.height = null;
  this.width = null;
  this.loaded_image_count = 0;
  this.errored_image_count = 0;
  this.open_control = null; //handle to foreignObject so SVG can manipulate
  $(this.container).hide();
}

Movie.prototype.add_loader = function() {
  var self = this;
  this.show();
  if(!this.loader){
    this.loader = new LoadingAnimation({
      start : this.loaded_image_count,
      end : this.plot.scatterplot_obj.scatterplot("get_option", "images").filter(function(x){return x.length > 0;}).length,
      errored : this.errored_image_count,
      selector : this.plot.grid_ref,
      radius : function(){return 3*self.plot.scatterplot_obj.attr("height") / 8},
      complete_callback : function(){
          self.built = true;
          self.play();
        },
      resize_parent : $(this.plot.scatterplot_obj.scatterplot("get_option", "display_pane")),
    });
  }
  else {
    this.loader.options.start = this.loaded_image_count;
  }
  this.loader.init();
}

Movie.prototype.build_movie = function() {
  var self = this;
  // TODO images for "image set"
  // TODO this may just work after LG fixes controls wrt image set??
  
  if(!self.built) {
    self.add_loader();
  }

  if(!self.d3_movie) {
    self.frame = d3.select(self.container).append("rect")
      .attr("class", "outline")
      .attr("x", 0)
      .attr("y", 0)
      .style("stroke", "black")
      .style("stroke-width", "1px")
      .style("fill", "white");

    self.d3_movie = d3.select(this.container).selectAll("image")
      .data(self.plot.images.filter(function(d){return d.length > 0;}))
      .enter().append("image")
      .attr("y", 1)
      .attr({ "xlink:href" : function(d) {return self.plot.image_url_for_session(d);},
        })
      .style("visibility", function(_,i) {return i == 0 ? "visible" : "hidden";})
      .each(function(d,i){
          $(this)
            .load( function(){ self.loaded_image_count++; self.loader.update(1); })
            .error( function(){ self.errored_image_count++; self.loader.update_error(1); });
        });
  }

  self.build_close_button(d3.select(self.container));
};

Movie.prototype.build_open_button = function(container) {
  var self = this;

  var width = 28,
      height = 28;

  self.open_control = container.append('g')
    .classed('open-movie', true)
    .on('click', function() {
      d3.event.stopPropagation();
      self.play();
    })
    .on('mousedown', function() {
      d3.event.stopPropagation();
    })
    .on('mouseup', function() {
      d3.event.stopPropagation();
    })
    .attr('width', width)
    .attr('height', height);

  var radius = self.open_control.attr('width')/2;

  self.open_control.append('image')
      .attr('xlink:href', this.plot.scatterplot_obj.scatterplot("get_option", "server_root") +
        "css/play.png")
      .attr('transform', 'translate(' + self.open_control.attr("width")/2 + ',0)')
      .attr('width', width)
      .attr('height', height);

};

Movie.prototype.build_close_button = function(container) {
  var self = this;
  var close_button = container.append("g")
        .classed("close-movie", true);
  close_button.append("rect")
    .attr("x", 5)
    .attr("y", 5)
    .attr("width", 16)
    .attr("height", 16)
    .attr("rx", 2)
    .attr("ry", 2)
    .style("fill", "rgba(0%,0%,0%,0.2)")
    .on("click", function() {
      self.stop();
      self.hide();
    });
  close_button.append("path")
    .attr("d", "M" + (8) + " " + (8) + " l10 10 m0 -10 l-10 10")
    .style("stroke", "rgba(100%,100%,100%, 0.8)")
    .style("stroke-width", 3)
    .style("pointer-events", "none");
};

Movie.prototype.show = function() {
  var self = this;
  // TODO .show() for reopens
  $(self.plot.plot_ref + ' .scatterplot').hide();
  $('svg .image-layer').hide();
  self.open = true;
  self.resize();
  $(self.container).show();
};

Movie.prototype.resize = function() {
  var self = this;
  if (self.built && self.open) { // a) prevent it from breaking if called before movie built, b) unnecessary to update while hidden
    var plot = $(this.plot.plot_ref + ' .scatterplot');
    self.height = Number(plot.attr("height"));
    self.width = Number(plot.attr("width"));
    self.d3_movie
      .attr("width", self.width + 1)
      .attr("height", self.height + 1);
    self.frame
      .attr("width", self.width + 3)
      .attr("height", self.height + 3);
  }
};

// when the movie is over (reached end of loop), repeat by calling loop again
Movie.prototype.check_for_loop_end = function(transition, d3_obj, callback) {
  var n = 0;
  var self = this;
  transition
    .each(function() {++n;})
    .each("end", function() {if(!--n && !self.stopped) callback.apply(d3_obj, arguments);});
};

Movie.prototype.loop = function() {
  var self = this;
  // see http://stackoverflow.com/questions/23875661/looping-through-a-set-of-images-using-d3js
  // and see my jsfiddel related to this - http://jsfiddle.net/1270p51q/2/
  var indices_with_images = this.plot.images
      .map(function(d,i){return [d,i];})
      .filter(function(d){return d[0].length > 0;})
      .map(function(d){return d[1];});
  var update_selected_image = function(uri, index)
  {
    if(self.stopped) {
      update_selected_image = function(){};
    }
    else {
      table.select_rows([indices_with_images[index]]);
    }
  };

  // Reset the whole thing
  self.d3_movie.transition()
      .style("visibility", function(_,i){return i == 0 ? "visible" : "hidden";});

  var add_transition = function(i){
    d3.select(self.d3_movie[0][i]).transition()
           .each("start", function(d){
             update_selected_image(d,i);
             if(i) {
               d3.select(self.d3_movie[0][i-1]).style("visibility", "hidden");
             }
             else {
               d3.select(self.d3_movie[0][self.d3_movie[0].length - 1]).style("visibility", "hidden");
             }
             d3.select(self.d3_movie[0][i]).style("visibility", "visible");
           })
           .delay(function(d,i){return self.interval;})
           .call(self.check_for_loop_end, self, self.loop)
           .each("end", function(d){
            if(!self.stopped) {
              //Register the next transition on each transition (Unless we've stopped):
              add_transition((i+1) % self.d3_movie[0].length);
            }
           });
  }

  //TODO: Remove current image, substitute new image
  // Start with the first image
  add_transition(0);
};

Movie.prototype.play = function(on_success) {
  var self = this;
  this.stopped = false;
  // TODO get ALL hostnames for the image set - assuming there can be more than one?
  // TODO set the hostname to something ... loop over all hostnames and get session cache for that hostname
  // TODO right now we just look at the first image

  if(!login.logged_into_host_for_file(self.plot.images[0])) {
    self.stop();
    var plot = $(self.plot.plot_ref + " .scatterplot");
    var images = plot.scatterplot("get_option", "images")
      .filter(function(image){ return image.length > 0; })
      .map(function(image, index)
      {
        return {index : image.index,
          uri : image.trim(),
          image_class : "open-image",
        }
      });
    login.show_prompt(images, function(){this.play(on_success)}, this);
  } else {
    if(on_success) {
      on_success();
    }
    if(!self.built) {
      self.build_movie();
    }
    else{
      self.show();
      self.loop();
    }
    return true;
  }
};

Movie.prototype.stop = function() {
  var self = this;
  self.stopped = true;
  self.hide();

};

Movie.prototype.step = function() {

};

Movie.prototype.hide = function() {
  var self = this;
  $(self.container).hide();
  self.open = false;
  $(self.plot.plot_ref + ' .scatterplot').show();
  $('svg .image-layer').show();
  if(this.loader) {
    this.loader.remove();
  }

};

Movie.prototype.next_image = function() {
  this.increment_current_image_index();
  if(this.plot.images) {
    this.current_image = this.plot.images[this.current_image_index];
  }
  return this.current_image;
};

Movie.prototype.increment_current_image_index = function() {
  // TODO consider direction of play when we get there
  if(this.plot.images && this.current_image_index >= this.plot.images.length) {
    this.current_image_index = 0;
  }
  this.current_image_index = this.current_image_index + 1;
};
