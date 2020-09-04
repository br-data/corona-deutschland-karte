#!/bin/bash
set -e

echo '# cleanup data folder'
rm -f ../data/*.json.bz2

echo '# download data'
node 1_fetch_data.js

echo '# prepare data'
node 2_prepare_data.js

echo '# build'
node 3_build.js

echo '# deploy'
sh 4_deploy.sh
