#!/bin/bash
set -e

cd "$(dirname "$0")"
cd "../publish"

echo "compress index.html"
zopfli index.html

echo "compress script.js"
zopfli script.js

echo "compress style.css"
zopfli style.css

gsutil -h 'Content-Type:image/png' -h 'Cache-Control:public, max-age=300' cp icon.png gs://2ndwave/icon.png
gsutil -h 'Content-Type:text/html' -h 'Content-Encoding:gzip' -h 'Cache-Control:public, max-age=300' cp index.html.gz gs://2ndwave/index.html
gsutil -h 'Content-Type:text/javascript' -h 'Content-Encoding:gzip' -h 'Cache-Control:public, max-age=300' cp script.js.gz gs://2ndwave/script.js
gsutil -h 'Content-Type:text/css' -h 'Content-Encoding:gzip' -h 'Cache-Control:public, max-age=300' cp style.css.gz gs://2ndwave/style.css
