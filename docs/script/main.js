
$(function () {
	let dayIndex, animation, chart, map, slider, isLandscape, selection = [];
	let data = window.fvOZwtTDlpiMFxSV;
	const months = ',,März,,,Juni,,,Sep.,,,Dez.'.split(',')
	const baseColor = 'rgba(255,255,255,1)';
	const circleSize = 17e-4;

	const useTouchEvents = (() => {
		try { 
			document.createEvent("TouchEvent");
			return true;
		} catch (e) {
			return false;
		}
	})()
	$(window).resize(updateLayout);
	window.matchMedia('(resolution: 1dppx)').addListener(updateLayout);
	window.matchMedia('(resolution: 2dppx)').addListener(updateLayout);

	initData(() => {
		chart = initChart();
		map = initMap();
		
		setDay(data.dayMax-data.dayMin)

		initAnimation();

		setTimeout(updateLayout, 1);
	});

	function updateLayout() {
		isLandscape = window.innerWidth > window.innerHeight;
		$('body').toggleClass('landscape', isLandscape);
		if (chart) chart.updateLayout();
		if (map) map.updateLayout();
	}

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
			l.radius = l.infected.map(v => Math.sqrt(v)*circleSize);
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
		const maxMapValue = 400;
		let projX, projY, retina, zoom;
		let timeoutHandler;
		
		const gradient = [
			'#ffffb2',
			'#fecc5c',
			'#fd8d3c',
			'#f03b20',
			'#bd000d',
			'#660014',
			'#000000',
		];
		const gradientRGB = gradient.map(parseRGB);

		let container = new CanvasContainer('#mapContainer');
		let changeCheckerDraw   = new ChangeChecker();
		let changeCheckerLayout = new ChangeChecker();

		function relayout(opt) {
			retina = opt.retina;

			let bboxValue = [-0.9584, 0.9604, -1.3188, 1.2767];
			let bboxPixel = [0, opt.width, 0, opt.height];

			if (isLandscape) {
				bboxPixel[0] += 20*retina;
				bboxPixel[1] -= 10*retina;
				bboxPixel[2] += opt.height*0.02;
				bboxPixel[3] -= opt.height*0.02;
			} else {
				bboxPixel[3] -= 15*retina;
			}

			let zoomX = (bboxPixel[1] - bboxPixel[0])/(bboxValue[1] - bboxValue[0]);
			let zoomY = (bboxPixel[3] - bboxPixel[2])/(bboxValue[3] - bboxValue[2]);
			zoom = 0.998*Math.min(zoomX, zoomY);
			
			let offsetX = (bboxPixel[0]+bboxPixel[1])/2 - zoom*(bboxValue[0]+bboxValue[1])/2;
			let offsetY = (bboxPixel[2]+bboxPixel[3])/2 - zoom*(bboxValue[2]+bboxValue[3])/2;

			let xMin = bboxValue[0]*zoom + offsetX;
			let xMax = bboxValue[1]*zoom + offsetX;
			let yMin = bboxValue[2]*zoom + offsetY;
			let yMax = bboxValue[3]*zoom + offsetY;

			projX = getProjection(bboxValue[0], bboxValue[1], xMin, xMax);
			projY = getProjection(bboxValue[2], bboxValue[3], yMin, yMax);
		}

		container.drawBg = function drawMapBg (ctx, opt) {
			if (!changeCheckerLayout(opt)) return;

			relayout(opt);

			ctx.clearRect(0,0,opt.width,opt.height);

			// draw deutschland area
			ctx.fillStyle = 'rgba(219,226,255,0.5)';
			ctx.beginPath();
			data.borders0.forEach(poly => {
				poly.forEach((p,i) => {
					(i?ctx.lineTo:ctx.moveTo).call(ctx, projX.v2p(p[0]), projY.v2p(p[1]))
				})
			})
			ctx.fill();

			// draw bundeslaender borders
			ctx.strokeStyle = '#383b47';
			ctx.lineWidth = opt.retina*0.5;
			ctx.beginPath();
			data.borders1.forEach(poly => {
				poly.forEach((p,i) => {
					(i?ctx.lineTo:ctx.moveTo).call(ctx, projX.v2p(p[0]), projY.v2p(p[1]))
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

				f.px = projX.v2p(f.x);
				f.py = projY.v2p(f.y);
				f.pr = zoom*f.r;
				
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

				if (x < projX.v2p(0)) {
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
			let paddingBottom = (isLandscape ? 15 : 15)*opt.retina;

			let xMin = projX.v2p(0.70)+25*opt.retina;
			let xMax = opt.width - width;
			let yMin = projY.v2p(0.25);
			let yMax = opt.height-paddingBottom;
			let step = Math.floor(10*(yMax-yMin)/maxMapValue)/10;
			
			let xPos = (xMin + xMax)/2;
			let yPos = (yMin + yMax)/2 + step*maxMapValue/2;

			for (let y = 0; y <= maxMapValue*step; y++) {
				let y0 = yPos-y;

				ctx.strokeStyle = value2color(y/step);
				ctx.beginPath();
				lineH(xPos, y0, xPos+width);
				ctx.stroke();
			}

			ctx.textBaseline = 'middle';
			ctx.font = 10*opt.retina + 'px sans-serif';
			ctx.fillStyle = baseColor;
			ctx.textAlign = 'right';

			[0,50,100,200,300,400].forEach(v => {
				let y = yPos - v*step;

				ctx.beginPath();
				ctx.strokeStyle = baseColor;
				lineH(xPos-3*opt.retina, y, xPos);
				ctx.stroke();

				ctx.fillText(v, xPos-6*opt.retina, y);
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
			return linearInterpolation((v-200)/500, gradientRGB[4], gradientRGB[6]);
		}

		function linearInterpolation(a, c0, c1) {
			if (a < 0) a = 0;
			if (a > 1) a = 1;
			let c = [
				((c1[0]-c0[0])*a + c0[0]).toFixed(0),
				((c1[1]-c0[1])*a + c0[1]).toFixed(0),
				((c1[2]-c0[2])*a + c0[2]).toFixed(0),
			]
			return 'rgb('+c.join(',')+')';
		}

		function parseRGB(hex) {
			let color = [
				parseInt(hex.substr(1,2), 16),
				parseInt(hex.substr(3,2), 16),
				parseInt(hex.substr(5,2), 16),
			]
			return color;
		}

		return {
			redraw: container.redrawFg,
			updateLayout: container.updateLayout,
		}
	}

	function initChart() {
		const dayMin = data.dayMin, dayMax = data.dayMax;
		const maxValue = 400;
		let paddingTop, paddingLeft, paddingRight, paddingBottom;
		let projX, projY, xMin, xMax, yMin, yMax, retina;

		const container = new CanvasContainer('#chartContainer');
		const changeCheckerDraw   = new ChangeChecker();
		const changeCheckerLayout = new ChangeChecker();

		const colors = [
			[ 11,159,216].join(','),
			[255,130, 65].join(','),
			[255,255,255].join(','),
		]

		function getPadding() {
			return {
				top:    paddingTop   /retina,
				left:   paddingLeft  /retina,
				right:  paddingRight /retina,
				bottom: paddingBottom/retina,
			}
		}

		function relayout(opt) {
			retina = opt.retina;

			paddingTop    = (isLandscape ? 55 : 15)*opt.retina;
			paddingLeft   = (isLandscape ? 30 : 30)*opt.retina;
			paddingRight  = (isLandscape ? 19 : 19)*opt.retina;
			paddingBottom = (isLandscape ? 45 : 35)*opt.retina;

			xMin = Math.round(paddingLeft);
			xMax = Math.round(opt.width - paddingRight);
			yMin = paddingTop;
			yMax = opt.height - paddingBottom;

			if (isLandscape) {
				let w = xMax-xMin;
				let h = yMax-yMin;
				let ratio = 1;
				if (h > w*ratio) {
					let offset = h-w*ratio;
					yMin += offset/2;
					yMax -= offset/2;
				}
			}

			yMin = Math.round(yMin);
			yMax = Math.round(yMax);

			projX = getProjection(0, dayMax-dayMin, xMin, xMax);
			projY = getProjection(maxValue, 0, yMin, yMax);

			if (!slider) return;
			slider.setX(xMin/opt.retina, xMax/opt.retina);
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

			ctx.lineV(xMin,yMax,yMin);
			ctx.lineH(xMin,yMax,xMax);

			ctx.textBaseline = 'middle';
			ctx.textAlign = 'right';
			
			for (let v = 0; v <= maxValue; v += 20) {
				let y = projY.v2p(v);
				if (v % 100 === 0) {
					ctx.lineH(xMin, y, xMin - 4*opt.retina);
					ctx.fillText(v, xMin - 5*opt.retina, y + 0.5*opt.retina);
				} else {
					ctx.lineH(xMin, y, xMin - 2*opt.retina);
				}
			}

			ctx.textBaseline = 'top';
			ctx.textAlign = 'left';
			
			for (let v = dayMin; v <= dayMax; v++) {
				let d = (new Date((v+0.5)*86400000));
				
				if (d.getDate() === 1) {
					let x = projX.v2p(v-dayMin);
					ctx.lineV(x, yMax, yMax+6*opt.retina);
					if (dayMax - v < 10) continue;
					ctx.fillText(months[d.getMonth()], x+2*opt.retina, yMax+2*opt.retina);
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
			let fontSize = Math.round(Math.min(opt.width*0.7,opt.height, 600)*0.03);
			ctx.font = fontSize*opt.retina + 'px sans-serif';


			// draw selection and hover
			let features = selection.slice(0);
			if (features[1] === features[2]) features[2] = false;

			features = features.filter((f,index) => {
				if (!f) return false;

				ctx.strokeStyle = 'rgb(' +colors[index]+')';
				ctx.fillStyle   = 'rgba('+colors[index]+',0.2)';

				// draw line and area
				ctx.beginPath();
				f.normalized.forEach((v,i) => (i ? ctx.lineTo : ctx.moveTo).call(ctx, projX.v2p(i), projY.v2p(v)));
				ctx.stroke();
				ctx.lineTo(xMax, yMax);
				ctx.lineTo(xMin, yMax);
				ctx.fill();

				// draw dot
				let x = projX.v2p(dayIndex);
				let y = projY.v2p(f.normalized[dayIndex]);
				ctx.fillStyle   = 'rgb('+colors[index]+')';
				ctx.beginPath();
				ctx.arc(x,y,3*opt.retina,0,2*Math.PI);
				ctx.fill();

				return true;
			})

			// draw legend

			ctx.textBaseline = 'top';
			ctx.textAlign = 'left';

			let y = Math.round(projY.v2p(maxValue*0.7));

			features.forEach((f,index) => {
				let text = f.title;
				text += ': '+f.normalized[dayIndex].toFixed(1)+'';

				y += Math.round(fontSize*1.2)*retina;
				ctx.fillStyle = 'rgb('+colors[index]+')';
				ctx.fillText(text, (xMin*0.95+0.05*xMax), y);
			})

			ctx.fillStyle = baseColor;
			ctx.strokeStyle = baseColor;



			// vertical time marker

			let x = projX.v2p(dayIndex);
			let s = 3*opt.retina;
			let ya = yMax + 12*opt.retina;
			let yb = ya +  6*opt.retina;
			let yc = yb + 16*opt.retina;
			let yt = yb +  7.5*opt.retina;
			let w = 18*opt.retina;
			let r =  3*opt.retina;

			ctx.setLineDash([2*opt.retina, 2*opt.retina]);
			ctx.strokeStyle = baseColor;
			ctx.beginPath();
			ctx.lineV(x, yMin, yMax);
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

		return {
			redraw: container.redrawFg,
			updateLayout: container.updateLayout,
			getPadding,
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

			let padding = chart.getPadding();

			let xOffset = container.width()*0.4;
			let x0 = padding.left-xOffset;
			let x1 = $('#chartContainer').width()-padding.right-xOffset;
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
			redrawBg,
			redrawFg,
			on,
			setCursor,
			updateLayout,
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

		function redrawBg() { me.drawBg(ctxBg, {width,height,retina,random,isLandscape}); }
		function redrawFg() { me.drawFg(ctxFg, {width,height,retina,random,isLandscape}); }

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


	function getProjection(v0,v1,p0,p1) {
		let s, offsetP, offsetV;
		init();
		return {v2p,p2v};

		function v2p(v) {
			return v*s + offsetP;
		}

		function p2v(p) {
			return p/s + offsetV;
		}

		function init() {
			s = (p1-p0)/(v1-v0);
			offsetP = -v0*s+p0
			offsetV = -p0/s+v0
		}
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
