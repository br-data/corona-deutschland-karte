#!/bin/bash
# set -e

cd "$(dirname "$0")"
cd "../web/data/"

zopfli entries.json
