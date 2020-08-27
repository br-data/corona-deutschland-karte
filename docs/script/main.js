

$(function () {
	let dayIndex, animation, map;
	let data = window.fvOZwtTDlpiMFxSV;
	let slider;
	let chart;
	const months = 'Jan.,Feb.,März,April,Mai,Juni,Juli,Aug.,Sep.,Okt.,Nov.,Dez.'.split(',')

	initData(() => {
		slider = initSlider();
		chart = initChart();
		map = initMap();
		animation = initAnimation();

		$('#button_play').click(animation.play);
		setTimeout(animation.play, 1000);
	});

	function highlight(e) {
		if (!chart || !map) return;
		chart.highlight(e);
		map.highlight(e);
	}

	function initData(cb) {
		let days = [];
		for (let i = 0; i <= data.dayMax-data.dayMin; i++) days[i] = i;

		let ewD = 0;
		data.landkreise.forEach(l => {
			l.infected = days.map(d => data.days[d][l.index]);
			l.normalized = l.infected.map(v => 100000*v/l.ew);
			l.radius = l.infected.map(v => Math.sqrt(v)*0.002);
			l.x0 = l.x;
			l.y0 = l.y;

			ewD += l.ew;
		});
		data.deutschland = data.days.map(d => d.reduce((s,v) => s+v, 0)*100000/ewD)

		cb();
	}

	function initMap() {
		const maxValue = 150;
		let highlightEntry = false;

		const gradient = [
			[150, 60, 40,1],
			[ 60, 60, 70,1],
			[ 30, 90, 80,1],
			[  0, 80,100,1],
		].map(hsv2rgb);

		let container = new CanvasContainer('#mapContainer');
		let changeChecker = new ChangeChecker();

		container.drawBg = function drawMapBg (ctx, opt) {
			ctx.clearRect(0,0,opt.width,opt.height);

			let zoom = opt.width/2;
			let offsetX = opt.width/2;
			let offsetY = opt.height/2;

			ctx.strokeStyle = 'rgba(255,255,255,0.5)';
			ctx.lineWidth = 0.5*opt.retina;
			
			ctx.beginPath();
			data.borders0.forEach(poly => {
				poly.forEach((p,i) => {
					(i?ctx.lineTo:ctx.moveTo).call(ctx,zoom*p[0]+offsetX,zoom*p[1]+offsetY)
				})
			})
			ctx.stroke();
		}

		container.drawFg = function drawMapFg (ctx, opt) {
			if (!changeChecker([opt, dayIndex, highlightEntry.index])) return;

			ctx.clearRect(0,0,opt.width,opt.height);

			let zoom = opt.width/2;
			let offsetX = opt.width/2;
			let offsetY = opt.height/2;

			data.landkreise.forEach(f => {
				ctx.fillStyle = value2color(f.normalized[dayIndex])

				f.px = zoom*f.x + offsetX;
				f.py = zoom*f.y + offsetY;
				f.pr = zoom*f.radius[dayIndex];
				
				ctx.beginPath();
				ctx.arc(f.px, f.py, f.pr, 0, 2*Math.PI);
				ctx.fill();
			})

			if (highlightEntry) {
				ctx.strokeStyle = '#fff';
				
				ctx.font = 10*opt.retina + 'px sans-serif';
				ctx.textAlign = 'left';

				ctx.lineWidth = 2*opt.retina;
				ctx.beginPath();
				ctx.arc(highlightEntry.px, highlightEntry.py, highlightEntry.pr, 0, 2*Math.PI);
				ctx.stroke();

				let x = highlightEntry.px + highlightEntry.pr;
				let y = highlightEntry.py;
				let m1 = ctx.measureText(highlightEntry.title);
				let m2 = ctx.measureText(highlightEntry.type);
				let p = 2*opt.retina;
				let w = Math.max(m1.width, m2.width)+2*p;
				let h = 10*opt.retina+p;
				let r = 2*opt.retina;

				if (highlightEntry.px < offsetX) {
					x += 5*opt.retina;
				} else {
					x -= 5*opt.retina + w;
				}

				ctx.fillStyle = '#fff';
				ctx.beginPath();
				ctx.moveTo(x+r, y-h);
				ctx.arcTo(x+w, y-h, x+w, y+h, r);
				ctx.arcTo(x+w, y+h, x, y+h, r);
				ctx.arcTo(x, y+h, x, y-h, r);
				ctx.arcTo(x, y-h, x+w, y-h, r);
				ctx.fill();


				ctx.fillStyle = '#000';
				ctx.textBaseline = 'bottom';
				ctx.fillText(highlightEntry.title, x+p, y);

				ctx.fillStyle = '#888';
				ctx.textBaseline = 'top';
				ctx.fillText(highlightEntry.type, x+p, y);

			/*
			l.marker = L.circle([l.y, l.x], {
				radius:l.r,
				stroke:false,
				//weight:0.1,
				//color:'#000000',
				//opacity:1,
				fillOpacity:1,
				fillColor:colorStart,
			});
			l.marker.bindTooltip(l.title+'<br><small>'+l.type+'</small>');
			l.marker.on('tooltipopen',  () => {highlight = [l]; chartDirty = true;});
			l.marker.on('tooltipclose', () => {highlight = [];  chartDirty = true;});
			map.addLayer(l.marker);
			*/
			}
		}

		container.on('mousemove', e => {
			let minD = 1e10, minF;
			data.landkreise.forEach(f => {
				let d = Math.sqrt(sqr(f.px - e.px) + sqr(f.py - e.py))-f.pr;
				if (d < minD) {
					minD = d;
					minF = f;
				}
			})
			highlight((minD < 10) && minF);
		})

		container.init();
		initLegend();



		function initLegend() {
			let html = ['<table id="legend">'];
			for (let v = maxValue; v >= 0; v -= 10) {
				let color = value2color(v);
				let text = (v % 50 === 0) ? v : '';
				html.push('<tr><td>'+text+'</td><td style="background:'+color+'"></td></tr>');
			}
			html.push('</table>');

			$('#mapContainer').append($(html.join('')));
		}

		function value2color(v) {
			v = Math.max(0, Math.min(1, v/maxValue))*(gradient.length-1);

			let i = Math.max(0,Math.min(Math.floor(v), gradient.length-2));
			let c0 = gradient[i];
			let c1 = gradient[i+1];
			let a = v-i;

			let c = 'rgba('+
				Math.round(c0[0]*(1-a) + a*c1[0])+','+
				Math.round(c0[1]*(1-a) + a*c1[1])+','+
				Math.round(c0[2]*(1-a) + a*c1[2])+','+
				Math.round((c0[3]*(1-a) + a*c1[3])*100)/100+
			')';

			return c;
		}

		return {
			redraw: container.redrawFg,
			highlight: e => {
				if (e === highlightEntry) return;
				highlightEntry = e;
				container.redrawFg()
			}
		}
	}

	function initChart() {
		const baseColor = '#fff';
		let dayMin = data.dayMin, dayMax = data.dayMax;
		let maxValue = 200, paddingTop = 5, paddingLeft = 25, paddingBottom = 20;
		let highlightEntry = false;

		let container = new CanvasContainer('#chartContainer');
		let changeChecker = new ChangeChecker();

		container.drawBg = function drawChartBg (ctx, opt) {
			ctx.clearRect(0,0,opt.width,opt.height);

			let projX = getProjection(0, dayMax-dayMin, paddingLeft*opt.retina, opt.width);
			let projY = getProjection(0, maxValue, opt.height - paddingBottom*opt.retina, paddingTop*opt.retina);

			let x0 = projX.v2p(0);
			let x1 = projX.v2p(dayMax-dayMin);
			let y0 = projY.v2p(0);
			let y1 = projY.v2p(maxValue);

			// draw chart

			ctx.lineWidth = 1*opt.retina;
			ctx.strokeStyle = 'rgba(11,159,216,0.5)';
			ctx.fillStyle = 'rgba(21,159,216,0.1)';
			
			ctx.beginPath();
			data.deutschland.forEach((v,i) => (i ? ctx.lineTo : ctx.moveTo).call(ctx, projX.v2p(i), projY.v2p(v)));
			ctx.stroke();
			ctx.lineTo(x1, y0);
			ctx.lineTo(x0, y0);
			ctx.fill();

			// draw axes

			ctx.fillStyle = baseColor;
			ctx.strokeStyle = baseColor;
			ctx.font = 10*opt.retina + 'px sans-serif';

			ctx.beginPath();

			ctx.moveTo(x0, y1);
			ctx.lineTo(x0, y0);
			ctx.lineTo(x1, y0);

			ctx.textBaseline = 'middle';
			ctx.textAlign = 'right';
			
			for (let v = 0; v <= maxValue; v += 10) {
				ctx.moveTo(x0, projY.v2p(v));
				if (v % 50 === 0) {
					ctx.lineTo(x0 - 4*opt.retina, projY.v2p(v));
					ctx.fillText(v, x0 - 5*opt.retina, projY.v2p(v) + 0.5*opt.retina);
				} else {
					ctx.lineTo(x0 - 2*opt.retina, projY.v2p(v));
				}
			}

			ctx.textBaseline = 'top';
			ctx.textAlign = 'left';
			
			for (let v = dayMin; v <= dayMax; v++) {
				let d = (new Date((v+0.5)*86400000));
				let monthStart = (d.getDate() === 1);
				
				if (monthStart) {
					ctx.moveTo(projX.v2p(v-dayMin),y0);
					ctx.lineTo(projX.v2p(v-dayMin),y0+6*opt.retina);
					ctx.fillText(months[d.getMonth()], projX.v2p(v-dayMin)+2*opt.retina, y0+2*opt.retina);
				}
			}

			ctx.stroke();
		}

		container.drawFg = function drawChartFg (ctx, opt) {
			if (!changeChecker([opt, dayIndex, highlightEntry.index])) return;

			let projX = getProjection(0, dayMax-dayMin, paddingLeft*opt.retina, opt.width);
			let projY = getProjection(0, maxValue, opt.height - paddingBottom*opt.retina, paddingTop*opt.retina);

			ctx.clearRect(0,0,opt.width,opt.height);
			ctx.lineWidth = 1*opt.retina;

			if (highlightEntry) {
				ctx.strokeStyle = 'rgba(255,184,0,1.0)';
				ctx.fillStyle = 'rgba(255,184,0,0.2)';

				ctx.beginPath();
				highlightEntry.normalized.forEach((v,i) => (i ? ctx.lineTo : ctx.moveTo).call(ctx, projX.v2p(i), projY.v2p(v)));
				ctx.stroke();
				ctx.lineTo(projX.v2p(dayMax-dayMin), projY.v2p(0));
				ctx.lineTo(projX.v2p(0), projY.v2p(0));
				ctx.fill();
			}

			ctx.setLineDash([1*opt.retina, 5*opt.retina]);
			ctx.strokeStyle = baseColor;
			ctx.beginPath();
			ctx.moveTo(projX.v2p(dayIndex), projY.v2p(maxValue));
			ctx.lineTo(projX.v2p(dayIndex), projY.v2p(0));
			ctx.stroke();
			ctx.setLineDash([]);
		}

		container.init();

		return {
			redraw: container.redrawFg,
			highlight: e => {
				if (e === highlightEntry) return;
				highlightEntry = e;
				container.redrawFg()
			}
		}

		function getProjection(v0,v1,p0,p1) {
			let s = (p1-p0)/(v1-v0);
			let offsetP = -v0*s+p0
			let offsetV = -p0/s+v0
			return {v2p,p2v};

			function v2p(v) {
				return v*s + offsetP;
			}

			function p2v(p) {
				return p/s + offsetV;
			}
		}
	}

	function initAnimation() {
		let playInterval = false;

		return {play, stop}

		function play() {
			let i0 = 0;
			let i1 = data.dayMax-data.dayMin;
			let i = i0;
			playInterval = setInterval(() => {
				slider.setValue(i);
				chart.redraw();
				map.redraw();
				i++;
				if (i > i1) stop();
			}, 30)
		}

		function stop() {
			if (!playInterval) return;
			clearInterval(playInterval);
			playInterval = false;
		}
	}

	function initSlider() {
		let slider = $('#slider');
		let sliderLabel = $('#slider_label');
		slider.attr({
			min:0,
			max:data.dayMax-data.dayMin,
		})
		slider.on('mousedown mousemove touchstart touchmove', e => e.stopPropagation());
		slider.on('input', function (event) {
			dayIndex = Math.round(slider.val());
			updateLabel();
			map.redraw();
			chart.redraw();
			animation.stop();
		})
		setValue(0);

		function setValue(index) {
			slider.val(index);
			dayIndex = index
			updateLabel();
		}

		function updateLabel() {
			sliderLabel.text((new Date((dayIndex+data.dayMin)*86400000)).toLocaleDateString());
		}

		return {
			setValue
		}
	}

	function hsv2rgb(c) {
		let h = c[0]/360;
		let s = c[1]/100;
		let v = 255*c[2]/100;

		let i = Math.floor(h * 6);
		let f = h * 6 - i;
		
		let p = v * (1 - s);
		let q = v * (1 - f * s);
		let t = v * (1 - (1 - f) * s);

		switch (i % 6) {
			case 0: c[0] = v, c[1] = t, c[2] = p; break;
			case 1: c[0] = q, c[1] = v, c[2] = p; break;
			case 2: c[0] = p, c[1] = v, c[2] = t; break;
			case 3: c[0] = p, c[1] = q, c[2] = v; break;
			case 4: c[0] = t, c[1] = p, c[2] = v; break;
			case 5: c[0] = v, c[1] = p, c[2] = q; break;
		}

		return c;
	}

	function CanvasContainer(containerName) {
		let retina, width, height, random;

		let container = $(containerName);
		let canvasBg = $('<canvas>').appendTo(container);
		let canvasFg = $('<canvas>').appendTo(container);
		let canvases = container.find('canvas');
		let ctxBg = canvasBg.get(0).getContext('2d');
		let ctxFg = canvasFg.get(0).getContext('2d');

		let me = {
			init,
			redrawBg,
			redrawFg,
			on,
		}

		function on(event, cb) {
			event.split(' ').forEach(eventName => {
				canvasFg.get(0).addEventListener(eventName, e => {
					e.px = e.offsetX*retina;
					e.py = e.offsetY*retina;
					cb(e);
				})
			})
		}

		return me;

		function init() {
			$(window).resize(updateLayout);
			updateLayout()
		}

		function redrawBg() { me.drawBg(ctxBg, {width,height,retina,random}); }
		function redrawFg() { me.drawFg(ctxFg, {width,height,retina,random}); }

		function updateLayout() {
			retina = window.devicePixelRatio;
			width  = retina*container.innerWidth();
			height = retina*container.innerHeight();
			random = Math.random();
			canvases
				.attr({width:width, height:height})
				.css({width:width/retina,height:height/retina});
			redrawBg();
			redrawFg();
		}
	}

	function ChangeChecker() {
		let state;
		return function check(value) {
			value = JSON.stringify(value);
			if (value === state) return false;
			state = value;
			return true;
		}
	}

	function sqr(v) {
		return v*v;
	}
})