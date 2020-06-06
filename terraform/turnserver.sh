#!/bin/bash

# Install coturn
sudo apt-get -y update
sudo apt-get -y install coturn

# Save original conf file
sudo mv /etc/turnserver.conf /etc/turnserver.conf.orig

# Make our own config file
internalIp="$(ip a | grep -Eo 'inet (addr:)?([0-9]*\.){3}[0-9]*' | grep -Eo '([0-9]*\.){3}[0-9]*' | grep -v '127.0.0.1')"
externalIp="$(dig +short myip.opendns.com @resolver1.opendns.com)"
name="kanto"

sudo echo "listening-port=3478
tls-listening-port=5349
listening-ip="$internalIp"
relay-ip="$internalIp"
external-ip="$externalIp"
realm=$name
server-name=$name
lt-cred-mech
user=$1:$2
# use real-valid certificate/privatekey files
cert=/etc/ssl/turn_server_cert.pem
pkey=/etc/ssl/turn_server_pkey.pem
no-stdout-log" > /etc/turnserver.conf

# Set it up to auto-run
sudo echo "TURNSERVER_ENABLED=1" > /etc/default/coturn

sudo service coturn restart
