.. _Create a CCA Model:

Create a CCA Model
==================

In Slycat, we perform an analysis by ingesting data and creating a
*model*. One type of Slycat model is *Canonical Correlation Analysis
(CCA)*, used to model relationships between a set of input and output
metrics. Before creating a CCA model however, we must create a
*project*, which is used to organize and control access to models.

Create a Project
----------------

* With your web browser still pointed to the Slycat Projects page from the
  previous section, click *Add New Project*, enter "MyProject" as the project name, and
  click *Create Project*.
* The browser switches to a separate page for the new project.

Generate a CCA Model
--------------------

* In the project page, click the *Remote CCA* button. Remote CCA is an
  analysis performed on a file retrieved from a host other than (remote to)
  the Slycat web server.
* In the *Remote File CCA Model* wizard, enter "MyCCA" as the model name
  and click *Next*.
* We are going to load a file that happens to be located on the same host
  as the Slycat server ("localhost"), but could be located on any host that's
  reachable from the Slycat server over ssh.  In the next page of the wizard,
  choose *localhost* in the hostname dropdown and enter username *slycat* and
  password *slycat*.
* The remote file browser appears, showing the Slycat server's filesystem.
  Highlight the */home/slycat/src/slycat/data/cars.csv* file, then scroll to
  the bottom of the wizard and click the *Next* button. This file contains data
  describing 406 different types of automobile in CSV format.
* A list of the variables (columns) from the uploaded file appears,
  along with two columns of checkboxes, allowing you to designate each
  variable as in input, an output, or neither. Use the checkboxes to
  select "Cylinders", "Displacement", "Weight", and "Year" as inputs,
  and "MPG", "Horsepower", and "Acceleration" as outputs. Uncheck
  "Origin".
* Leave the "Scale inputs to unit variance." checkbox checked, and
  click *Run*.

Wait for Model Completion
-------------------------

The time to compute models can vary from seconds to hours, depending
on the complexity of the model and the data. For this reason, Slycat
computes models in the background, allowing you to:

  *  Continue interacting with existing projects and models.
  *  Create more than one model at a time.

This example is very small, so it should complete in a few seconds,
and the browser will switch to a separate page containing the new model.

View a CCA Model
----------------

* The bottom half of the model page features a table containing the raw
  data used to compute the model. Input variables are color-coded
  green, output variables are color-coded purple, and unused variables
  are color-coded white.
* The upper-left corner of the page contains the CCA table, a
  high-level overview of the CCA results including statistical
  significance measures and bar-plots for each input and output
  variable over three CCA components.
* The upper-right corner of the page contains a scatterplot detailing
  how well each individual observation in the raw data fits the
  currently selected CCA component.

Interact with a CCA Model
-------------------------

* Click a component name ("CCA1", "CCA2", or "CCA3") in the CCA table
  to select that component, displaying its bar plot and updating the
  scatterplot.
* Click variable names in the CCA table or the raw data table to color
  code observations with that variable.
* Hover over columns in the CCA table and the raw data table to reveal
  sorting widgets.
* Click observations in the scatterplot to highlight the corresponding
  entry in the raw data table.
* Click and drag in the scatterplot to rubber-band-select multiple
  observations.
* Click rows or shift-click ranges of rows in the raw data table to
  highlight corresponding observations in the scatterplot.

Next Steps
----------

Now that you've created your first CCA model it's time to :ref:`Create a Timeseries Model`.
