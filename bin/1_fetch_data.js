#!/usr/bin/env node

"use strict"

const fs = require('fs');
const https = require('https');
const {resolve} = require('path');

const folder = 'https://storage.googleapis.com/brdata-public-data/rki-corona-archiv/2_parsed/';

download(folder+'index.txt', list => {
	list = list.toString().split('\n');
	list.sort();
	let file = list.pop();

	download(folder+file, data => {
		fs.writeFileSync(resolve(__dirname, '../data/', file), data);
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