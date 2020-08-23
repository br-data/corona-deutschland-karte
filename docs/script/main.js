"use strict"

$(function () {
	let blurWindow = 7;

	let geo = false, data = false, day, markerDirty, animation, map;
	let markerPositions = [];
	let slider, sliderLabel;
	const months = 'Jan.,Feb.,März,April,Mai,Juni,Juli,Aug.,Sep.,Okt.,Nov.,Dez.'.split(',')

	initMap();
	initData(() => {
		updateMarkerPositions();

		initSlider();

		markerDirty = true;
		setInterval(updateMarkerColors, 20);

		animation = initAnimation();
		$('#button_play').click(animation.play);
		setTimeout(animation.play, 1000);

		initChart();
	});

	initLegend();

	function initData(cb) {
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

		function checkInitialization() {
			if (!geo || !data) return;
			let lookup = new Map();
			geo.features.forEach(f => lookup.set(f.properties.RS, f));
			data.entries.forEach(e => {
				lookup.get(e.id).data = e;
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

			cb();
		}
	}

	function initMap() {
		map = L.map('map', {
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
	}

	function initChart() {
		const baseColor = '#888';
		let dayMin = data.dayMin, dayMax = data.dayMax;
		let width, height, retina;
		let maxValue = 200, paddingLeft = 20, paddingBottom = 20;

		let container = $('#chartContainer');
		let canvas1 = $('#chartCanvas1');
		let canvas2 = $('#chartCanvas2');
		let ctx1 = canvas1.get(0).getContext('2d');
		let ctx2 = canvas2.get(0).getContext('2d');

		$(window).resize(updateCanvasLayout);
		updateCanvasLayout();

		function drawChart1() {
			ctx1.clearRect(0,0,width,height);

			ctx1.fillStyle = baseColor;
			ctx1.strokeStyle = baseColor;
			ctx1.textBaseline = 'top';
			ctx1.font = 10*retina + 'px sans-serif';


			let x0 = v2x(dayMin);
			let y0 = v2y(0);

			ctx1.beginPath();

			line(ctx1, [[x0,0],[,y0],[width]]);
			
			for (let v = 0; v <= maxValue; v += 10) {
				line(ctx1, [[x0,v2y(v)],[x0-(v % 50 === 0 ? 8 : 3)]]);
			}
			
			for (let v = dayMin; v <= dayMax; v++) {
				let d = (new Date((v+0.5)*86400000));
				let monthStart = (d.getDate() === 1);
				
				if (monthStart) {
					line(ctx1, [[v2x(v),y0],[,y0+8]]);	
					text(ctx1, months[d.getMonth()], [v2x(v)+3, y0+3]);
				}
			}

			ctx1.stroke();
		}

		function v2y(v) {
			return (1-v/maxValue)*(height-paddingBottom)
		}

		function v2x(v) {
			return ((v-dayMin)/(dayMax-dayMin)*(width-paddingLeft)+paddingLeft)
		}

		function drawChart2() {
		}

		function updateCanvasLayout() {
			retina = window.devicePixelRatio;
			width  = container.innerWidth();
			height = container.innerHeight();
			canvas1.attr({width:width*retina, height:height*retina}).css({width,height});
			canvas2.attr({width:width*retina, height:height*retina}).css({width,height});
			drawChart1();
			drawChart2();
		}

		function text(ctx, text, point) {
			ctx.fillText(text, point[0]*retina, point[1]*retina);
		}

		function line(ctx, path) {
			path.forEach((p, i) => {
				if (p[0] === undefined) p[0] = path[i-1][0];
				if (p[1] === undefined) p[1] = path[i-1][1];
				if (i === 0) {
					ctx.moveTo(p[0]*retina, p[1]*retina);
				} else {
					ctx.lineTo(p[0]*retina, p[1]*retina);
				}
			})
		}
	}

	function initAnimation() {
		let playInterval = false;

		return {play, stop}

		function play() {
			let i0 = parseFloat(slider.attr('min'));
			let i1 = parseFloat(slider.attr('max'));
			let i = i0;
			playInterval = setInterval(() => {
				slider.val(i);
				markerDirty = true;
				i++;
				if (i > i1) stop();
			}, 20)
		}

		function stop() {
			if (!playInterval) return;
			clearInterval(playInterval);
			playInterval = false;
		}
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
			animation.stop();
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