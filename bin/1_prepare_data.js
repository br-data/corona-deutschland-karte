"use strict"

const fs = require('fs');
const helper = require('./lib/helper.js');
const {resolve} = require('path');
const distance = require('@turf/distance').default;

const dayMin = parseDate('2020-02-01');
let dayMax = 0;
const folder = resolve(__dirname, '../data/');

console.log('start');

let file = fs.readdirSync(folder).filter(f => /^data_202.*\.json\.bz2$/.test(f)).sort().pop();
file = resolve(folder, file);

let landkreise = JSON.parse(fs.readFileSync(resolve(folder, 'landkreise.geojson')));
landkreise = landkreise.features.map(f => {
	let sx = 0, sy = 0, s = 0;
	scan(f.geometry.coordinates, (f.geometry.type === 'Polygon') ? 2 : 3);
	function scan(list, n) {
		if (n > 1) return list.forEach(s => scan(s, n-1));
		list.forEach(p => {sx += p[0]; sy += p[1]; s++});
	}

	f = {
		x: sx/s,
		y: sy/s,
		r: Math.sqrt(f.properties.EWZ)*15,
		id:  f.properties.RS, 
		ew: f.properties.EWZ, 
		type: f.properties.BEZ, 
		title: f.properties.GEN,
	}
	f.m = f.r*f.r;
	f.x0 = f.x;
	f.y0 = f.y;
	return f;
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

console.log('physics')
let sum;
do {
	landkreise.forEach(f => {
		f.dx = 0.001*(f.x0-f.x);
		f.dy = 0.001*(f.y0-f.y);
		f.d  = 1;
	})
	pairs.forEach(p => {
		let f1 = p[0];
		let f2 = p[1];

		let d = distance([f1.x,f1.y], [f2.x,f2.y], {units:'kilometers'})*1000;
		if (d > f1.r+f2.r) return;
		
		let dx = f1.x - f2.x;
		let dy = f1.y - f2.y;
		
		//let factor = f1.m*f2.m*((f1.r+f2.r)/d-1)/(f1.m+f2.m);
		let factor = ((f1.r+f2.r)/d-1)/(f1.m+f2.m);
		
		f1.dx += f2.m*factor*dx;
		f1.dy += f2.m*factor*dy;
		f1.d  += f2.m*factor;

		f2.dx -= f1.m*factor*dx;
		f2.dy -= f1.m*factor*dy;
		f2.d  += f1.m*factor;
	})
	sum = 0;
	landkreise.forEach(f => {
		let d = Math.sqrt(f.dx*f.dx + f.dy*f.dy);
		sum += d;
		let factor = 0.3/(f.d);
		f.x += factor*f.dx;
		f.y += factor*f.dy;
	})
	console.log(sum);
} while (sum > 1e-2);

landkreise.forEach(f => {
	let n = 10000;
	f.x = Math.round(f.x*n)/n;
	f.y = Math.round(f.y*n)/n;
	f.r = Math.round(f.r);
	delete f.d;
	delete f.dx;
	delete f.dy;
	delete f.m;
	delete f.x0;
	delete f.y0;
})

let lookup = new Map();
landkreise.sort((a,b) => a.id < b.id ? -1 : 1);
landkreise.forEach((l,i) => {
	l.index = i;
	lookup.set(l.id,l);
});

(async function () {
	let days = [];

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
		if (!lookup.has(id)) throw Error();
		let index = lookup.get(id).index;

		let i = dayMelde - dayMin;
		if (i < 0) return;
		if (!days[i]) days[i] = [];
		let day = days[i];

		day[index] = (day[index] || 0) + entry.AnzahlFall;
		if (dayMelde > dayMax) dayMax = dayMelde;
	})

	console.log('finalize');

	for (let i = dayMin; i <= dayMax; i++) {
		if (!days[i-dayMin]) days[i-dayMin] = [];
	}
	days.forEach(day => {
		for (let i = 0; i < landkreise.length; i++) {
			if (!day[i]) day[i] = 0;
		}
	})
	days[dayMax-dayMin+1] = null;

	let result = {
		dayMin,
		dayMax,
		landkreise,
		days,
	}
	
	console.log('save');

	result = 'window.fvOZwtTDlpiMFxSV = '+stringify(result, (d,l) => {
		if ((l > 1) && (Array.isArray(d))) return true;
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



