define("slycat-parameter-image-filter-manager", ["slycat-server-root", "lodash", "knockout", "knockout-mapping", "jquery"], function(server_root, _,  ko, mapping, $) {

  function FilterManager(model_id, bookmarker, layout, input_columns, output_columns, image_columns, rating_columns, category_columns) {
    var self = this;

    self.model_id = model_id;
    self.bookmarker = bookmarker;
    self.layout = layout;
    self.input_columns = input_columns;
    self.output_columns = output_columns;
    self.image_columns = image_columns;
    self.rating_columns = rating_columns;
    self.category_columns = category_columns;
    self.other_columns = null;
    self.sliders_ready = false;
    self.slidersPaneHeight = ko.observable();
    self.controls_ready = false;
    self.allFilters = null;
    self.active_filters = null;
    self.active_filters_ready = ko.observable(false);

  }

  /* Until AJAX handling is refactored, have to manually pass data at different times. Extremely ugly,
     but it makes these dependencies explicit and thus will be easier to decouple later. */
  FilterManager.prototype.set_bookmark = function(bookmark) {
    this.bookmark = bookmark;
  };

  /* Until AJAX handling is refactored, have to manually pass data at different times. Extremely ugly,
     but it makes these dependencies explicit and thus will be easier to decouple later. */
  FilterManager.prototype.set_other_columns = function(other_columns) {
    this.other_columns = other_columns;
  };

  /* Until AJAX handling is refactored, have to manually pass data at different times. Extremely ugly,
     but it makes these dependencies explicit and thus will be easier to decouple later. */
  FilterManager.prototype.set_table_metadata = function(table_metadata) {
    this.table_metadata = table_metadata;
  };

  /* Until AJAX handling is refactored, have to manually pass data at different times. Extremely ugly,
     but it makes these dependencies explicit and thus will be easier to decouple later. */
  FilterManager.prototype.set_table_statistics = function(table_statistics) {
    this.table_statistics = table_statistics;
  };

  /* Until AJAX handling is refactored, have to manually pass data at different times. Extremely ugly,
     but it makes these dependencies explicit and thus will be easier to decouple later. */
  FilterManager.prototype.notify_controls_ready = function() {
    this.controls_ready = true;
  };

  FilterManager.prototype.build_sliders = function(controls_ready) {
    var self = this;
    if (!self.sliders_ready && self.controls_ready && self.table_metadata && self.table_statistics && (self.table_statistics.length == self.table_metadata["column-count"]) && self.other_columns) {
      self.sliders_ready = true;
      $("#sliders-pane .load-status").css("display", "none");

      var variable_order = self.input_columns.concat(self.output_columns, self.rating_columns, self.category_columns, self.other_columns);
      var numeric_variables = [];
      for (var i = 0; i < self.table_metadata["column-count"]; i++) {
        if (self.table_metadata["column-types"][i] != 'string' && !(_.includes(self.category_columns, i)) && self.table_metadata["column-count"]-1 > i) {
          numeric_variables.push(i);
        }
      }

      self.allFilters = ko.observableArray();
      var numericFilters, categoryFilters, activeFilters;

      // have to be built after allFilters is assigned, and it's reassigned from bookmark,
      // so call this from both conditional clauses
      var buildComputedFilters = function(filters) {
        activeFilters = ko.pureComputed(function() {
          return _.filter(filters(), function(f) { return f.active(); });
        });
        // activeFilters = filters.filter(function(f) { return f.active(); });
        self.active_filters = ko.pureComputed(function() {
            return _.filter(filters(), function(f) { return f.active(); });
          })
          .extend({ rateLimit: { timeout: 0, method: "notifyWhenChangesStop" } })
          ;
        numericFilters = ko.pureComputed(function() {
          return _.filter(filters(), function(f) { return f.type() === 'numeric'; });
        });
        categoryFilters = ko.pureComputed(function() {
          return _.filter(filters(), function(f) { return f.type() === 'category'; });
        });
      };

      var rateLimit = 500;
      if ("allFilters" in self.bookmark) {
        self.allFilters = mapping.fromJS(self.bookmark["allFilters"]);
        buildComputedFilters(self.allFilters);

        _.each(numericFilters(), function (filter) {
          filter.rateLimitedHigh = ko.pureComputed( filter.high ).extend({ rateLimit: { timeout: rateLimit, method: "notifyWhenChangesStop" } });
          filter.rateLimitedLow = ko.pureComputed( filter.low ).extend({ rateLimit: { timeout: rateLimit, method: "notifyWhenChangesStop" } });
        });

        _.each(categoryFilters(), function (filter) {
          filter.selected = ko.pureComputed( function(){ 
              return _.filter(filter.categories(), function(category) { return category.selected() === true; });
            })
            .extend({ rateLimit: { timeout: 0, method: "notifyWhenChangesStop" } })
            ;
        });
      }
      else {
        _.each(self.category_columns, function(i) {
          var categories = ko.observableArray();
          self.allFilters.push({
            name: ko.observable( self.table_metadata["column-names"][i] ),
            type: ko.observable('category'),
            index: ko.observable( i ),
            active: ko.observable(false),
            categories: categories,
            selected: ko.pureComputed( function(){ 
                return _.filter(categories(), function(category) { return category.selected() === true; });
              })
              .extend({ rateLimit: { timeout: 0, method: "notifyWhenChangesStop" } })
              ,
            autowidth: ko.observable(false),
            order: ko.observable( variable_order.indexOf(i) ) 
          });
        });

        _.each(numeric_variables, function(i) {
          var high = ko.observable( self.table_statistics[i]["max"] );
          var low = ko.observable( self.table_statistics[i]["min"] );
          self.allFilters.push({
            name: ko.observable( self.table_metadata["column-names"][i] ),
            type: ko.observable('numeric'),
            index: ko.observable( i ),
            max: ko.observable( self.table_statistics[i]["max"] ),
            min: ko.observable( self.table_statistics[i]["min"] ),
            high: high,
            low: low,
            invert: ko.observable(false),
            active: ko.observable(false),
            order: ko.observable( variable_order.indexOf(i) ),
            rateLimitedHigh: ko.pureComputed(high).extend({ rateLimit: { timeout: rateLimit, method: "notifyWhenChangesStop" } }),
            rateLimitedLow: ko.pureComputed(low).extend({ rateLimit: { timeout: rateLimit, method: "notifyWhenChangesStop" } }),
          });
        });

        buildComputedFilters(self.allFilters);
      }

      var ViewModel = function(params) {
        var vm = this;
        self.slidersPaneHeight( $("#sliders-pane").innerHeight() );
        vm.model_id = ko.observable(self.model_id);
        vm.sliderHeight = ko.pureComputed(function() {
          return self.slidersPaneHeight() - 95;
        }, this);
        vm.thumb_length = ko.observable(12);
        vm.allFilters = self.allFilters;
        vm.numericFilters = numericFilters;
        vm.categoryFilters = categoryFilters;
        vm.activeFilters = activeFilters;
        vm.availableFilters = ko.observableArray(
          vm.allFilters.slice(0).sort(function(one, two) {
            return one.order() < two.order() ? -1 : 1;
          })
        );

        if (vm.activeFilters().length > 0) {
          self.layout.open("west");
        }

        _.each(vm.numericFilters(), function (filter) {
          filter.rateLimitedHigh.subscribe(function(newValue) {
            // console.log("rateLimitedHighValue is: " + newValue);
            self.bookmarker.updateState( {"allFilters" : mapping.toJS(vm.allFilters())} );
          });
          filter.rateLimitedLow.subscribe(function(newValue) {
            // console.log("rateLimitedLowValue is: " + newValue);
            self.bookmarker.updateState( {"allFilters" : mapping.toJS(vm.allFilters())} );
          });
        });

        _.each(vm.categoryFilters(), function (filter) {
          filter.categories.subscribe(function(newValue) {
            self.bookmarker.updateState( {"allFilters" : mapping.toJS(vm.allFilters())} );
          });
          filter.selected.subscribe(function(newValue) {
            self.bookmarker.updateState( {"allFilters" : mapping.toJS(vm.allFilters())} );
          });
        });

        vm.activateFilter = function(item, event) {
          if (vm.activeFilters().length === 0) {
            self.layout.open("west");
          }
          var activateFilter = event.target.value;
          var filter, targetFilter, filterType, categories;
          for(var i = vm.allFilters().length-1; i >= 0; i--)
          {
            filter = vm.allFilters()[i];
            if (filter.index() == Number(activateFilter)) {
              filterType = filter.type();
              targetFilter = vm.allFilters.remove(filter)[0];
              if(filterType == 'category' && targetFilter.categories().length == 0)
              {
                categories = ko.observableArray();
                $.ajax({
                  type: "GET",
                  url : server_root + "models/" + vm.model_id() + "/arraysets/data-table/metadata?unique=0/" + targetFilter.index() + "/...",
                  success : function(result) {
                     _(result.unique[0].values[0]).sort().each(function(c) { targetFilter.categories.push({value: ko.observable(c), selected: ko.observable(true)}); }).value(); // selected by default
                    // Bookmark once all unique values are set
                    self.bookmarker.updateState( {"allFilters" : mapping.toJS(vm.allFilters())} );
                  },
                  error: function(result) {
                  }
                });
              }
              // Move it to the end of the array
              vm.allFilters.push( targetFilter );
              // Show it
              targetFilter.active(true);
            }
          }
          event.target.selectedIndex = 0;
          $("#sliders-pane #sliders .slycat-pim-filter:last-child").get(0).scrollIntoView();
          self.bookmarker.updateState( {"allFilters" : mapping.toJS(vm.allFilters())} );
        };
        vm.removeFilter = function(filter, event) {
          filter.active(false);
          if (vm.activeFilters().length == 0) {
            self.layout.close("west");
          }
          self.bookmarker.updateState( {"allFilters" : mapping.toJS(vm.allFilters())} );
        };
        vm.toggleAutoWidth = function(filter, event) {
          if(filter.autowidth())
          {
            filter.autowidth(false);
          }
          else
          {
            filter.autowidth(true);
          }
          self.bookmarker.updateState( {"allFilters" : mapping.toJS(vm.allFilters())} );
        };
        vm.invertFilter = function(filter, event) {
          if(filter.type() === 'numeric')
          {
            filter.invert( !filter.invert() );
            self.bookmarker.updateState( {"allFilters" : mapping.toJS(vm.allFilters())} );
          }
          else if(filter.type() === 'category') 
          {
            _.each(filter.categories(), function(category){
              if(category.selected())
              {
                category.selected(false);
              }
              else
              {
                category.selected(true);
              }
            });
          }
        };
        vm.selectAll = function(filter, event) {
          _.each(filter.categories(), function(category){
              category.selected(true);
          });
        };
        vm.selectNone = function(filter, event) {
          _.each(filter.categories(), function(category){
              category.selected(false);
          });
        };
      };

      ko.applyBindings(
        new ViewModel(),
        document.getElementById('parameter-image-plus-layout')
      );

      self.active_filters_ready(true);
    }
  };

  return FilterManager;
});
