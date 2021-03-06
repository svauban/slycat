FROM sandialabs/slycat-demo
MAINTAINER Timothy M. Shead <tshead@sandia.gov>

# Install yum packages for development.
RUN yum install -y htop make python-coverage python-nose python-sphinx python-sphinx_rtd_theme vim wget

# Install Python modules for development.
RUN pip install behave sphinxcontrib-httpdomain sphinxcontrib-napoleon

# Set reasonable ssh timeouts for development.
RUN sed -e 's/^#ClientAliveInterval .*$/ClientAliveInterval 60/' -i /etc/ssh/sshd_config
RUN sed -e 's/^#ClientAliveCountMax .*$/ClientAliveInterval 10080/' -i /etc/ssh/sshd_config

# Make the slycat user a sudoer.
RUN /usr/sbin/usermod -a -G wheel slycat

# We want CouchDB to listen on all network interfaces, so developers can use its web UI.
RUN sed -e 's/^bind_address = .*$/bind_address = 0.0.0.0/' -i /etc/couchdb/default.ini
# CouchDB will be listening on port 5984.
EXPOSE 5984

# Create mount points for persistent data.
VOLUME /home/slycat
VOLUME /var/lib/couchdb
VOLUME /var/lib/slycat
VOLUME /var/log/couchdb
VOLUME /var/log/slycat

# The following commands are run as user "slycat".
USER slycat
# Configure vim and setup useful aliases.
RUN echo "alias vi=vim" >> /home/slycat/.bash_profile
ADD .vimrc /home/slycat/.vimrc
# Setup useful git defaults.
RUN touch /home/slycat/.gitconfig
RUN HOME=/home/slycat git config --global push.default simple
RUN HOME=/home/slycat git config --global color.ui true

# The following commands are run as root.
USER root

# We don't specify a startup command, since the base image already starts
# supervisord for us.
