#!/bin/bash
set -e

cd "$(dirname "$0")"
cd "../publish"

zopfli index.html
zopfli script.js
zopfli style.css

gsutil -h 'Content-Type:text/html' -h 'Content-Encoding:gzip' -h 'Cache-Control:public, max-age=300' cp index.html.gz gs://2ndwave/index.html
gsutil -h 'Content-Type:text/javascript' -h 'Content-Encoding:gzip' -h 'Cache-Control:public, max-age=300' cp script.js.gz gs://2ndwave/script.js
gsutil -h 'Content-Type:text/css' -h 'Content-Encoding:gzip' -h 'Cache-Control:public, max-age=300' cp style.css.gz gs://2ndwave/style.css
