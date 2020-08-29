"use strict"

const fs = require('fs');
const helper = require('./lib/helper.js');
const {resolve} = require('path');
const distance = require('@turf/distance').default;

const dayMin = parseDate('2020-02-20');
const blurWindow = 7;
const folder = resolve(__dirname, '../data/');

let dayMax = 0;



console.log('start with landkreise');

const centerX = 10.4541236;
const centerY = 51.1846362;
const scaleY = 2/6;
const scaleX = scaleY*Math.cos(centerY*Math.PI/180);

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
		r: Math.sqrt(f.properties.EWZ)*15,
		id:  f.properties.RS, 
		ew: f.properties.EWZ, 
		type: f.properties.BEZ, 
		title: f.properties.GEN,
	}
})

let pairs = [];
for (let j1 = 0; j1 < landkreise.length; j1++) {
	let f1 = landkreise[j1];
	for (let j2 = j1+1; j2 < landkreise.length; j2++) {
		let f2 = landkreise[j2];
		let d = distance([f1.x,f1.y], [f2.x,f2.y], {units:'kilometers'});
		if (d < 30+f1.r+f2.r) pairs.push([f1,f2]);
	}
}

landkreise.forEach(f => {
	let n = 10000;
	f.x = Math.round(f.x*n)/n;
	f.y = Math.round(f.y*n)/n;
	f.r = Math.round(f.r);
})

let lookup = new Map();
landkreise.sort((a,b) => a.id < b.id ? -1 : 1);
landkreise.forEach((l,i) => {
	l.index = i;
	lookup.set(l.id,l);
});



console.log('start with deutschland');

let deutschland = JSON.parse(fs.readFileSync(resolve(folder, 'deutschland.geo.json')));
deutschland = deutschland.features[0].geometry.coordinates;
deutschland = deutschland.map(p => p[0]).filter(p => p.length > 15);

deutschland = deutschland.map(poly => poly.map(p => ([
	Math.round( (p[0]-centerX)*scaleX*10000)/10000,
	Math.round(-(p[1]-centerY)*scaleY*10000)/10000,
])));



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
		let dayMelde = parseDate(entry.MeldedatumISO);

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
		for (let j = Math.max(0,i-blurWindow); j <= i; j++) s += days[j][l.index] || 0;
		return s;
	}))

	let result = {
		dayMin,
		dayMax,
		landkreise,
		days,
		borders0: deutschland,
	}
	
	console.log('   save');

	result = 'window.fvOZwtTDlpiMFxSV = '+stringify(result, (d,l) => {
		if ((l > 1) && Array.isArray(d) && (d.length < 1000)) {
			//console.log(d.length);
			//return false;
			return true;
		}
		//if ((l > 1) && (d.title)) return true;
		return false;
	});
	//console.log(result);

	fs.writeFileSync('../docs/data/data.js', result, 'utf8');
})()

function stringify(data, collapseChecker = false) {
	return rec(data);
	function rec(data, level = 0, indent0 = '', collapse = false) {
		let type = typeof data;

		switch (type) {
			case 'undefined':
				return JSON.stringify(data);
				//console.log(JSON.stringify(data));
			//break;
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



