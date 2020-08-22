"use strict"

const fs = require('fs');
const helper = require('./lib/helper.js');
const {resolve} = require('path');

const dayMin = parseDate('2020-02-01');
let dayMax = 0;
const folder = resolve(__dirname, '../data/');

let file = fs.readdirSync(folder).filter(f => /^data_202.*\.json\.bz2$/.test(f)).sort().pop();
file = resolve(folder, file);

(async function () {
	let entries = new Map();

	let data = fs.readFileSync(file);
	data = await helper.bunzip2(data);
	data = JSON.parse(data);

	data.forEach(entry => {
		let day = parseDate(entry.MeldedatumISO);
		let i = day - dayMin;

		//addEntry('de');
		//addEntry('bl-'+entry.IdBundesland);
		addEntry('lk', entry.IdLandkreis);
		//addEntry('ag-'+entry.Altersgruppe);
		//addEntry('g-'+entry.Geschlecht);

		function addEntry(type, key) {
			let id = type+'_'+key;

			if (!entries.has(id)) entries.set(id, {type, key, fall:[]});
			let obj = entries.get(id);

			obj.fall[i] = (obj.fall[i] || 0) + entry.AnzahlFall;
			if (day > dayMax) dayMax = day;
		}
	})

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
	
	fs.writeFileSync('../docs/data/data.json', JSON.stringify(result), 'utf8');
})()

function parseDate(text) {
	return Math.round(Date.parse(text)/86400000);
}
