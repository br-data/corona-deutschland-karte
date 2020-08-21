"use strict"

const fs = require('fs');
const helper = require('./lib/helper.js');
const {resolve} = require('path');

const dayMin = parseDate('2020-02-01');
const dayMax = parseDate('2020-08-19');
const folder = resolve(__dirname, '../data/');

let file = fs.readdirSync(folder).filter(f => /^data_202.*\.json\.bz2$/.test(f)).sort().pop();
file = resolve(folder, file);

let zeros = new Array();
for (let i = 0; i <= dayMax-dayMin; i++) zeros[i] = 0;

(async function () {
	let entries = new Map();

	let data = fs.readFileSync(file);
	data = await helper.bunzip2(data);
	data = JSON.parse(data);

	data.forEach(entry => {
		let day = Math.round(parseDate(entry.MeldedatumISO) - dayMin);

		//addEntry('de');
		//addEntry('bl-'+entry.IdBundesland);
		addEntry('lk', entry.IdLandkreis);
		//addEntry('ag-'+entry.Altersgruppe);
		//addEntry('g-'+entry.Geschlecht);

		function addEntry(type, key) {
			let id = type+'_'+key;

			if (!entries.has(id)) entries.set(id, {type, key, fall:zeros.slice()});
			let obj = entries.get(id);

			if (obj.fall[day] === undefined) throw Error(day+' - '+entry.MeldedatumISO);
			obj.fall[day] += entry.AnzahlFall;
		}
	})

	entries = Array.from(entries.values());

	let result = {
		dayMin,
		dayMax,
		entries
	}
	
	fs.writeFileSync('../web/data/data.json', JSON.stringify(result), 'utf8');
})()

function parseDate(text) {
	return Math.round(Date.parse(text)/86400000);
}
