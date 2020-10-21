#!/bin/bash
set -e

cd "$(dirname "$0")"

echo '# cleanup data'
rm -f ../data/*.json.bz2
rm -f ../docs/data.js

echo '# update code'
git pull

echo '# download data'
node 1_fetch_data.js

echo '# prepare data'
node 2_prepare_data.js

echo '# build'
node 3_build.js

echo '# deploy'
sh 4_deploy.sh
