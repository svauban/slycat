# Copyright 2013, Sandia Corporation. Under the terms of Contract
# DE-AC04-94AL85000 with Sandia Corporation, the U.S. Government retains certain
# rights in this software.

"""Demonstrates uploading data to Slycat Web Server to compute a CCA model.

This script computes a Slycat cca model using a set of semi-random observations.  Use
this script as a starting-point for uploading your own data to a CCA model.

A Slycat CCA model requires the following data, which you will have to provide
in your own scripts:

    data-table        A single 1D array containing M input observations with N features (array attributes).
"""

import numpy
import slycat.web.client

parser = slycat.web.client.option_parser()
parser.add_argument("--column-prefix", default="a", help="Column prefix.  Default: %(default)s")
parser.add_argument("--duplicate-input-count", type=int, default=0, help="Number of input columns to duplicate.  Default: %(default)s")
parser.add_argument("--duplicate-output-count", type=int, default=0, help="Number of output columns to duplicate.  Default: %(default)s")
parser.add_argument("--input-count", type=int, default=3, help="Input column count.  Default: %(default)s")
parser.add_argument("--marking", default="", help="Marking type.  Default: %(default)s")
parser.add_argument("--model-name", default="Demo CCA Model", help="New model name.  Default: %(default)s")
parser.add_argument("--output-count", type=int, default=3, help="Output column count.  Default: %(default)s")
parser.add_argument("--project-name", default="Demo CCA Project", help="New project name.  Default: %(default)s")
parser.add_argument("--row-count", type=int, default=100, help="Row count.  Default: %(default)s")
parser.add_argument("--seed", type=int, default=12345, help="Random seed.  Default: %(default)s")
parser.add_argument("--unused-count", type=int, default=3, help="Unused column count.  Default: %(default)s")
arguments = parser.parse_args()

if arguments.input_count < 1:
  raise Exception("Input count must be greater-than zero.")
if arguments.output_count < 1:
  raise Exception("Output count must be greater-than zero.")
if arguments.duplicate_input_count >= arguments.input_count:
  raise Exception("Duplicate input count must be less than input count.")
if arguments.duplicate_output_count >= arguments.output_count:
  raise Exception("Duplicate output count must be less than output count.")

total_columns = arguments.input_count + arguments.output_count + arguments.unused_count

# Create some random data using a gaussian distribution ...
numpy.random.seed(arguments.seed)
data = numpy.random.normal(size=(arguments.row_count, total_columns))

# Force a somewhat-linear relationship between the inputs and outputs ...
for i in range(arguments.input_count, arguments.input_count + min(arguments.input_count, arguments.output_count)):
  data[:, i] = data[:, 0] ** i

# Optionally duplicate some columns to create rank-deficient data ...
for i in range(1, 1 + arguments.duplicate_input_count):
  data[:,i] = data[:,0]
for i in range(1 + arguments.input_count, 1 + arguments.input_count + arguments.duplicate_output_count):
  data[:,i] = data[:, arguments.input_count]

# Setup a connection to the Slycat Web Server.
connection = slycat.web.client.connect(arguments)

# Create a new project to contain our model.
pid = connection.find_or_create_project(arguments.project_name)

# Create the new, empty model.
mid = connection.post_project_models(pid, "cca", arguments.model_name, arguments.marking)

# Upload our observations as "data-table".
connection.put_model_arrayset(mid, "data-table")

# Start our single "data-table" array.
dimensions = [dict(name="row", end=arguments.row_count)]
attributes = [dict(name="%s%s" % (arguments.column_prefix, column), type="float64") for column in range(total_columns)]
connection.put_model_arrayset_array(mid, "data-table", 0, dimensions, attributes)

# Upload data into the array.
for i in range(total_columns):
  connection.put_model_arrayset_data(mid, "data-table", (0, i, numpy.index_exp[...], data.T[i]))

# Store the remaining parameters.
connection.put_model_parameter(mid, "input-columns", range(0, arguments.input_count))
connection.put_model_parameter(mid, "output-columns", range(arguments.input_count, arguments.input_count + arguments.output_count))
connection.put_model_parameter(mid, "scale-inputs", False)

# Signal that we're done uploading data to the model.  This lets Slycat Web
# Server know that it can start computation.
connection.post_model_finish(mid)
# Wait until the model is ready.
connection.join_model(mid)

# Supply the user with a direct link to the new model.
slycat.web.client.log.info("Your new model is located at %s/models/%s" % (arguments.host, mid))
