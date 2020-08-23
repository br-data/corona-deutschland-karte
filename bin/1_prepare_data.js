"use strict"

const fs = require('fs');
const helper = require('./lib/helper.js');
const {resolve} = require('path');

const dayMin = parseDate('2020-02-01');
let dayMax = 0;
const folder = resolve(__dirname, '../data/');

console.log('start');

let file = fs.readdirSync(folder).filter(f => /^data_202.*\.json\.bz2$/.test(f)).sort().pop();
file = resolve(folder, file);

(async function () {
	let entries = new Map();

	console.log('load');
	let data = fs.readFileSync(file);

	console.log('decompress');
	data = await helper.bunzip2(data);

	console.log('unpack');
	data = JSON.parse(data);

	console.log('scan');
	data.forEach(entry => {
		let dayMelde = parseDate(entry.MeldedatumISO);

		let id = entry.IdLandkreis;
		if (!entries.has(id)) entries.set(id, { id, fall:[] });
		let obj = entries.get(id);

		let i = dayMelde - dayMin;
		obj.fall[i] = (obj.fall[i] || 0) + entry.AnzahlFall;
		if (dayMelde > dayMax) dayMax = dayMelde;
	})

	console.log('finalize');

	entries = Array.from(entries.values());

	entries.forEach(e => {
		for (let i = 0; i <= dayMax-dayMin; i++) {
			if (!e.fall[i]) e.fall[i] = 0;
		}
	})

	let result = {
		dayMin,
		dayMax,
		entries
	}
	
	console.log('save');
	fs.writeFileSync('../docs/data/data.json', JSON.stringify(result), 'utf8');
})()

function parseDate(text) {
	return Math.round(Date.parse(text)/86400000);
}
