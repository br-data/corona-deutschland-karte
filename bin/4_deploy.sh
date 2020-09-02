#!/bin/bash
set -e

cd "$(dirname "$0")"
cd "../data/"

zopfli data.js

gsutil -h 'Content-Type:text/javascript' -h 'Content-Encoding:gzip' -h 'Cache-Control:public, max-age=3600' cp data.js.gz gs://2ndwave/data.js
