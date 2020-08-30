
$(function () {
	let dayIndex, animation, map;
	let data = window.fvOZwtTDlpiMFxSV;
	let slider;
	let chart;
	let selection = [];
	const months = 'Jan.,Feb.,März,April,Mai,Juni,Juli,Aug.,Sep.,Okt.,Nov.,Dez.'.split(',')
	const baseColor = 'rgba(255,255,255,0.5)';

	initData(() => {
		chart = initChart();
		map = initMap();
		
		setDay(data.dayMax-data.dayMin)

		animation = initAnimation();
		$('#button_play').click(animation.play);
		//setTimeout(animation.play, 1000);
	});

	function setDay(index) {
		if (index === dayIndex) return;
		dayIndex = index;
		map.redraw();
		chart.redraw();
	}

	function highlight(e) {
		if (!chart || !map || (selection[1] === e)) return;
		selection[1] = e;
		chart.redraw();
		map.redraw();
	}

	function select(e) {
		if (!chart || !map) return;
		if (selection[0] === e) e = false;
		selection[0] = e;
		chart.redraw();
		map.redraw();
	}

	function initData(cb) {
		let days = [];
		for (let i = 0; i <= data.dayMax-data.dayMin; i++) days[i] = i;

		let ewD = 0;
		data.landkreise.forEach(l => {
			l.infected = days.map(d => data.days[d][l.index]);
			l.normalized = l.infected.map(v => 100000*v/l.ew);
			l.radius = l.infected.map(v => Math.sqrt(v)*0.0025);
			l.rMax = l.radius.reduce((s,r) => Math.max(s,r));
			l.x0 = l.x;
			l.y0 = l.y;

			ewD += l.ew;
		});

		let pairs = [];
		data.landkreise.forEach((l0,i0) => {
			for (let i1 = i0+1; i1 < data.landkreise.length; i1++) {
				let l1 = data.landkreise[i1];
				let d = Math.sqrt(sqr(l0.x - l1.x) + sqr(l0.y - l1.y)) - l0.rMax - l1.rMax;
				if (d < 0.2) pairs.push([l0,l1]);
			}
		})
		data.pairs = pairs;

		data.deutschland = data.days.map(d => d.reduce((s,v) => s+v, 0)*100000/ewD)

		cb();
	}

	function initMap() {
		const maxValue = 150;
		let zoomX, zoomY, offsetX, offsetY;
		let timeoutHandler;
		
		const gradient = [
			[ 60,100, 90],
			[ 30,100,100],
			[  0,100, 70],
			[  0,100, 30],
		].map(hsv2rgb);

		let container = new CanvasContainer('#mapContainer');
		let changeCheckerDraw   = new ChangeChecker();
		let changeCheckerLayout = new ChangeChecker();

		function relayout(opt) {
			zoomX = 0.99*opt.width/2;
			zoomY = 0.74*opt.height/2;
			if (zoomX > zoomY) {
				zoomX = Math.sqrt(zoomX*zoomY);
			} else {
				zoomY = Math.sqrt(zoomX*zoomY);
			}
			offsetX = opt.width/2;
			offsetY = opt.height/2;
		}

		container.drawBg = function drawMapBg (ctx, opt) {
			if (!changeCheckerLayout(opt)) return;

			relayout(opt);

			ctx.clearRect(0,0,opt.width,opt.height);

			ctx.fillStyle = '#fff';
			ctx.shadowBlur = 0.01*opt.width*opt.retina;
			ctx.shadowColor = 'rgba(255,255,255,1)';
			ctx.shadowOffsetX = 0;
			ctx.shadowOffsetY = 0;
			
			ctx.beginPath();
			data.borders0.forEach(poly => {
				poly.forEach((p,i) => {
					(i?ctx.lineTo:ctx.moveTo).call(ctx, zoomX*p[0]+offsetX, zoomY*p[1]+offsetY)
				})
			})
			ctx.fill();

			ctx.shadowColor = 'transparent';

			drawLegend(ctx, opt)
		}

		container.drawFg = function drawMapFg (ctx, opt) {
			if (changeCheckerLayout(opt)) relayout(opt);

			if (!timeoutHandler && !changeCheckerDraw([opt, dayIndex, selection.map(f => f.index)])) return;
			if (dayIndex === undefined) return;
			if (timeoutHandler) {
				clearTimeout(timeoutHandler);
				timeoutHandler = false;
			}

			ctx.clearRect(0,0,opt.width,opt.height);

			data.landkreise.forEach(f => {
				f.r = f.radius[dayIndex];
				f.m = f.r*f.r;

				let dx = f.x0 - f.x;
				let dy = f.y0 - f.y;
				let d0 = Math.sqrt(dx*dx + dy*dy);

				f.xOld = f.x;
				f.yOld = f.y;

				if (d0 < 1e-5) return;

				f.x += 0.3*dx;
				f.y += 0.3*dy;
			})

			let zoomR = zoomY;
			let aspectRatioRadius = zoomX/zoomY;

			for (let i = 0; i < 3; i++) {
				let c = 0;
				data.pairs.forEach(p => {
					let f0 = p[0];
					let f1 = p[1];

					let dx = (f0.x - f1.x)*aspectRatioRadius;
					let dy = (f0.y - f1.y);
					let d0 = Math.sqrt(dx*dx + dy*dy);
					let d = d0 - f0.r - f1.r;

					if (d >= -1e-4) return;

					d = d/(d0*(f0.m + f1.m) + 1e-10);

					f0.x -= f1.m*d*dx;
					f0.y -= f1.m*d*dy;
					f1.x += f0.m*d*dx;
					f1.y += f0.m*d*dy;

					c++;
				})
				if (c <= 10) break;
			}

			let changeSum = 0;
			data.landkreise.forEach(f => {
				ctx.fillStyle = value2color(f.normalized[dayIndex])

				changeSum += Math.sqrt(sqr(f.x-f.xOld) + sqr(f.y-f.yOld));

				f.px = zoomX*f.x + offsetX;
				f.py = zoomY*f.y + offsetY;
				f.pr = zoomR*f.r;
				
				ctx.beginPath();
				ctx.arc(f.px, f.py, f.pr, 0, 2*Math.PI);
				ctx.fill();
			})

			selection.forEach(f => {
				if (!f) return;

				// markiere entry
				ctx.strokeStyle = '#000';
				ctx.lineWidth = 2*opt.retina;
				ctx.beginPath();
				ctx.arc(f.px, f.py, f.pr+1*opt.retina, 0, 2*Math.PI);
				ctx.stroke();
				
				ctx.font = 12*opt.retina + 'px sans-serif';
				ctx.textAlign = 'left';

				let x = f.px;
				let y = f.py;
				let m1 = ctx.measureText(f.title);
				let m2 = ctx.measureText(f.type);
				let px = 4*opt.retina;
				let py = 3*opt.retina;
				let w = Math.max(m1.width, m2.width)+2*px;
				let h = 12*opt.retina+py;
				let r = 3*opt.retina;

				if (x < offsetX) {
					x += f.pr + 10*opt.retina;
				} else {
					x -= f.pr + 10*opt.retina + w;
				}

				ctx.beginPath();
				ctx.drawRoundRect(x, y-h, x+w, y+h, r);
				ctx.fillStyle = '#fff';
				ctx.fill();

				ctx.lineWidth = 1*opt.retina;
				ctx.strokeStyle = 'rgba(0,0,0,1)';
				ctx.stroke();

				ctx.fillStyle = '#000';
				ctx.textBaseline = 'bottom';
				ctx.fillText(f.title, x+px, y);

				ctx.fillStyle = '#888';
				ctx.textBaseline = 'top';
				ctx.fillText(f.type, x+px, y);
			})

			if (changeSum > 0.01) timeoutHandler = setTimeout(container.redrawFg, 30);
		}

		container.on('mousemove', e => {
			highlight(findLandkreis(e));
		})
		container.on('click', e => {
			select(findLandkreis(e));
		})
		container.on('mouseout', e => highlight(false))

		container.init();

		function findLandkreis(e) {
			let minD = 1e10, minF;
			data.landkreise.forEach(f => {
				let d = Math.sqrt(sqr(f.px - e.px) + sqr(f.py - e.py))-f.pr;
				if (d < minD) {
					minD = d;
					minF = f;
				}
			})
			if (minD > 10*e.retina) return false;
			return minF;
		}

		function drawLegend(ctx, opt) {
			let width = 10*opt.retina;
			let padding = 10*opt.retina;
			let step = 1*opt.retina;
			let x0 = opt.width - padding - width;

			for (let y = 0; y <= maxValue*step; y++) {
				let y0 = opt.height-padding-y;

				ctx.strokeStyle = value2color(y/step);
				ctx.beginPath();
				ctx.lineH(x0,y0,x0+width);
				ctx.stroke();
			}

			ctx.textBaseline = 'middle';
			ctx.font = 10*opt.retina + 'px sans-serif';
			ctx.fillStyle = baseColor;
			ctx.textAlign = 'right';

			for (let v = 0; v <= maxValue; v += 50) {
				let y = opt.height - padding - v*step;

				ctx.beginPath();
				ctx.strokeStyle = baseColor;
				ctx.lineH(x0-3*opt.retina, y, x0+width);
				ctx.stroke();

				ctx.fillText(v, x0-6*opt.retina, y);
			}
		}

		function value2color(v) {
			v = Math.max(0, Math.min(1, (v||0)/maxValue))*(gradient.length-1);

			let i = Math.max(0,Math.min(Math.floor(v), gradient.length-2));
			let c0 = gradient[i];
			let c1 = gradient[i+1];
			let a = v-i;

			let c = 'rgb('+
				Math.round(c0[0]*(1-a) + a*c1[0])+','+
				Math.round(c0[1]*(1-a) + a*c1[1])+','+
				Math.round(c0[2]*(1-a) + a*c1[2])+
			')';

			return c;
		}

		return {
			redraw: container.redrawFg,
		}
	}

	function initChart() {
		const dayMin = data.dayMin, dayMax = data.dayMax;
		const maxValue = 200;
		let paddingTop, paddingLeft, paddingRight, paddingBottom;
		let projX, projY, x0, x1, y0, y1, retina;

		const container = new CanvasContainer('#chartContainer');
		const changeCheckerDraw   = new ChangeChecker();
		const changeCheckerLayout = new ChangeChecker();

		const colors = [
			[ 11,159,216,1.0],
			[230, 66,  6,1.0],
			[255,184,  0,1.0],
		]

		function relayout(opt) {
			retina = opt.retina;
			paddingTop = 10*opt.retina;
			paddingLeft = 30*opt.retina;
			paddingRight = 30*opt.retina;
			paddingBottom = 30*opt.retina;

			let w = opt.width - paddingLeft - paddingRight;
			let h = opt.height - paddingTop - paddingBottom;
			let aspectRatio = w/h;
			const minAspectRatio = 1;
			if (aspectRatio < minAspectRatio) {
				diff = Math.round((h-w/minAspectRatio)/2);
				paddingTop += diff;
				paddingBottom += diff;
			}

			projX = getProjection(0, dayMax-dayMin, paddingLeft, opt.width - paddingRight);
			projY = getProjection(0, maxValue, opt.height - paddingBottom, paddingTop);

			x0 = projX.v2p(0);
			x1 = projX.v2p(dayMax-dayMin);
			y0 = projY.v2p(0);
			y1 = projY.v2p(maxValue);

			if (!slider) return;
			slider.setX(x0/opt.retina, x1/opt.retina);
		}

		container.drawBg = function drawChartBg (ctx, opt) {
			if (!changeCheckerLayout(opt)) return;
			relayout(opt);

			ctx.clearRect(0,0,opt.width,opt.height);

			// draw chart

			ctx.lineWidth = 1;
			ctx.strokeStyle = 'rgba('+colors[0].join(',')+')';
			ctx.fillStyle   = 'rgba('+colors[0].map((v,i)=>v/(i>2?5:1)).join(',')+')';
			
			ctx.beginPath();
			data.deutschland.forEach((v,i) => (i ? ctx.lineTo : ctx.moveTo).call(ctx, projX.v2p(i), projY.v2p(v)));
			ctx.stroke();
			ctx.lineTo(x1, y0);
			ctx.lineTo(x0, y0);
			ctx.fill();

			// draw axes

			ctx.fillStyle = baseColor;
			ctx.strokeStyle = baseColor;
			ctx.font = 12*opt.retina + 'px sans-serif';

			ctx.beginPath();

			ctx.lineV(x0,y0,y1);
			ctx.lineH(x0,y0,x1);

			ctx.textBaseline = 'middle';
			ctx.textAlign = 'right';
			
			for (let v = 0; v <= maxValue; v += 10) {
				let y = projY.v2p(v);
				if (v % 50 === 0) {
					ctx.lineH(x0, y, x0 - 4*opt.retina);
					ctx.fillText(v, x0 - 5*opt.retina, y + 0.5*opt.retina);
				} else {
					ctx.lineH(x0, y, x0 - 2*opt.retina);
				}
			}

			ctx.textBaseline = 'top';
			ctx.textAlign = 'left';
			
			for (let v = dayMin; v <= dayMax; v++) {
				let d = (new Date((v+0.5)*86400000));
				let monthStart = (d.getDate() === 1);
				
				if (monthStart) {
					ctx.lineV(projX.v2p(v-dayMin), y0, y0+6*opt.retina);
					ctx.fillText(months[d.getMonth()], projX.v2p(v-dayMin)+2*opt.retina, y0+2*opt.retina);
				}
			}

			ctx.stroke();

			/*
			ctx.rotate(-Math.PI/2);
			ctx.textBaseline = 'top';
			ctx.textAlign = 'center';
			ctx.fillText('Innerhalb von 7 Tagen gemeldete Infektionen auf 100.000 Einwohner_innen', -(y0+y1)/2, 5*opt.retina);
			ctx.setTransform(1, 0, 0, 1, 0, 0);
			*/
		}

		container.drawFg = function drawChartFg (ctx, opt) {
			if (changeCheckerLayout(opt)) relayout(opt);

			if (!changeCheckerDraw([opt, dayIndex, selection.map(f => f.index)])) return;

			ctx.clearRect(0,0,opt.width,opt.height);
			ctx.lineWidth = 1*opt.retina;

			
			selection.forEach((f,index) => {
				if (!f) return;

				ctx.strokeStyle = 'rgba('+colors[index+1].join(',')+')';
				ctx.fillStyle   = 'rgba('+colors[index+1].map((v,i)=>v/(i>2?5:1)).join(',')+')';

				ctx.beginPath();
				f.normalized.forEach((v,i) => (i ? ctx.lineTo : ctx.moveTo).call(ctx, projX.v2p(i), projY.v2p(v)));
				ctx.stroke();
				ctx.lineTo(x1, y0);
				ctx.lineTo(x0, y0);
				ctx.fill();
			})

			let x = projX.v2p(dayIndex);
			let ya = y0 + 8*opt.retina;
			let yb = ya + 8*opt.retina;
			let yc = yb + 12*opt.retina;
			let w = 8*opt.retina;
			let r = 3*opt.retina;

			ctx.setLineDash([2*opt.retina, 4*opt.retina]);
			ctx.strokeStyle = baseColor;
			ctx.beginPath();
			ctx.lineV(x, y1, y0);
			ctx.stroke();
			ctx.setLineDash([]);


			ctx.fillStyle = '#fff';
			ctx.beginPath();
			ctx.moveTo(x, ya);
			ctx.arcTo(x+w, yb, x+w, yc, r);
			ctx.arcTo(x+w, yc, x-w, yc, r);
			ctx.arcTo(x-w, yc, x-w, yb, r);
			ctx.arcTo(x-w, yb, x, ya, r);
			//ctx.arcTo(x0, y0, x1, y0, r);
			//ctx.drawRoundRect(x-w, y, x+w, y+h, 3*opt.retina);
			ctx.fill();

			//ctx.beginPath();
			//ctx.arc(projX.v2p(dayIndex), (y1*2+y0)/3, 30*opt.retina, 0, Math.PI*2);
			//ctx.stroke();

			//ctx.beginPath();
			//ctx.lineV(projX.v2p(dayIndex), y1, y0);
			//ctx.stroke();
		}

		let drag = false
		container.on('mousedown', e => {
			drag = true;
			handleEvent(e);
		});
		container.on('mousemove', e => {
			container.setCursor((Math.abs(projX.v2p(dayIndex) - e.px) < 5*retina) ? 'col-resize' : 'default');

			if (!drag) return;
			handleEvent(e);
		});
		container.on('mouseup', e => drag = false);
		$(document).on('mouseup', e => drag = false);
		function handleEvent(e) {
			let day = projX.p2v(e.px);
			day = Math.max(0, Math.min(dayMax-dayMin, Math.round(day)));
			setDay(day);
		}


		container.init();

		return {
			redraw: container.redrawFg,
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
		let retina, width, height, random, cursorName;

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
			setCursor,
		}

		function setCursor(name) {
			if (name === cursorName) return;
			cursorName = name;
			canvasFg.css('cursor', name);
		}

		function on(event, cb) {
			event.split(' ').forEach(eventName => {
				canvasFg.get(0).addEventListener(eventName, e => {
					e.px = e.offsetX*retina;
					e.py = e.offsetY*retina;
					e.retina = retina;
					cb(e);
				})
			})
		}

		return me;

		function init() {
			$(window).resize(updateLayout);
			window.matchMedia('(resolution: 1dppx)').addListener(updateLayout);
			window.matchMedia('(resolution: 2dppx)').addListener(updateLayout);
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

CanvasRenderingContext2D.prototype.lineH = function (x0,y0,x1) {
	this.moveTo(Math.round(x0), Math.round(y0) + 0.5)
	this.lineTo(Math.round(x1), Math.round(y0) + 0.5)
}

CanvasRenderingContext2D.prototype.lineV = function (x0,y0,y1) {
	this.moveTo(Math.round(x0) + 0.5, Math.round(y0))
	this.lineTo(Math.round(x0) + 0.5, Math.round(y1))
}

CanvasRenderingContext2D.prototype.drawRoundRect = function (x0, y0, x1, y1, r) {
	this.moveTo(x0+r, y0);
	this.arcTo(x1, y0, x1, y1, r);
	this.arcTo(x1, y1, x0, y1, r);
	this.arcTo(x0, y1, x0, y0, r);
	this.arcTo(x0, y0, x1, y0, r);
}

