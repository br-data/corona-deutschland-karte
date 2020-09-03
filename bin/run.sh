#!/bin/bash
set -e

echo '# prepare data'
node 2_prepare_data.js

echo '# build'
node 3_build.js

echo '# deploy'
sh 4_deploy.sh
