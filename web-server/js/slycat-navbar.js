(function()
{
  ko.components.register("slycat-navbar",
  {
    viewModel: function(params)
    {
      console.log("slycat-navbar", $.toJSON(params));

      var server_root = document.querySelector("#slycat-server-root").getAttribute("href");
      var component = this;

      component.alerts = ko.mapping.fromJS([]);
      component.permission = ko.observable("reader");
      component.permission_description = ko.pureComputed(function()
      {
        if(component.permission() == "reader")
          return "Readers can view all data in a project.";
        if(component.permission() == "writer")
          return "Writers can view all data in a project, and add, modify, or delete models.";
        if(component.permission() == "administrator")
          return "Administrators can view all data in a project, add, modify, and delete models, modify or delete the project, and add or remove project members.";
      });
      component.new_user = ko.observable("");
      component.model = ko.mapping.fromJS({_id:params.model_id, name:params.model_name, created:"", creator:"",description:"", marking:params.model_marking});
      component.model_popover = ko.pureComputed(function()
      {
        return "<p>" + component.model.description() + "</p><p><small><em>Created " + component.model.created() + " by " + component.model.creator() + "</em></small></p>";
      });
      component.new_model_description = ko.observable("");
      component.new_model_marking = ko.observable(params.model_marking);
      component.new_model_name = ko.observable(params.model_name);
      component.project = ko.mapping.fromJS({_id:params.project_id,name:params.project_name,acl:{"administrators":[],"writers":[],"readers":[]},created:"", creator:"", description:""});
      component.new_project = ko.mapping.fromJS({_id:params.project_id,name:params.project_name,acl:{"administrators":[],"writers":[],"readers":[]},created:"", creator:"", description:""});
      component.project_popover = ko.pureComputed(function()
      {
        var members = [];
        for(var i = 0; i != component.project.acl.administrators().length; ++i)
          members.push(component.project.acl.administrators()[i].user());
        for(var i = 0; i != component.project.acl.writers().length; ++i)
          members.push(component.project.acl.writers()[i].user());
        for(var i = 0; i != component.project.acl.readers().length; ++i)
          members.push(component.project.acl.readers()[i].user());
        var result = "<p>" + component.project.description() + "</p>";
        result += "<p><small>Members: " + members.join(",") + "</small></p>";
        result += "<p><small><em>Created " + component.project.created() + " by " + component.project.creator() + "</em></small></p>";
        return result;
      });
      component.server_root = server_root;
      component.user = {uid : ko.observable(""), name : ko.observable("")};
      component.version = ko.mapping.fromJS({version:"", commit:""});
      var open_models_mapping =
      {
        key: function(model)
        {
          return ko.utils.unwrapObservable(model._id);
        },
        create: function(options)
        {
          var result = ko.mapping.fromJS(options.data);
          result.progress_percent = ko.pureComputed(function()
          {
            return result.progress() * 100;
          });
          result.progress_type = ko.pureComputed(function()
          {
            return result.state() === "running" ? "success" : null;
          });
          return result;
        },
      }
      component.open_models = ko.mapping.fromJS([], open_models_mapping);
      component.finished_models = component.open_models.filter(function(model)
      {
        return model.state() == "finished";
      });
      component.running_models = component.open_models.filter(function(model)
      {
        return model.state() != "finished";
      });
      component.markings = ko.mapping.fromJS([]);

      component.close_model = function(model)
      {
        $.ajax(
        {
          contentType : "application/json",
          data : $.toJSON({ "state" : "closed" }),
          processData : false,
          type : "PUT",
          url : server_root + "models/" + model._id(),
        });
      }

      component.create_project = function()
      {
        var project =
        {
          "name" : component.new_project.name(),
          "description" : component.new_project.description(),
        };

        $.ajax(
        {
          contentType : "application/json",
          data: $.toJSON(project),
          processData: false,
          type : "POST",
          url : server_root + "projects",
          success: function(result)
          {
            window.location.href = server_root + "projects/" + result.id;
          },
          error: function(request, status, reason_phrase)
          {
            window.alert("Error creating project: " + reason_phrase);
          }
        });
      }

      component.edit_project = function()
      {
        ko.mapping.fromJS(ko.mapping.toJS(component.project), component.new_project)
      }

      component.add_project_member = function()
      {
        if(component.permission() == "reader")
        {
          component.new_project.acl.readers.push({user:ko.observable(component.new_user())})
        }
        if(component.permission() == "writer")
        {
          component.new_project.acl.writers.push({user:ko.observable(component.new_user())})
        }
        if(component.permission() == "administrator")
        {
          component.new_project.acl.administrators.push({user:ko.observable(component.new_user())})
        }
      }

      component.remove_project_member = function(context)
      {
        component.new_project.acl.readers.remove(function(item)
        {
          return item.user()==context.user();
        });
        component.new_project.acl.writers.remove(function(item)
        {
          return item.user()==context.user();
        });
        component.new_project.acl.administrators.remove(function(item)
        {
          return item.user()==context.user();
        });
      }

      component.save_project = function()
      {
        var project =
        {
          "name" : component.new_project.name(),
          "description" : component.new_project.description(),
          "acl" : ko.mapping.toJS(component.new_project.acl),
        };

        $.ajax(
        {
          type : "PUT",
          url : server_root + "projects/" + params.project_id,
          contentType : "application/json",
          data : $.toJSON(project),
          processData : false,
          success : function()
          {
            document.location.reload(true);
          },
          error : function(request, status, reason_phrase)
          {
            window.alert("Error updating project: " + reason_phrase);
          }
        });
      }

      component.delete_project = function()
      {
        if(window.confirm("Delete " + component.project.name() + "? Every project model and all data will be deleted immediately, and this cannot be undone."))
        {
          $.ajax(
          {
            type : "DELETE",
            url : server_root + "projects/" + params.project_id,
            success : function()
            {
              window.location.href = server_root + "projects";
            }
          });
        }
      }

      component.save_model = function()
      {
        var model =
        {
          "name" : component.new_model_name(),
          "description" : component.new_model_description(),
          "marking" : component.new_model_marking(),
        };

        $.ajax(
        {
          type : "PUT",
          url : server_root + "models/" + params.model_id,
          contentType : "application/json",
          data : $.toJSON(model),
          processData : false,
          success : function()
          {
            if(component.new_model_marking() !== component.model.marking())
            {
              // Since marking changes have the potential to alter the page
              // structure in arbitrary ways, just reload.
              document.location.reload(true);
            }
            else
            {
              component.model.name(component.new_model_name());
              component.model.description(component.new_model_description());
              component.model.marking(component.new_model_marking());
            }
          },
          error : function(request, status, reason_phrase)
          {
            window.alert("Error updating model: " + reason_phrase);
          }
        });
      }

      component.delete_model = function()
      {
        if(window.confirm("Delete " + component.model.name() + "? All data will be deleted immediately, and this cannot be undone."))
        {
          $.ajax(
          {
            type : "DELETE",
            url : server_root + "models/" + params.model_id,
            success : function()
            {
              window.location.href = server_root + "projects/" + params.project_id;
            }
          });
        }
      }

      component.open_documentation = function()
      {
        window.open("http://slycat.readthedocs.org");
      }

      component.support_request = function()
      {
        $.ajax(
        {
          type : "GET",
          url : server_root + "configuration/support-email",
          success : function(email)
          {
            window.location.href = "mailto:" + email.address + "?subject=" + email.subject;
          }
        });
      }

      // If there's a current project, load it.
      if(params.project_id)
      {
        $.ajax(
        {
          dataType: "json",
          type : "GET",
          url : server_root + "projects/" + params.project_id,
          success : function(project)
          {
            ko.mapping.fromJS(project, component.project);
            ko.mapping.fromJS(project, component.new_project);
          },
        });
      }

      // If there's a current model, load it.
      if(params.model_id)
      {
        $.ajax(
        {
          type : "GET",
          url : server_root + "models/" + params.model_id,
          success : function(model)
          {
            ko.mapping.fromJS(model, component.model);
            component.new_model_description(model.description);

            if(model.state == "waiting")
              component.alerts.push({"type":"info", "message":"The model is waiting for data to be uploaded.", "detail":null})

            if(model.state == "running")
              component.alerts.push({"type":"success", "message":"The model is being computed.  Patience!", "detail":null})

            if(model.result == "failed")
              component.alerts.push({"type":"danger", "message":"Model failed to build.  Here's what was happening when things went wrong:", "detail": model.message})

            if(model.state == "finished")
            component.close_model(component.model);
          },
        });
      }

      // Get information about the currently-logged-in user.
      $.ajax(
      {
        type : "GET",
        url : server_root + "users/-",
        success : function(user)
        {
          component.user.uid(user.uid);
          component.user.name(user.name);
        }
      });

      // Get information about the current server version.
      $.ajax(
      {
        type : "GET",
        url : server_root + "configuration/version",
        success : function(version)
        {
          ko.mapping.fromJS(version, component.version);
        }
      });

      // Get the set of allowed server markings.
      $.ajax(
      {
        type : "GET",
        url : server_root + "configuration/markings",
        success : function(markings)
        {
          ko.mapping.fromJS(markings, component.markings);
        }
      });

      // Get information about open models.
      var current_revision = null;
      function get_models()
      {
        $.ajax(
        {
          dataType : "text",
          type : "GET",
          cache : false, // Don't cache this request; otherwise, the browser will display the JSON if the user leaves this page then returns.
          url : server_root + "models" + (current_revision != null ? "?revision=" + current_revision : ""),
          success : function(text)
          {
            // https://github.com/jquery/jquery-migrate/blob/master/warnings.md#jqmigrate-jqueryparsejson-requires-a-valid-json-string
            var results = text ? $.parseJSON(text) : null;
            if(results)
            {
              current_revision = results.revision;
              results.models.sort(function(left, right)
              {
                return left.created == right.created ? 0 : (left.created < right.created ? -1 : 1);
              });
              ko.mapping.fromJS(results.models, component.open_models);
            }

            // Restart the request immediately.
            window.setTimeout(get_models, 10);
          },
          error : function(request, status, reason_phrase)
          {
            // Rate-limit requests when there's an error.
            window.setTimeout(get_models, 5000);
          }
        });
      }

      get_models();
    },
    template: ' \
<div class="bootstrap-styles"> \
  <nav class="navbar navbar-default"> \
    <div class="container"> \
      <div class="navbar-header"> \
        <button type="button" class="navbar-toggle collapsed" data-toggle="collapse" data-target="#slycat-navbar-content"> \
          <span class="sr-only">Toggle navigation</span> \
          <span class="icon-bar"></span> \
          <span class="icon-bar"></span> \
          <span class="icon-bar"></span> \
        </button> \
        <a class="navbar-brand" data-bind="attr:{href:server_root + \'projects\'}">Slycat</a> \
      </div> \
      <div class="collapse navbar-collapse" id="slycat-navbar-content"> \
        <ol class="breadcrumb navbar-left"> \
          <li data-bind="visible: true"><a data-bind="attr:{href:server_root + \'projects\'}">Projects</a></li> \
          <li data-bind="visible: project._id"><a data-bind="text:project.name,popover:{trigger:\'hover\',html:true,content:project_popover()},attr:{href:server_root + \'projects/\' + project._id()}"></a></li> \
          <li data-bind="visible: model._id"><a id="slycat-model-description" data-bind="text:model.name,popover:{trigger:\'hover\',html:true,content:model_popover()}"></a></li> \
        </ol> \
        <ul class="nav navbar-nav navbar-left" data-bind="visible: open_models().length"> \
          <li class="dropdown"> \
            <a class="dropdown-toggle" data-toggle="dropdown"><span class="badge"><span data-bind="text:running_models().length"></span> / <span data-bind="text:finished_models().length"></span></span><span class="caret"></span></a> \
            <ul class="dropdown-menu"> \
              <!-- ko foreach: finished_models --> \
                <li> \
                  <a data-bind="attr:{href:$parent.server_root + \'models/\' + $data._id()},popover:{trigger:\'hover\',content:$data.message()}"> \
                    <button type="button" class="btn btn-default btn-xs" data-bind="click:$parent.close_model,clickBubble:false,css:{\'btn-success\':$data.result()===\'succeeded\',\'btn-danger\':$data.result()!==\'succeeded\'}"><span class="glyphicon glyphicon-ok"></span></button> \
                    <span data-bind="text:name"></span> \
                  </a> \
                </li> \
              <!-- /ko --> \
              <li class="divider" data-bind="visible:finished_models().length && running_models().length"></li> \
              <!-- ko foreach: running_models --> \
                <li> \
                  <a data-bind="attr:{href:$parent.server_root + \'models/\' + $data._id()}"> \
                    <span data-bind="text:name"></span> \
                  </a> \
                  <div style="height:10px; margin: 0 10px" data-bind="progress:{value:progress_percent,type:progress_type}"> \
                </li> \
              <!-- /ko --> \
            </ul> \
          </li> \
        </ul> \
        <ul class="nav navbar-nav navbar-right"> \
          <li data-bind="visible: !project._id() && !model._id()"><button type="button" class="btn btn-xs btn-success navbar-btn" data-toggle="modal" data-target="#slycat-create-project">Create Project</button></li> \
          <li data-bind="visible: project._id() && !model._id()"><button type="button" class="btn btn-xs btn-info navbar-btn" data-bind="click:edit_project" data-toggle="modal" data-target="#slycat-edit-project">Edit Project</button></li> \
          <li data-bind="visible: model._id()"><button type="button" class="btn btn-xs btn-info navbar-btn" data-toggle="modal" data-target="#slycat-edit-model">Edit Model</button></li> \
          <li class="navbar-text"><span data-bind="text:user.name"></span> (<span data-bind="text:user.uid"></span>)</li> \
          <li class="dropdown"> \
            <a class="dropdown-toggle" data-toggle="dropdown">Help <span class="caret"></span></a> \
            <ul class="dropdown-menu"> \
              <li><a data-toggle="modal" data-target="#slycat-about">About Slycat</a></li> \
              <li><a data-bind="click:support_request">Support Request</a></li> \
              <li><a data-bind="click:open_documentation">Documentation</a></li> \
            </ul> \
          </li> \
        </ul> \
      </div> \
    </div> \
  </nav> \
  <!-- ko foreach: alerts --> \
    <div class="alert slycat-navbar-alert" data-bind="css:{\'alert-danger\':$data.type === \'danger\',\'alert-info\':$data.type === \'info\',\'alert-success\':$data.type === \'success\'}"> \
      <p data-bind="text:message"></p> \
      <pre data-bind="visible:detail,text:detail,css:{\'bg-danger\':$data.type === \'danger\',\'bg-info\':$data.type === \'info\',\'bg-success\':$data.type === \'success\'}"></pre> \
    </div> \
  <!-- /ko --> \
  <div class="modal fade" id="slycat-about"> \
    <div class="modal-dialog"> \
      <div class="modal-content"> \
        <div class="modal-body"> \
          <div class="jumbotron"> \
            <img data-bind="attr:{src:server_root + \'css/slycat-brand.png\'}"/> \
            <p>&hellip; is the web-based analysis and visualization platform created at Sandia National Laboratories.</p> \
          </div> \
          <p>Version <span data-bind="text:version.version"></span>, commit <span data-bind="text:version.commit"></span></p> \
          <p><small>Copyright 2013, Sandia Corporation. Under the terms of Contract DE-AC04-94AL85000 with Sandia Corporation, the U.S. Government retains certain rights in this software.</small></p> \
        </div> \
        <div class="modal-footer"> \
          <button type="button" class="btn btn-default" data-dismiss="modal">Close</button> \
        </div> \
      </div> \
    </div> \
  </div> \
  <div class="modal fade" id="slycat-create-project"> \
    <div class="modal-dialog"> \
      <div class="modal-content"> \
        <div class="modal-header"> \
          <h3 class="modal-title">Create Project</h3> \
        </div> \
        <div class="modal-body"> \
          <form class="form-horizontal"> \
            <div class="form-group"> \
              <label for="slycat-create-project-name" class="col-sm-2 control-label">Name</label> \
              <div class="col-sm-10"> \
                <input id="slycat-create-project-name" class="form-control" type="text" placeholder="Name" data-bind="value:new_project.name"></input> \
              </div> \
            </div> \
            <div class="form-group"> \
              <label for="slycat-create-project-description" class="col-sm-2 control-label">Description</label> \
              <div class="col-sm-10"> \
                <textarea id="slycat-create-project-description" class="form-control" placeholder="Description" rows="5" data-bind="value:new_project.description"></textarea> \
              </div> \
            </div> \
          </form> \
        </div> \
        <div class="modal-footer"> \
          <button class="btn btn-primary" data-bind="click:create_project" data-dismiss="modal">Create Project</button> \
          <button class="btn btn-warning" data-dismiss="modal">Cancel</button> \
        </div> \
      </div> \
    </div> \
  </div> \
  <div class="modal fade" id="slycat-edit-project"> \
    <div class="modal-dialog"> \
      <div class="modal-content"> \
        <div class="modal-header"> \
          <h3 class="modal-title">Edit Project</h3> \
        </div> \
        <div class="modal-body"> \
          <form class="form-horizontal"> \
            <div class="form-group"> \
              <label for="slycat-project-name" class="col-sm-2 control-label">Name</label> \
              <div class="col-sm-10"> \
                <input id="slycat-project-name" class="form-control" type="text" placeholder="Name" data-bind="value:new_project.name"></input> \
              </div> \
            </div> \
            <div class="form-group"> \
              <label for="slycat-project-description" class="col-sm-2 control-label">Description</label> \
              <div class="col-sm-10"> \
                <textarea id="slycat-project-description" class="form-control" placeholder="Description" rows="5" data-bind="value:new_project.description"></textarea> \
              </div> \
            </div> \
            <div class="form-group"> \
              <label class="col-sm-2 control-label">Members</label> \
              <div class="col-sm-10"> \
                <p class="form-control-static"> \
                <!-- ko foreach: new_project.acl.administrators --> \
                  <span class="label label-danger"><span data-bind="text:user"></span><span class="glyphicon glyphicon-remove" data-bind="click:$parent.remove_project_member"></span></span> \
                <!-- /ko --> \
                <!-- ko foreach: new_project.acl.writers --> \
                  <span class="label label-warning"><span data-bind="text:user"></span><span class="glyphicon glyphicon-remove" data-bind="click:$parent.remove_project_member"></span></span> \
                <!-- /ko --> \
                <!-- ko foreach: new_project.acl.readers --> \
                  <span class="label label-primary"><span data-bind="text:user"></span><span class="glyphicon glyphicon-remove" data-bind="click:$parent.remove_project_member"></span></span> \
                <!-- /ko --> \
                </p> \
              </div> \
            </div> \
          </form> \
        </div> \
        <div class="modal-footer"> \
          <button class="btn btn-danger pull-left" data-bind="click:delete_project">Delete Project</button> \
          <button class="btn btn-success pull-left" data-toggle="modal" data-target="#slycat-add-project-member">Add Project Member</button> \
          <button class="btn btn-primary" data-bind="click:save_project" data-dismiss="modal">Save Project</button> \
          <button class="btn btn-warning" data-dismiss="modal">Cancel</button> \
        </div> \
      </div> \
    </div> \
  </div> \
  <div class="modal fade" id="slycat-add-project-member"> \
    <div class="modal-dialog"> \
      <div class="modal-content"> \
        <div class="modal-header"> \
          <h3 class="modal-title">Add Project Member</h3> \
        </div> \
        <div class="modal-body"> \
          <form class="form-horizontal"> \
            <div class="form-group"> \
              <label class="col-sm-2 control-label">Permissions</label> \
              <div class="col-sm-10"> \
                <div class="btn-group" data-toggle="buttons" data-bind="radio:permission" style="width:100%"> \
                  <label class="btn btn-primary"><input type="radio" value="reader"/>Reader</label> \
                  <label class="btn btn-primary"><input type="radio" value="writer"/>Writer</label> \
                  <label class="btn btn-primary"><input type="radio" value="administrator"/>Administrator</label> \
                </div> \
                <p class="help-block" data-bind="text:permission_description"></p> \
              </div> \
            </div> \
            <div class="form-group"> \
              <label class="col-sm-2 control-label">Username</label> \
              <div class="col-sm-10"> \
                <input type="text" class="form-control input-sm" title="Username" placeholder="Username" data-bind="value:new_user"></input> \
              </div> \
            </div> \
          </form> \
        </div> \
        <div class="modal-footer"> \
          <button class="btn btn-success" data-dismiss="modal" data-bind="click:add_project_member">Add Member</button> \
          <button class="btn btn-warning" data-dismiss="modal">Cancel</button> \
        </div> \
      </div> \
    </div> \
  </div> \
  <div class="modal fade" id="slycat-edit-model"> \
    <div class="modal-dialog"> \
      <div class="modal-content"> \
        <div class="modal-header"> \
          <h3 class="modal-title">Edit Model</h3> \
        </div> \
        <div class="modal-body"> \
          <form class="form-horizontal"> \
            <div class="form-group"> \
              <label for="slycat-model-name" class="col-sm-2 control-label">Name</label> \
              <div class="col-sm-10"> \
                <input id="slycat-model-name" class="form-control" type="text" placeholder="Name" data-bind="value:new_model_name"></input> \
              </div> \
            </div> \
            <div class="form-group"> \
              <label for="slycat-model-description" class="col-sm-2 control-label">Description</label> \
              <div class="col-sm-10"> \
                <textarea id="slycat-model-description" class="form-control" placeholder="Description" rows="5" data-bind="value:new_model_description"></textarea> \
              </div> \
            </div> \
            <div class="form-group"> \
              <label for="slycat-model-marking" class="col-sm-2 control-label">Marking</label> \
              <div class="col-sm-10"> \
                <select id="slycat-model-marking" class="form-control" data-bind="options:markings,optionsValue:\'type\',optionsText:\'label\',value:new_model_marking,valueAllowUnset:true"></select> \
              </div> \
            </div> \
          </form> \
        </div> \
        <div class="modal-footer"> \
          <button class="btn btn-danger pull-left" data-bind="click:delete_model">Delete Model</button> \
          <button class="btn btn-primary" data-bind="click:save_model" data-dismiss="modal">Save Changes</button> \
          <button class="btn btn-warning" data-dismiss="modal">Cancel</button> \
        </div> \
      </div> \
    </div> \
  </div> \
</div> \
'

  });

}());

