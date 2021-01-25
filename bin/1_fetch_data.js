#!/usr/bin/env node

"use strict"

const fs = require('fs');
const https = require('https');
const {resolve} = require('path');

download('https://api.github.com/repos/ard-data/2020-rki-archive/contents/data/2_parsed', list => {
	list = JSON.parse(list);
	list = list.filter(e => /^data_202.*\.ndjson\.xz$/.test(e.name));
	list.sort((a,b) => a.name < b.name ? -1 : 1);
	let file = list.pop();

	download(file.download_url, data => {
		fs.writeFileSync(resolve(__dirname, '../data/', file.name), data);
	})
});

function download(url, cb) {
	https.get(url, { headers: { 'User-Agent':'curl/7.64.1', 'Accept':'*/*' }}, res => {
		let data = [];
		res.on('data', chunk => data.push(chunk));
		res.on('end', () => cb(Buffer.concat(data)));
		res.on('error', err => console.log('Error: ' + err.message));
	})
}