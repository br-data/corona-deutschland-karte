#!/bin/bash
set -e

node 2_prepare_data.js
node 3_build.js
sh 4_deploy.sh
