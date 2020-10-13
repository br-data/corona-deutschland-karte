#!/usr/bin/env node

"use strict"

const fs = require('fs');
const helper = require('./lib/helper.js');
const {resolve} = require('path');
const distance = require('@turf/distance').default;
const topojson = require('topojson');

const dayMin = parseDate('2020-02-10');
const blurWindow = 7;
const folder = resolve(__dirname, '../data/');

let dayMax = 0;





const centerX = 10.45;
const centerY = 51.10;
const scaleY = 2/6;
const scaleX = scaleY*Math.cos(centerY*Math.PI/180);



console.log('start with bundeslaender');

let bundeslaender = JSON.parse(fs.readFileSync(resolve(folder, 'bundeslaender.geo.json')));
bundeslaender = topojson.topology({bundeslaender}, 1e6);
//console.log(bundeslaender);
var ps = topojson.presimplify(bundeslaender);
bundeslaender = topojson.simplify(ps, 1e-3);
//console.log(bundeslaender);
bundeslaender = topojson.mesh(bundeslaender, bundeslaender.objects.bundeslaender);
bundeslaender = bundeslaender.coordinates.map(poly => poly.map(p => ([
	Math.round( (p[0]-centerX)*scaleX*10000)/10000,
	Math.round(-(p[1]-centerY)*scaleY*10000)/10000,
])));
console.log('   size: '+JSON.stringify(bundeslaender).length);




console.log('start with landkreise');
// parse geojson

let landkreise = JSON.parse(fs.readFileSync(resolve(folder, 'landkreise.geo.json')));
landkreise = landkreise.features.map(f => {
	let sx = 0, sy = 0, s = 0;
	scan(f.geometry.coordinates, (f.geometry.type === 'Polygon') ? 2 : 3);
	function scan(list, n) {
		if (n > 1) return list.forEach(s => scan(s, n-1));
		list.forEach(p => {sx += p[0]; sy += p[1]; s++});
	}

	return {
		x:  (sx/s-centerX)*scaleX,
		y: -(sy/s-centerY)*scaleY,
		id:  f.properties.RS, 
		ew: f.properties.EWZ, 
		type: f.properties.BEZ, 
		title: f.properties.GEN,
	}
})



// merge data for Berlin :(
if (true) {
	let berlin = {x:0,y:0,s:0,ids:[],ew:0,type:'Kreisfreie Stadt',title:'Berlin'};
	landkreise = landkreise.filter(f => {
		if (f.id.startsWith('11')) {
			berlin.x += f.x;
			berlin.y += f.y;
			berlin.s++;
			berlin.ids.push(f.id);
			berlin.ew += f.ew;
			// Berlin
			return false;
		} else {
			// not Berlin
			f.ids = [f.id];
			return true;
		}
	})
	berlin.x /= berlin.s;
	berlin.y /= berlin.s;
	delete berlin.s;
	landkreise.push(berlin);
} else {
	landkreise.forEach(f => f.ids = [f.id]);
}



// prepare merging

landkreise.forEach(f => {
	let n = 10000;
	f.x = Math.round(f.x*n)/n;
	f.y = Math.round(f.y*n)/n;
})

let lookup = new Map();
landkreise.sort((a,b) => a.id < b.id ? -1 : 1);
landkreise.forEach((l,i) => {
	l.index = i;
	l.ids.forEach(id => lookup.set(id,l));
	delete l.id;
	delete l.ids;
});
console.log('   size: '+JSON.stringify(landkreise).length);



console.log('start with deutschland');

let deutschland = JSON.parse(fs.readFileSync(resolve(folder, 'deutschland.geo.json')));
deutschland = deutschland.features[0].geometry.coordinates;
deutschland = deutschland.map(p => p[0]);

deutschland = deutschland.map(poly => poly.map(p => ([
	Math.round( (p[0]-centerX)*scaleX*10000)/10000,
	Math.round(-(p[1]-centerY)*scaleY*10000)/10000,
])));
console.log('   size: '+JSON.stringify(deutschland).length);



console.log('start with data');

let file = fs.readdirSync(folder).filter(f => /^data_202.*\.json\.bz2$/.test(f)).sort().pop();
file = resolve(folder, file);

(async function () {
	let days = [];

	console.log('   load');
	let data = fs.readFileSync(file);

	console.log('   decompress');
	data = await helper.bunzip2(data);

	console.log('   unpack');
	data = JSON.parse(data);

	console.log('   scan');
	data.forEach(entry => {
		//let dayMelde = (entry.IstErkrankungsbeginn === 1) ? entry.RefdatumISO : entry.MeldedatumISO;
		let dayMelde = entry.MeldedatumISO;
		dayMelde = parseDate(dayMelde);

		let id = entry.IdLandkreis;
		if (!lookup.has(id)) throw Error();
		let index = lookup.get(id).index;

		let i = dayMelde - dayMin;
		if (i < 0) return;
		if (!days[i]) days[i] = [];
		let day = days[i];

		day[index] = (day[index] || 0) + entry.AnzahlFall;
		if (dayMelde > dayMax) dayMax = dayMelde;
	})

	console.log('   finalize');

	for (let i = 0; i <= dayMax-dayMin; i++) if (!days[i]) days[i] = [];

	days = days.map((day,i) => landkreise.map(l => {
		let s = 0;
		for (let j = Math.max(0,i-blurWindow); j < i; j++) s += days[j][l.index] || 0;
		return s;
	}))

	let result = {
		dayMin,
		dayMax,
		landkreise,
		days,
		borders0: deutschland,
		borders1: bundeslaender,
	}
	
	console.log('   save');

	result = 'window.fvOZwtTDlpiMFxSV = '+stringify(result, (d,l) => l > 1);

	fs.writeFileSync('../docs/data.js', result, 'utf8');
})()

function stringify(data, collapseChecker = false) {
	return rec(data);
	function rec(data, level = 0, indent0 = '', collapse = false) {
		let type = typeof data;

		switch (type) {
			case 'undefined':
				return JSON.stringify(data);
			case 'number':
			case 'string':
				return JSON.stringify(data);
			case 'object':
				if (data === null) return 'null';
				if (collapseChecker && !collapse && collapseChecker(data, level)) collapse = true;

				let result = [];
				let indent1 = collapse ? '' : indent0+'\t';
				let indent2 = collapse ? '' : indent0;
				let newLine = collapse ? '' : '\n';
				let valString;
				if (Array.isArray(data)) {
					result.push('['+newLine);
					for (let i = 0; i < data.length; i++) {
						try {
							valString = rec(data[i], level+1, indent1, collapse);
						} catch (e) {
							console.log(e);
							throw Error('in Array at '+i)
						}
						result.push(indent1+valString + (i < data.length-1 ? ',' : '') + newLine);
					}
					result.push(indent2+']');
				} else {
					result.push('{'+newLine);
					let keys = Object.keys(data).sort();
					keys.forEach((key,i) => {
						let keyString = /^[a-z_][a-z0-9_]*$/i.test(key) ? key : JSON.stringify(key);
						try {
							valString = rec(data[key], level+1, indent1, collapse);
						} catch (e) {
							console.log(e);
							throw Error('in Object at key "'+key+'"');
						}
						result.push(indent1+keyString+':' + valString + (i < keys.length-1 ? ',' : '') + newLine);
					})
					result.push(indent2+'}');
				}
				return result.join('');
			default: throw Error('type: '+type);
		}
	}
}

function parseDate(text) {
	return Math.round(Date.parse(text)/86400000);
}



