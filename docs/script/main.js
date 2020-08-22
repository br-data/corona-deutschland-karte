"use strict"

$(function () {
	let blurWindow = 7;
	let map = L.map('map', {
		preferCanvas: true,
		layers: [
			L.tileLayer('https://{s}.basemaps.cartocdn.com/light_nolabels/{z}/{x}/{y}{r}.png', {
				attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
				subdomains: 'abcd',
				maxZoom: 19
			})
		]
	});
	map.fitBounds([[47.2701114, 5.8663153],[55.099161, 15.0419319]]);

	let geo = false, data = false, geoLayer, day, markerDirty;
	let markerPositions = [];
	let slider, sliderLabel;
	let playInterval = false;

	$.getJSON('data/landkreise.topo.json', res => {
		geo = topojson.feature(res, res.objects.landkreise)
		geo.features.map(f => {
			let sx = 0, sy = 0, s = 0;
			scan(f.geometry.coordinates, (f.geometry.type === 'Polygon') ? 2 : 3);
			function scan(list, n) {
				if (n > 1) return list.forEach(s => scan(s, n-1));
				list.forEach(p => {sx += p[0]; sy += p[1]; s++});
			}
			f.x = sx/s;
			f.y = sy/s;
			f.r = Math.sqrt(f.properties.EWZ)/100;
		})
		checkInitialization();
	})

	$.getJSON('data/data.json', res => {
		data = res;
		checkInitialization();
	})

	initLegend();

	function checkInitialization() {
		if (!geo || !data) return;
		let lookup = new Map();
		geo.features.forEach(f => lookup.set(f.properties.RS, f));
		data.entries.forEach(e => {
			lookup.get(e.key).data = e;
			let a = e.fall;
			e.blurred = e.fall.map((v,i) => {
				for (let j = Math.max(0,i-blurWindow); j < i; j++) v += a[j];
				return v;
			})
		});
		let colorStart = value2color(0);
		geo.features.forEach(f => {
			f.marker = L.circleMarker([f.y, f.x], {
				radius:f.r,
				stroke:true,
				weight:0.1,
				color:'#000000',
				opacity:1,
				fillOpacity:1,
				fillColor:colorStart,
			});
			f.marker.bindTooltip(f.properties.GEN+'<br><small>'+f.properties.BEZ+'</small>')
			map.addLayer(f.marker);
		})
		updateMarkerPositions();
		initSlider();

		day
		markerDirty = true;
		setInterval(updateMarkerColors, 20);

		$('#button_play').click(playAnimation);
		setTimeout(playAnimation, 1000);
	}

	function playAnimation() {
		let i0 = parseFloat(slider.attr('min'));
		let i1 = parseFloat(slider.attr('max'));
		let i = i0;
		playInterval = setInterval(() => {
			slider.val(i);
			markerDirty = true;
			i++;
			if (i > i1) stopAnimation();
		}, 20)
	}

	function stopAnimation() {
		if (!playInterval) return;
		clearInterval(playInterval);
		playInterval = false;
	}

	function initLegend() {
		let html = ['<table id="legend">'];
		for (let v = 100; v >= 0; v -= 10) {
			let color = value2color(v);
			let text = (v % 50 === 0) ? v : '';
			html.push('<tr><td>'+text+'</td><td style="background:'+color+'"></td></tr>');
		}
		html.push('</table>');

		let menu = L.Control.extend({
			onAdd: function() {
				return $(html.join('')).get(0);
			},
			onRemove: function(map) {}
		});

		map.addControl(new menu({position:'bottomright'}));
	}

	function updateMarkerColors() {
		if (!markerDirty) return;
		markerDirty = false;
		day = Math.round(slider.val());
		sliderLabel.text((new Date(day*86400000)).toLocaleDateString());
		day -= data.dayMin;

		geo.features.forEach(f => {
			let v = 100000*f.data.blurred[day]/f.properties.EWZ;

			let color = value2color(v)

			f.marker.setStyle({
				fillColor:color
			})
		})
	}

	function updateMarkerPositions() {
		let zoomlevel = map.getZoom();
		let point, size;

		if (markerPositions[zoomlevel]) {
			point = markerPositions[zoomlevel].point;
			size = markerPositions[zoomlevel].size;
		} else {
			let scale = Math.pow(1.5, (zoomlevel-7)/2);
			//scale = 1;
			size = new Array(geo.features.length);
			let mass = new Array(geo.features.length);
			point = geo.features.map((f,i) => {
				size[i] = f.r;
				mass[i] = Math.pow(f.r, 2);
				let pixel = map.latLngToLayerPoint([f.y, f.x]);
				return [
					pixel.x + 1e-10*Math.cos(i),
					pixel.y + 1e-10*Math.sin(i),
				];
			})

			//console.log(size);
			//console.log(point);

			let stepCount = 0;
			let errorSum;

			do {
				let dPoint = geo.features.map(s => [0,0,0]);
				let delaunay = Delaunator.from(point);
				errorSum = 0;
				delaunay.halfedges.forEach((v,i) => {
					if (v > i) return;
					let p0 = delaunay.triangles[i];
					let p1 = delaunay.triangles[(i % 3 === 2) ? i-2 : i+1];
					let dx = point[p0][0] - point[p1][0];
					let dy = point[p0][1] - point[p1][1];
					let dIs = Math.sqrt(dx*dx + dy*dy)+1e-6;
					let dShould = size[p0] + size[p1];
					if (dIs > dShould) return;

					errorSum += Math.pow(dShould-dIs, 2);

					let m0 = mass[p0];
					let m1 = mass[p1];
					let ms = m0+m1;

					let f = 0.5*(dShould-dIs)/dIs/ms;

					dPoint[p0][0] += m1*dx*f;
					dPoint[p0][1] += m1*dy*f;
					dPoint[p0][2]++;

					dPoint[p1][0] -= m0*dx*f;
					dPoint[p1][1] -= m0*dy*f;
					dPoint[p1][2]++;
				})
				point.forEach((p,i) => {
					let dp = dPoint[i];
					if (dp[2] === 0) return;
					//let f = Math.pow(dp[2], 0.5);
					let f = dp[2];
					p[0] += dp[0]/f;
					p[1] += dp[1]/f;
				})

				//console.log(errorSum);
				stepCount++
			} while (errorSum > 0.01);

			//console.log(stepCount);

			point = point.map(p => map.layerPointToLatLng(p));
			//console.log(point);
			
			markerPositions[zoomlevel] = {point:point, size:size};
		}
		
		geo.features.forEach((s,i) => {
			s.marker.setLatLng(point[i]);
			s.marker.setRadius(size[i]);
		})
	}

	function initSlider() {
		slider = $('#slider');
		sliderLabel = $('#slider_label');
		slider.attr({
			min:data.dayMin,
			max:data.dayMax,
		})
		slider.val(data.dayMin);
		slider.on('mousedown mousemove touchstart touchmove', e => e.stopPropagation());
		slider.on('input', function (event) {
			stopAnimation();
			markerDirty = true;
		})
	}

	function value2color(v) {

		v = Math.max(0, v/100);

		//let color = [
		//	Math.pow(Math.max(0,-195.996*v*v+271.995*v+128.001),1),
		//	Math.pow(Math.max(0,-396.005*v*v+194.005*v+201.999),1),
		//	Math.pow(Math.max(0,370.003*v*v+-625.004*v+255),1),
		//]

		let color = [
			Math.exp(-0.737*v*v-0.0555*v+5.5516)/(1+Math.exp(-v*10-1)),
			222/(1+Math.exp(v*10-5)),
			240/(1+Math.exp((v-0.125)*20)),
		]

		return 'rgb('+color.map(v => Math.round(v)).join(',')+')';
	}
})