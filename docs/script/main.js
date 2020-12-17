
$(function () {
	let dayIndex, animation, map;
	let data = window.fvOZwtTDlpiMFxSV;
	let slider;
	let chart;
	let selection = [];
	const months = 'Jan.,Feb.,März,April,Mai,Juni,Juli,Aug.,Sep.,Okt.,Nov.,Dez.'.split(',')
	const baseColor = 'rgba(255,255,255,1)';

	const useTouchEvents = (() => {
		try { 
			document.createEvent("TouchEvent");
			return true;
		} catch (e) {
			return false;
		}
	})()

	initData(() => {
		chart = initChart();
		map = initMap();
		
		setDay(data.dayMax-data.dayMin)

		initAnimation();
	});

	function setDay(index) {
		if (index === dayIndex) return;
		dayIndex = index;
		map.redraw();
		chart.redraw();
	}

	function highlight(e) {
		if (!chart || !map || (selection[2] === e)) return;
		selection[2] = e;
		chart.redraw();
		map.redraw();
	}

	function select(e) {
		if (!chart || !map) return;
		if (selection[1] === e) e = false;
		selection[1] = e;
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
			l.radius = l.infected.map(v => Math.sqrt(v)/600);
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

		data.deutschland = {
			title: 'Deutschland',
			normalized: data.days.map(d => d.reduce((s,v) => s+v, 0)*100000/ewD),
		}
		selection = [data.deutschland];

		cb();
	}

	function initMap() {
		const maxValue = 300;
		let zoomX, zoomY, offsetX, offsetY, retina;
		let timeoutHandler;
		
		const gradient = [
			'#ffffb2',
			'#fecc5c',
			'#fd8d3c',
			'#f03b20',
			'#bd0026',
		];

		let container = new CanvasContainer('#mapContainer');
		let changeCheckerDraw   = new ChangeChecker();
		let changeCheckerLayout = new ChangeChecker();

		function relayout(opt) {
			retina = opt.retina;

			// zoomX = 1.03*opt.width/2;
			// zoomY = 0.75*opt.height/2;
			zoomX = 1.03*opt.width/2;
			zoomY = 0.75*opt.height/2;
			
			zoomX = zoomY = Math.min(zoomX, zoomY);
			
			offsetX = opt.width *0.5;
			offsetY = opt.height*0.48;
		}

		container.drawBg = function drawMapBg (ctx, opt) {
			if (!changeCheckerLayout(opt)) return;

			relayout(opt);

			ctx.clearRect(0,0,opt.width,opt.height);

			// draw deutschland
			ctx.fillStyle = '#7a7e8e';
			ctx.beginPath();
			data.borders0.forEach(poly => {
				poly.forEach((p,i) => {
					(i?ctx.lineTo:ctx.moveTo).call(ctx, zoomX*p[0]+offsetX, zoomY*p[1]+offsetY)
				})
			})
			ctx.fill();

			// draw bundeslaender
			ctx.strokeStyle = '#383b47';
			ctx.lineWidth = opt.retina*0.5;
			ctx.beginPath();
			data.borders1.forEach(poly => {
				poly.forEach((p,i) => {
					(i?ctx.lineTo:ctx.moveTo).call(ctx, zoomX*p[0]+offsetX, zoomY*p[1]+offsetY)
				})
			})
			ctx.stroke();

			drawLegend(ctx, opt)
		}

		container.drawFg = function drawMapFg (ctx, opt) {
			if (dayIndex === undefined) return;
			if (changeCheckerLayout(opt)) relayout(opt);

			if (!timeoutHandler && !changeCheckerDraw([opt, dayIndex, selection.map(f => f.index)])) return;
			if (timeoutHandler) {
				clearTimeout(timeoutHandler);
				timeoutHandler = false;
			}

			ctx.clearRect(0,0,opt.width,opt.height);


			let zoomR = zoomY;

			data.landkreise.forEach(f => {
				f.r = f.radius[dayIndex];
				f.m = f.r*f.r;
				f.xOld = f.x;
				f.yOld = f.y;
			})

			for (let i = 0; i < 10; i++) {
				let c = 0;

				// Anziehung zum Ursprung
				data.landkreise.forEach(f => {
					let dx = f.x0 - f.x;
					let dy = f.y0 - f.y;

					f.dx = dx/100;
					f.dy = dy/100;
					f.d  =  1/100;
				})

				data.pairs.forEach(p => {
					let f0 = p[0];
					let f1 = p[1];

					let dx = (f0.x - f1.x);
					let dy = (f0.y - f1.y);
					let d0 = Math.sqrt(dx*dx + dy*dy) + 1e-10;
					let d = d0 - f0.r - f1.r;

					if (d >= -1e-3) return;

					let factor = (d/d0)/(f0.m + f1.m + 1e-10);

					f0.dx -= f1.m * factor * dx;
					f0.dy -= f1.m * factor * dy;
					f0.d  += Math.abs(f1.m * factor);

					f1.dx += f0.m * factor * dx;
					f1.dy += f0.m * factor * dy;
					f1.d  += Math.abs(f0.m * factor);

					c++;
				})

				data.landkreise.forEach(f => {
					let d = f.d+1e-5;
					let m = Math.sqrt(f.dx*f.dx + f.dy*f.dy)*1000;
					if (d < m) d = m;
					f.x += 0.5*f.dx/d;
					f.y += 0.5*f.dy/d;
				})

				if (c <= 10) break;
			}

			let changeSum = 0;
			data.landkreise.forEach(f => {
				ctx.fillStyle = value2color(f.normalized[dayIndex]);

				changeSum += Math.sqrt(sqr(f.x-f.xOld) + sqr(f.y-f.yOld));

				f.px = zoomX*f.x + offsetX;
				f.py = zoomY*f.y + offsetY;
				f.pr = zoomR*f.r;
				
				ctx.beginPath();
				ctx.arc(f.px, f.py, f.pr, 0, 2*Math.PI);
				ctx.fill();
			})

			selection.forEach((f,index) => {
				if (!f || !index) return;
				if ((index === 2) && (selection[1] === f)) return

				let colorBg = (index === 1) ? '255,212,191' : '255,255,255';
				let colorFg = (index === 1) ? '100,51,26' : '100,100,100';

				// markiere entry
				ctx.strokeStyle = 'rgb('+colorFg+')';
				ctx.lineWidth = 2*opt.retina;
				ctx.beginPath();
				ctx.arc(f.px, f.py, f.pr+1*opt.retina, 0, 2*Math.PI);
				ctx.stroke();
				
				ctx.font = 12*opt.retina + 'px sans-serif';
				ctx.textAlign = 'left';

				let x = f.px;
				let y = f.py;
				
				let textLine1 = f.title;
				if (textLine1.length > 30) textLine1 = textLine1.slice(0,30)+'...';
				textLine1 += ': '+f.normalized[dayIndex].toFixed(1).replace('.',',');

				let textLine2 = f.type;
				let m1 = ctx.measureText(textLine1);
				let m2 = ctx.measureText(textLine2);
				let px = 6*opt.retina;
				let py = 6*opt.retina;
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
				ctx.fillStyle = 'rgb('+colorBg+')';
				ctx.fill();

				ctx.lineWidth = 1*opt.retina;
				ctx.strokeStyle = 'rgb('+colorFg+')';
				ctx.stroke();

				ctx.fillStyle = 'rgb('+colorFg+')';
				ctx.textBaseline = 'bottom';
				ctx.fillText(textLine1, x+px, y);

				ctx.fillStyle = 'rgba('+colorFg+',0.5)';
				ctx.textBaseline = 'top';
				ctx.fillText(textLine2, x+px, y);
			})

			if (changeSum > 0.02) timeoutHandler = setTimeout(container.redrawFg, 30);
		}

		if (useTouchEvents) {
			container.on('touchstart touchmove', e => {
				let l = findLandkreis(e);
				if (l) e.preventDefault();
				highlight(l)
			});
		} else {
			container.on('mousemove', e => {
				let f = findLandkreis(e);
				highlight(f);
				container.setCursor(f ? 'pointer' : 'default');
			})
			container.on('click', e => select(findLandkreis(e)))
			container.on('mouseout', e => highlight(false))
		}
		container.init();

		function findLandkreis(e) {
			let minD = 1e10, minF;
			if (e.touches) {
				e = e.touches[0];
				var rect = e.target.getBoundingClientRect();
				e.offsetX = e.clientX - rect.left;
				e.offsetY = e.clientY - rect.top;
			}
			let x = (e.offsetX || 0)*retina;
			let y = (e.offsetY || 0)*retina;
			data.landkreise.forEach(f => {
				let d = Math.sqrt(sqr(f.px - x) + sqr(f.py - y)) - f.pr;
				if (d < minD) {
					minD = d;
					minF = f;
				}
			})
			if (minD > 10*retina) return false;
			return minF;
		}

		function drawLegend(ctx, opt) {
			let width = 10*opt.retina;
			let paddingRight  = 25*opt.retina;
			let paddingBottom = 25*opt.retina;
			let step = 0.5*opt.retina;
			let x0 = opt.width - paddingRight - width;

			for (let y = 0; y <= maxValue*step; y++) {
				let y0 = opt.height-paddingBottom-y;

				ctx.strokeStyle = value2color(y/step);
				ctx.beginPath();
				lineH(x0,y0,x0+width);
				ctx.stroke();
			}

			ctx.textBaseline = 'middle';
			ctx.font = 10*opt.retina + 'px sans-serif';
			ctx.fillStyle = baseColor;
			ctx.textAlign = 'right';

			[0,35,50,100,200,300].forEach(v => {
				let y = opt.height - paddingBottom - v*step;

				ctx.beginPath();
				ctx.strokeStyle = baseColor;
				lineH(x0-3*opt.retina, y, x0);
				ctx.stroke();

				ctx.fillText(v, x0-6*opt.retina, y);
			})

			function lineH(x0,y0,x1) {
				ctx.moveTo(Math.round(x0), Math.round(y0))
				ctx.lineTo(Math.round(x1), Math.round(y0))
			}
		}

		function value2color(v) {
			if (v <  35) return gradient[0];
			if (v <  50) return gradient[1];
			if (v < 100) return gradient[2];
			if (v < 200) return gradient[3];
			return gradient[4];
		}

		return {
			redraw: container.redrawFg,
		}
	}

	function initChart() {
		const dayMin = data.dayMin, dayMax = data.dayMax;
		const maxValue = 300;
		let paddingTop, paddingLeft, paddingRight, paddingBottom;
		let projX, projY, x0, x1, y0, y1, retina;

		const container = new CanvasContainer('#chartContainer');
		const changeCheckerDraw   = new ChangeChecker();
		const changeCheckerLayout = new ChangeChecker();

		const colors = [
			[ 11,159,216].join(','),
			[255,130, 65].join(','),
			[255,255,255].join(','),
		]

		function relayout(opt) {
			retina = opt.retina;
			paddingTop = 60*opt.retina;
			paddingLeft = 40*opt.retina;
			paddingRight = 40*opt.retina;
			paddingBottom = 60*opt.retina;

			let w = opt.width - paddingLeft - paddingRight;
			let h = opt.height - paddingTop - paddingBottom;
			let aspectRatio = w/h;
			const minAspectRatio = 1;
			if (aspectRatio < minAspectRatio) {
				diff = Math.round((h-w/minAspectRatio)*0.3);
				paddingTop += diff;
				paddingBottom += diff;
			}

			projX = getProjection(
				0, dayMax-dayMin,
				Math.round(paddingLeft), Math.round(opt.width - paddingRight)
			);
			projY = getProjection(
				0, maxValue,
				opt.height - paddingBottom, paddingTop
			);

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



			// draw axes

			ctx.fillStyle = baseColor;
			ctx.strokeStyle = baseColor;
			ctx.font = 11*opt.retina + 'px sans-serif';

			ctx.beginPath();

			ctx.lineV(x0,y0,y1);
			ctx.lineH(x0,y0,x1);

			ctx.textBaseline = 'middle';
			ctx.textAlign = 'right';
			
			for (let v = 0; v <= maxValue; v += 10) {
				let y = projY.v2p(v);
				if (v % 100 === 0) {
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
				let x = projX.v2p(v-dayMin);
				
				if (monthStart) {
					ctx.lineV(x, y0, y0+6*opt.retina);
					if (dayMax - v < 10) continue;
					ctx.fillText(months[d.getMonth()], x+2*opt.retina, y0+2*opt.retina);
				}
			}

			ctx.stroke();
		}

		container.drawFg = function drawChartFg (ctx, opt) {
			if (dayIndex === undefined) return;
			if (changeCheckerLayout(opt)) relayout(opt);

			if (!changeCheckerDraw([opt, dayIndex, selection.map(f => f.index)])) return;

			ctx.clearRect(0,0,opt.width,opt.height);
			ctx.lineWidth = 1*opt.retina;
			ctx.font = 12*opt.retina + 'px sans-serif';


			// draw selection and hover
			let features = selection.slice(0);
			if (features[1] === features[2]) features[2] = false;

			features.forEach((f,index) => {
				if (!f) return;

				ctx.strokeStyle = 'rgb(' +colors[index]+')';
				ctx.fillStyle   = 'rgba('+colors[index]+',0.2)';

				ctx.beginPath();
				f.normalized.forEach((v,i) => (i ? ctx.lineTo : ctx.moveTo).call(ctx, projX.v2p(i), projY.v2p(v)));
				ctx.stroke();
				ctx.lineTo(x1, y0);
				ctx.lineTo(x0, y0);
				ctx.fill();
			})
			
			

			// draw legend

			ctx.textBaseline = 'top';
			ctx.textAlign = 'right';

			let y = Math.round(projY.v2p(20)) - 0*retina;

			features.forEach((f,index) => {
				if (!f) return;
				y -= 12*retina;
				ctx.fillStyle = 'rgb('+colors[index]+')';
				ctx.fillText(features[index].title, x1, y);
			})

			ctx.fillStyle = baseColor;
			ctx.strokeStyle = baseColor;



			// vertical time marker

			let x = projX.v2p(dayIndex);
			let s = 3*opt.retina;
			let ya = y0 + 12*opt.retina;
			let yb = ya +  6*opt.retina;
			let yc = yb + 16*opt.retina;
			let yt = yb +  7.5*opt.retina;
			let w = 18*opt.retina;
			let r =  3*opt.retina;

			ctx.setLineDash([2*opt.retina, 2*opt.retina]);
			ctx.strokeStyle = baseColor;
			ctx.beginPath();
			ctx.lineV(x, y1, y0);
			ctx.stroke();
			ctx.setLineDash([]);



			// handle

			ctx.fillStyle = '#fff';
			ctx.beginPath();
			ctx.moveTo(x, ya);
			ctx.arcTo(x+s, yb, x+w, yb, r);
			ctx.arcTo(x+w, yb, x+w, yc, r);
			ctx.arcTo(x+w, yc, x-w, yc, r);
			ctx.arcTo(x-w, yc, x-w, yb, r);
			ctx.arcTo(x-w, yb, x-s, yb, r);
			ctx.arcTo(x-s, yb, x  , ya, r);
			ctx.fill();

			let date = new Date((dayIndex+data.dayMin)*86400000);
			date = date.getDate()+'.'+(date.getMonth()+1)+'.';
			ctx.fillStyle = '#000';
			ctx.textBaseline = 'middle';
			ctx.textAlign = 'center';
			ctx.font = 12*opt.retina + 'px sans-serif';
			ctx.fillText(date, x, yt);
		}

		let drag = false
		if (useTouchEvents) {
			container.on('touchstart', e => { drag = true; handleEvent(e); e.preventDefault(); });
			document.addEventListener('touchmove', e => { if (drag) handleEvent(e); });
			container.on('touchend', e => drag = false);
			document.addEventListener('touchend', e => drag = false);
		} else {
			container.on('mousedown', e => { drag = true; handleEvent(e); });
			container.on('mousemove', e => {
				container.setCursor((Math.abs(projX.v2p(dayIndex)/retina - e.x) < 10) ? 'col-resize' : 'default');
			});
			document.addEventListener('mousemove', e => { if (drag) handleEvent(e) });
			container.on('mouseup', e => drag = false);
			document.addEventListener('mouseup',  e => drag = false);
		}

		function handleEvent(e) {
			if (e.touches) e = e.touches[0];
			let x = e.clientX || 0;
			let day = projX.p2v(x*retina);
			day = Math.max(0, Math.min(dayMax-dayMin, Math.floor(day)));
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
		let container = $('#finger');
		let finger1 = $('#finger1');
		let finger2 = $('#finger2');
		let stopped = false;

		let used = parseFloat(localStorage.getItem('animationrun')) || 0;
		if (used >= 2) return;

		if (useTouchEvents) {
			setTimeout(start,2000);
			$(document).one('touchstart', kill);
		} else {
			$(document).one('mousemove', () => start());
			$(document).one('mousedown', kill);
		}

		function start() {
			if (stopped) return;

			localStorage.setItem('animationrun', used+1);

			let xOffset = container.width()*0.4;
			let x0 = 40-xOffset;
			let x1 = $('#chartContainer').width()-40-xOffset;
			let y0 = '35vw';
			let y1 = '25vw';

			container.css({left:x0,top:y0,display:'block',opacity:0});
			finger2.hide();

			let animation = [
				() => container.animate({top:y1,opacity:1}, 500),
				() => finger2.fadeIn(200),
				() => container.animate({left:x1}, {duration:3000, step}),
				() => container.fadeOut(200),
			]
			run();
			
			function run() {
				let phase = animation.shift();
				if (stopped || !phase) return;
				$.when(phase()).then(run);
			}

			function step(now, tween) {
				if (stopped) return;
				let v = (tween.now-tween.start)/(tween.end-tween.start);
				setDay(Math.round(v*(data.dayMax-data.dayMin)));
			}
		}

		function kill() {
			stopped = true;
			container.css({display:'none'});
		}
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
			event.split(' ').forEach(eventName => canvasFg.get(0).addEventListener(eventName, cb))
		}

		return me;

		function init() {
			$(window).resize(updateLayout);
			window.matchMedia('(resolution: 1dppx)').addListener(updateLayout);
			window.matchMedia('(resolution: 2dppx)').addListener(updateLayout);
			updateLayout();
			setTimeout(updateLayout, 10);
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

	let time0 = Date.now();
	setInterval(() => {
		// auto reload page after 3 hours
		let duration = (Date.now() - time0)/1000;
		if (duration > 3*3600) location.reload();
	}, 60*1000);
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
