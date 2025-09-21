#!/bin/bash

# Substitute environment variables in the configuration file
envsubst < /flamenco/flamenco-manager.yaml.template > /flamenco/flamenco-manager.yaml

# Start the flamenco manager
exec /flamenco/flamenco-manager "$@"