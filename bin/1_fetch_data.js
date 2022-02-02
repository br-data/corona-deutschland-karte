#!/usr/bin/env node

"use strict"

const fs = require('fs');
const https = require('https');
const {resolve} = require('path');

const folder = 'https://storage.googleapis.com/brdata-public-data/rki-corona-archiv/2_parsed/';

start()

async function start() {
	console.log('download index');
	let list = await download(folder+'index.txt');
	list = list.toString().split('\n');
	list.sort();
	let file = list.pop();

	console.log('download data', file);
	let data = await download(folder+file);
	fs.writeFileSync(resolve(__dirname, '../data/', file), data);
}

function download(url) {
	return new Promise(resolve => {
		https.get(url, { headers: { 'User-Agent':'curl/7.64.1', 'Accept':'*/*' }}, response => {
			let data = [];
			response.on('data', chunk => data.push(chunk));
			response.on('end', () => resolve(Buffer.concat(data)));
			response.on('error', err => console.log('Error: ' + err.message));
		})
	})
}
