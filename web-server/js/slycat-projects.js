/*
Copyright 2013, Sandia Corporation. Under the terms of Contract
DE-AC04-94AL85000 with Sandia Corporation, the U.S. Government retains certain
rights in this software.
*/

define("slycat-projects", ["slycat-server-root"], function(server_root)
{
  // Server-side-events loop to keep track of the current user's list of projects.
  var projects = ko.observableArray();
  var project_ids = {}
  var source = null;

  function start()
  {
    source = new EventSource(server_root + "projects-feed");
    source.onmessage = function(event)
    {
      message = JSON.parse(event.data);
      if(message.deleted)
      {
        if(message.id in project_ids)
        {
          delete project_ids[message.id];
          for(var i = 0; i != projects().length; ++i)
          {
            if(projects()[i]._id() == message.id)
            {
              projects.splice(i, 1);
              break;
            }
          }
        }
      }
      else
      {
        var project = message.doc;
        if(project._id in project_ids)
        {
          ko.mapping.fromJS(project, project_ids[project._id]);
        }
        else
        {
          project_ids[project._id] = ko.mapping.fromJS(project);
          projects.push(project_ids[project._id]);
        }
      }
    }
    source.onerror = function(event)
    {
    }
  }

  var module = {};

  module.watch = function()
  {
    if(!source)
      start();
    return projects;
  }

  module.seed = function(project)
  {
    if(project._id in project_ids)
      return;

    project_ids[project._id] = ko.mapping.fromJS(
    {
      _id: project._id,
      name: project.name || "",
      description: project.description || "",
      created: project.created || "",
      creator: project.creator || "",
      acl: project.acl || {"administrators":[],"writers":[],"readers":[]},
    });
    projects.push(project_ids[project._id]);
  }

  return module;
});
