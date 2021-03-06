# Copyright 2013, Sandia Corporation. Under the terms of Contract
# DE-AC04-94AL85000 with Sandia Corporation, the U.S. Government retains certain
# rights in this software.

import cherrypy
import ConfigParser
import datetime
import grp
import json
import logging
import os
import pprint
import pwd
import re
import sys

import slycat.web.server.handlers
import slycat.web.server.plugin

class DropPrivilegesRotatingFileHandler(logging.handlers.RotatingFileHandler):
  """Custom logfile handler that ensures newly-created logfiles have a specific user and group."""
  def __init__(self, uid, gid, filename, mode='a', maxBytes=0, backupCount=0, encoding=None, delay=0):
    self.uid = uid
    self.gid = gid
    logging.handlers.RotatingFileHandler.__init__(self, filename, mode, maxBytes, backupCount, encoding, delay)

  def _open(self):
    file = logging.handlers.RotatingFileHandler._open(self)
    if self.uid is not None:
      os.fchown(file.fileno(), self.uid, -1)
    if self.gid is not None:
      os.fchown(file.fileno(), -1, self.gid)
    #print "log file:", file.name, self.uid, self.gid, os.fstat(file.fileno())
    return file

class SessionIdFilter(logging.Filter):
  """Python log filter to keep session ids out of logfiles."""
  def __init__(self):
    self._remote_pattern = re.compile("/remotes/[^/]+/")

  def filter(self, record):
    record.msg = self._remote_pattern.sub("/remotes/----/", record.msg)
    return True

def start(root_path, config_file):

  def abspath(path):
    if os.path.isabs(path):
      return path
    return os.path.join(root_path, path)

  # Load the configuration file.
  configuration = {}
  config_file = abspath(config_file)
  if not os.path.exists(config_file):
    raise Exception("Configuration file %s does not exist." % config_file)

  cherrypy.engine.autoreload.files.add(config_file)
  parser = ConfigParser.SafeConfigParser()
  parser.read(config_file)
  configuration = {section : {key : eval(value) for key, value in parser.items(section)} for section in parser.sections()}
  configuration["slycat-web-server"]["root-path"] = root_path

  # Allow both numeric and named uid and gid
  uid = configuration["slycat-web-server"]["uid"]
  if isinstance(uid, basestring):
    uid = pwd.getpwnam(uid).pw_uid

  gid = configuration["slycat-web-server"]["gid"]
  if isinstance(gid, basestring):
    gid = grp.getgrnam(gid).gr_gid

  # Configure loggers.
  if configuration["slycat-web-server"]["access-log"] != "-":
    cherrypy.log.access_log.handlers = []
    if configuration["slycat-web-server"]["access-log"] is not None:
      cherrypy.log.access_log.addHandler(DropPrivilegesRotatingFileHandler(uid, gid, configuration["slycat-web-server"]["access-log"], "a", configuration["slycat-web-server"]["access-log-size"], configuration["slycat-web-server"]["access-log-count"]))
  if configuration["slycat-web-server"]["error-log"] != "-":
    cherrypy.log.error_log.handlers = []
    if configuration["slycat-web-server"]["error-log"] is not None:
      cherrypy.log.error_log.addHandler(DropPrivilegesRotatingFileHandler(uid, gid, configuration["slycat-web-server"]["error-log"], "a", configuration["slycat-web-server"]["error-log-size"], configuration["slycat-web-server"]["error-log-count"]))

  cherrypy.log.access_log.handlers[-1].addFilter(SessionIdFilter())

  cherrypy.log("Server root path: %s" % root_path)

  if os.path.exists(config_file):
    cherrypy.log("Loaded configuration from %s" % config_file)

  for path in sys.path:
    cherrypy.log.error("PYTHONPATH: %s" % path)

  # Optionally generate a pidfile for startup scripts
  if configuration["slycat-web-server"]["pidfile"] is not None:
    cherrypy.process.plugins.PIDFile(cherrypy.engine, configuration["slycat-web-server"]["pidfile"]).subscribe()

  # Optionally drop privileges so we can safely bind to low port numbers ...
  if uid is not None and gid is not None and configuration["slycat-web-server"]["umask"] is not None:
    cherrypy.process.plugins.DropPrivileges(cherrypy.engine, uid=uid, gid=gid, umask=configuration["slycat-web-server"]["umask"]).subscribe()

  # Optionally daemonize our process ...
  if configuration["slycat-web-server"]["daemon"] == True:
    cherrypy.process.plugins.Daemonizer(cherrypy.engine, stdout=configuration["slycat-web-server"]["stdout-log"], stderr=configuration["slycat-web-server"]["stderr-log"]).subscribe()

  dispatcher = cherrypy.dispatch.RoutesDispatcher()

  dispatcher.connect("delete-model", "/models/:mid", slycat.web.server.handlers.delete_model, conditions={"method" : ["DELETE"]})
  dispatcher.connect("delete-project", "/projects/:pid", slycat.web.server.handlers.delete_project, conditions={"method" : ["DELETE"]})
  dispatcher.connect("delete-project-cache-object", "/projects/:pid/cache/:key", slycat.web.server.handlers.delete_project_cache_object, conditions={"method" : ["DELETE"]})
  dispatcher.connect("delete-reference", "/references/:rid", slycat.web.server.handlers.delete_reference, conditions={"method" : ["DELETE"]})
  dispatcher.connect("delete-remote", "/remotes/:sid", slycat.web.server.handlers.delete_remote, conditions={"method" : ["DELETE"]})
  dispatcher.connect("get-bookmark", "/bookmarks/:bid", slycat.web.server.handlers.get_bookmark, conditions={"method" : ["GET"]})
  dispatcher.connect("get-configuration-markings", "/configuration/markings", slycat.web.server.handlers.get_configuration_markings, conditions={"method" : ["GET"]})
  dispatcher.connect("get-configuration-wizards", "/configuration/wizards", slycat.web.server.handlers.get_configuration_wizards, conditions={"method" : ["GET"]})
  dispatcher.connect("get-configuration-remote-hosts", "/configuration/remote-hosts", slycat.web.server.handlers.get_configuration_remote_hosts, conditions={"method" : ["GET"]})
  dispatcher.connect("get-configuration-support-email", "/configuration/support-email", slycat.web.server.handlers.get_configuration_support_email, conditions={"method" : ["GET"]})
  dispatcher.connect("get-configuration-version", "/configuration/version", slycat.web.server.handlers.get_configuration_version, conditions={"method" : ["GET"]})
  dispatcher.connect("get-global-resource", "/resources/global/{resource:.*}", slycat.web.server.handlers.get_global_resource, conditions={"method" : ["GET"]})
  dispatcher.connect("get-home", "/", slycat.web.server.handlers.get_home, conditions={"method" : ["GET"]})
  dispatcher.connect("get-model-array-attribute-chunk", "/models/:mid/arraysets/:aid/arrays/:array/attributes/:attribute/chunk", slycat.web.server.handlers.get_model_array_attribute_chunk, conditions={"method" : ["GET"]})
  dispatcher.connect("get-model-arrayset-data", "/models/:mid/arraysets/:aid/data", slycat.web.server.handlers.get_model_arrayset_data, conditions={"method" : ["GET"]})
  dispatcher.connect("get-model-arrayset-metadata", "/models/:mid/arraysets/:name/metadata", slycat.web.server.handlers.get_model_arrayset_metadata, conditions={"method" : ["GET"]})
  dispatcher.connect("get-model-command", "/models/:mid/commands/:command", slycat.web.server.handlers.get_model_command, conditions={"method" : ["GET"]})
  dispatcher.connect("get-model-file", "/models/:mid/files/:aid", slycat.web.server.handlers.get_model_file, conditions={"method" : ["GET"]})
  dispatcher.connect("get-model", "/models/:mid", slycat.web.server.handlers.get_model, conditions={"method" : ["GET"]})
  dispatcher.connect("get-model-parameter", "/models/:mid/parameters/:name", slycat.web.server.handlers.get_model_parameter, conditions={"method" : ["GET"]})
  dispatcher.connect("get-model-resource", "/resources/models/:mtype/{resource:.*}", slycat.web.server.handlers.get_model_resource, conditions={"method" : ["GET"]})
  dispatcher.connect("get-tests-remote", "/tests/remote", slycat.web.server.handlers.get_tests_remote, conditions={"method" : ["GET"]})
  dispatcher.connect("tests-request", "/tests/request", slycat.web.server.handlers.tests_request, conditions={"method" : ["GET", "PUT", "POST", "DELETE"]})
  dispatcher.connect("get-wizard-resource", "/resources/wizards/:wtype/{resource:.*}", slycat.web.server.handlers.get_wizard_resource, conditions={"method" : ["GET"]})
  dispatcher.connect("get-model-table-chunk", "/models/:mid/tables/:aid/arrays/:array/chunk", slycat.web.server.handlers.get_model_table_chunk, conditions={"method" : ["GET"]})
  dispatcher.connect("get-model-table-metadata", "/models/:mid/tables/:aid/arrays/:array/metadata", slycat.web.server.handlers.get_model_table_metadata, conditions={"method" : ["GET"]})
  dispatcher.connect("get-model-table-sorted-indices", "/models/:mid/tables/:aid/arrays/:array/sorted-indices", slycat.web.server.handlers.get_model_table_sorted_indices, conditions={"method" : ["GET"]})
  dispatcher.connect("get-model-table-unsorted-indices", "/models/:mid/tables/:aid/arrays/:array/unsorted-indices", slycat.web.server.handlers.get_model_table_unsorted_indices, conditions={"method" : ["GET"]})
  dispatcher.connect("get-project-models", "/projects/:pid/models", slycat.web.server.handlers.get_project_models, conditions={"method" : ["GET"]})
  dispatcher.connect("get-project-references", "/projects/:pid/references", slycat.web.server.handlers.get_project_references, conditions={"method" : ["GET"]})
  dispatcher.connect("get-project", "/projects/:pid", slycat.web.server.handlers.get_project, conditions={"method" : ["GET"]})
  dispatcher.connect("get-project-cache-object", "/projects/:pid/cache/:key", slycat.web.server.handlers.get_project_cache_object, conditions={"method" : ["GET"]})
  dispatcher.connect("get-projects", "/projects", slycat.web.server.handlers.get_projects, conditions={"method" : ["GET"]})
  dispatcher.connect("get-remote-file", "/remotes/:sid/file{path:.*}", slycat.web.server.handlers.get_remote_file, conditions={"method" : ["GET"]})
  dispatcher.connect("get-remote-image", "/remotes/:sid/image{path:.*}", slycat.web.server.handlers.get_remote_image, conditions={"method" : ["GET"]})
  dispatcher.connect("get-remote-video", "/remotes/:sid/videos/:vsid", slycat.web.server.handlers.get_remote_video, conditions={"method" : ["GET"]})
  dispatcher.connect("get-remote-video-status", "/remotes/:sid/videos/:vsid/status", slycat.web.server.handlers.get_remote_video_status, conditions={"method" : ["GET"]})
  dispatcher.connect("get-user", "/users/:uid", slycat.web.server.handlers.get_user, conditions={"method" : ["GET"]})
  dispatcher.connect("post-events", "/events/{event:.*}", slycat.web.server.handlers.post_events, conditions={"method" : ["POST"]})
  dispatcher.connect("post-model-finish", "/models/:mid/finish", slycat.web.server.handlers.post_model_finish, conditions={"method" : ["POST"]})
  dispatcher.connect("post-project-bookmarks", "/projects/:pid/bookmarks", slycat.web.server.handlers.post_project_bookmarks, conditions={"method" : ["POST"]})
  dispatcher.connect("post-project-references", "/projects/:pid/references", slycat.web.server.handlers.post_project_references, conditions={"method" : ["POST"]})
  dispatcher.connect("post-project-models", "/projects/:pid/models", slycat.web.server.handlers.post_project_models, conditions={"method" : ["POST"]})
  dispatcher.connect("post-projects", "/projects", slycat.web.server.handlers.post_projects, conditions={"method" : ["POST"]})
  dispatcher.connect("post-remote-browse", "/remotes/:sid/browse{path:.*}", slycat.web.server.handlers.post_remote_browse, conditions={"method" : ["POST"]})
  dispatcher.connect("post-remotes", "/remotes", slycat.web.server.handlers.post_remotes, conditions={"method" : ["POST"]})
  dispatcher.connect("post-remote-videos", "/remotes/:sid/videos", slycat.web.server.handlers.post_remote_videos, conditions={"method" : ["POST"]})
  dispatcher.connect("post-remotes", "/remotes", slycat.web.server.handlers.post_remotes, conditions={"method" : ["POST"]})
  dispatcher.connect("put-model-arrayset-array", "/models/:mid/arraysets/:name/arrays/:array", slycat.web.server.handlers.put_model_arrayset_array, conditions={"method" : ["PUT"]})
  dispatcher.connect("put-model-arrayset-data", "/models/:mid/arraysets/:name/data", slycat.web.server.handlers.put_model_arrayset_data, conditions={"method" : ["PUT"]})
  dispatcher.connect("put-model-arrayset", "/models/:mid/arraysets/:name", slycat.web.server.handlers.put_model_arrayset, conditions={"method" : ["PUT"]})
  dispatcher.connect("put-model-file", "/models/:mid/files/:name", slycat.web.server.handlers.put_model_file, conditions={"method" : ["PUT"]})
  dispatcher.connect("put-model-inputs", "/models/:mid/inputs", slycat.web.server.handlers.put_model_inputs, conditions={"method" : ["PUT"]})
  dispatcher.connect("put-model", "/models/:mid", slycat.web.server.handlers.put_model, conditions={"method" : ["PUT"]})
  dispatcher.connect("put-model-parameter", "/models/:mid/parameters/:name", slycat.web.server.handlers.put_model_parameter, conditions={"method" : ["PUT"]})
  dispatcher.connect("put-model-table", "/models/:mid/tables/:name", slycat.web.server.handlers.put_model_table, conditions={"method" : ["PUT"]})
  dispatcher.connect("put-project", "/projects/:pid", slycat.web.server.handlers.put_project, conditions={"method" : ["PUT"]})

  def log_configuration(tree, indent=""):
    for key, value in sorted(tree.items()):
      if isinstance(value, dict):
        cherrypy.log.error("%s%s:" % (indent, key))
        log_configuration(value, indent + "  ")
      else:
        cherrypy.log.error("%s%s: %s" % (indent, key, value))
  log_configuration(configuration)

  # Setup global server parameters.
  configuration["global"] = {
    "engine.autoreload.on": configuration["slycat-web-server"]["autoreload"],
    "request.show_tracebacks": configuration["slycat-web-server"]["show-tracebacks"],
    "server.socket_host": configuration["slycat-web-server"]["socket-host"],
    "server.socket_port": configuration["slycat-web-server"]["socket-port"],
    "server.thread_pool": configuration["slycat-web-server"]["thread-pool"],
    }

  # Setup root server parameters.
  configuration["/"] = {}
  configuration["/"]["request.dispatch"] = dispatcher

  authentication = configuration["slycat-web-server"]["authentication"]["plugin"]
  configuration["/"]["tools.%s.on" % authentication] = True
  for key, value in configuration["slycat-web-server"]["authentication"]["kwargs"].items():
    configuration["/"]["tools.%s.%s" % (authentication, key)] = value

  # Setup our static content directories.
  configuration["/css"] = {
    "tools.expires.force": True,
    "tools.expires.on": True,
    "tools.expires.secs": 3600,
    "tools.staticdir.dir": abspath("css"),
    "tools.staticdir.on": True,
    }

  configuration["/js"] = {
    "tools.expires.force": True,
    "tools.expires.on": True,
    "tools.expires.secs": 3600,
    "tools.staticdir.dir": abspath("js"),
    "tools.staticdir.on": True,
    }

  configuration["/fonts"] = {
    "tools.expires.force": True,
    "tools.expires.on": True,
    "tools.expires.secs": 3600,
    "tools.staticdir.dir": abspath("fonts"),
    "tools.staticdir.on": True,
    }

  configuration["/resources"] = {
    "tools.expires.force": True,
    "tools.expires.on": True,
    "tools.expires.secs": 3600,
    }

  configuration["/templates"] = {
    "tools.expires.force": True,
    "tools.expires.on": True,
    "tools.expires.secs": 3600,
    "tools.staticdir.dir": abspath("templates"),
    "tools.staticdir.on": True,
    }

  # Load plugin modules.
  manager = slycat.web.server.plugin.manager
  for item in configuration["slycat-web-server"]["plugins"]:
    manager.load(abspath(item))
  manager.register_plugins()

  # Sanity-check to ensure that we have a marking plugin for every allowed marking type.
  for allowed_marking in configuration["slycat-web-server"]["allowed-markings"]:
    if allowed_marking not in manager.markings.keys():
      raise Exception("No marking plugin for type: %s" % allowed_marking)

  # Setup the requested directory plugin.
  directory_type = configuration["slycat-web-server"]["directory"]["plugin"]
  if directory_type not in manager.directories.keys():
    raise Exception("No directory plugin for type: %s" % directory_type)
  directory_args = configuration["slycat-web-server"]["directory"].get("args", [])
  directory_kwargs = configuration["slycat-web-server"]["directory"].get("kwargs", {})
  manager.directories[directory_type]["init"](*directory_args, **directory_kwargs)
  configuration["slycat-web-server"]["directory"] = manager.directories[directory_type]["user"]

  # Expand remote host aliases.
  configuration["slycat-web-server"]["remote-hosts"] = {hostname: remote for remote in configuration["slycat-web-server"]["remote-hosts"] for hostname in remote.get("hostnames", [])}

  # Wait for requests to cleanup deleted arrays.
  cherrypy.engine.subscribe("start", slycat.web.server.handlers.start_array_cleanup_worker, priority=80)

  # Cleanup expired sessions.
  cherrypy.engine.subscribe("start", slycat.web.server.handlers.start_session_cleanup_worker, priority=80)

  # Start the web server.
  cherrypy.quickstart(None, "/", configuration)

