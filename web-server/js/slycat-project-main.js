/*
Copyright 2013, Sandia Corporation. Under the terms of Contract
DE-AC04-94AL85000 with Sandia Corporation, the U.S. Government retains certain
rights in this software.
*/

define("slycat-project-main", ["slycat-server-root", "slycat-web-client", "slycat-markings", "slycat-models-feed", "slycat-dialog", "knockout", "knockout-mapping", "URI"], function(server_root, client, markings, models_feed, dialog, ko, mapping, URI)
{
  var module = {}
  module.start = function()
  {
    var page = {};
    page.server_root = server_root;
    page.project = mapping.fromJS({_id: URI(window.location).segment(-1), name: "", description: "",created: "",creator: "",acl:{administrators:[],writers:[],readers:[]}});
    page.models = models_feed.watch().filter(function(model)
    {
      return model.project() == page.project._id();
    });
    page.markings = markings.allowed;
    page.badge = function(marking)
    {
      for(var i = 0; i != page.markings().length; ++i)
      {
        if(page.markings()[i].type() == marking)
          return page.markings()[i].badge();
      }
    }

    page.references = mapping.fromJS([]);
    page.saved_bookmarks = page.references.filter(function(reference)
    {
      return reference.bid() && reference.mid();
    }).map(function(reference)
    {
      var model = ko.utils.arrayFirst(page.models(), function(model)
      {
        return model._id() == reference.mid();
      });

      return {
        _id: reference._id,
        name: reference.name,
        model_name: model ? model.name() : "",
        model_type: model ? model["model-type"]() : "",
        created: reference.created,
        creator: reference.creator,
        uri: server_root + "models/" + reference.mid() + "?bid=" + reference.bid(),
      };
    });
    page.edit_saved_bookmark = function(reference)
    {
    }
    page.delete_saved_bookmark = function(reference)
    {
      dialog.dialog(
      {
        title: "Delete Saved Bookmark?",
        message: "The saved bookmark will be deleted immediately and there is no undo.  This will not affect any existing models or bookmarks.",
        buttons: [{className: "btn-default", label:"Cancel"}, {className: "btn-danger",label:"OK"}],
        callback: function(button)
        {
          if(button.label != "OK")
            return;
          client.delete_reference(
          {
            rid: reference._id(),
            success: function()
            {
              page.update_references();
            },
            error: dialog.ajax_error("Couldn't delete template."),
          });
        },
      });
    }
    page.templates = page.references.filter(function(reference)
    {
      return reference.bid() && !reference.mid();
    });
    page.edit_template = function(reference)
    {
    }
    page.delete_template = function(reference)
    {
      dialog.dialog(
      {
        title: "Delete Template?",
        message: "The template will be deleted immediately and there is no undo.  This will not affect any existing models.",
        buttons: [{className: "btn-default", label:"Cancel"}, {className: "btn-danger",label:"OK"}],
        callback: function(button)
        {
          if(button.label != "OK")
            return;
          client.delete_reference(
          {
            rid: reference._id(),
            success: function()
            {
              page.update_references();
            },
            error: dialog.ajax_error("Couldn't delete template."),
          });
        },
      });
    }

    page.update_references = function()
    {
      client.get_project_references(
      {
        pid: page.project._id(),
        success: function(references)
        {
          mapping.fromJS(references, page.references);
        }
      });
    }

    page.update_references();

    ko.applyBindings(page);
  };

  return module;
});
