

$(function () {
	let day, mapDirty, chartDirty, animation, map;
	let highlight = [];
	let data = window.fvOZwtTDlpiMFxSV;
	let slider, sliderLabel;
	let chart;
	const months = 'Jan.,Feb.,März,April,Mai,Juni,Juli,Aug.,Sep.,Okt.,Nov.,Dez.'.split(',')

	map = initMap();
	initData(() => {
		initSlider();

		chart = initChart();

		mapDirty = true;
		setInterval(() => {
			chart.update();
			map.redraw();
		}, 20);

		animation = initAnimation();
		$('#button_play').click(animation.play);
		setTimeout(animation.play, 1000);
	});

	function initData(cb) {
		let days = [];
		for (let i = 0; i <= data.dayMax-data.dayMin; i++) days[i] = i;

		
		data.landkreise.forEach(l => {
			l.blurred = days.map(d => data.days[d][l.index]);
			l.normalized = l.blurred.map(v => 100000*v/l.ew);

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
		});

		cb();
	}

	function initMap() {
		const maxValue = 150;

		const gradient = [
			[150, 60, 40,1],
			//[209, 38, 55,1],
			[ 60, 80, 70,1],
			[ 30,100, 80,1],
			[  0,100,100,1],
		].map(hsv2rgb);

		let retina, width, height;

		let container = $('#mapContainer');
		let canvas = $('#mapCanvas');
		let ctx = canvas.get(0).getContext('2d');
		
		$(window).resize(updateLayout);
		updateLayout()
		initLegend();

		function updateLayout() {
			retina = window.devicePixelRatio;
			width  = retina*container.innerWidth();
			height = retina*container.innerHeight();
			canvas
				.attr({width:width, height:height})
				.css({width:width/retina,height:height/retina});
			redraw();
		}

		function redraw() {
			if (!mapDirty) return;
			mapDirty = false;

			ctx.clearRect(0,0,width,height);

			day = Math.round(slider.val());
			sliderLabel.text((new Date(day*86400000)).toLocaleDateString());
			day -= data.dayMin;

			let zoom = width/2;
			let offsetX = width/2;
			let offsetY = height/2;

			data.landkreise.forEach(f => {
				ctx.fillStyle = value2color(f.normalized[day])
				
				ctx.beginPath();
				ctx.arc(
					zoom*f.x + offsetX,
					zoom*f.y + offsetY,
					zoom*Math.sqrt(f.blurred[day])*0.001,
					0,
					2*Math.PI
				);
				ctx.fill();
			})
		}

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
			v = Math.max(0, Math.min(1, v/maxValue));

			v *= gradient.length-1;

			//debugger;

			let i = Math.min(Math.floor(v), gradient.length-2);
			let c0 = gradient[i];
			let c1 = gradient[i+1];
			let a = v-i;

			let c = 'rgba('+
				Math.round(c0[0]*(1-a) + a*c1[0])+','+
				Math.round(c0[1]*(1-a) + a*c1[1])+','+
				Math.round(c0[2]*(1-a) + a*c1[2])+','+
				Math.round((c0[3]*(1-a) + a*c1[3])*100)/100+
			')';

			//console.log(v,c);
			return c;
		}

		return {
			redraw
		}
	}

	function initChart() {
		const baseColor = '#fff';
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

		return {
			update: highlightCurves,
		}

		function drawChart1() {
			ctx1.clearRect(0,0,width,height);

			ctx1.fillStyle = baseColor;
			ctx1.strokeStyle = baseColor;
			ctx1.textBaseline = 'top';
			ctx1.font = 10*retina + 'px sans-serif';

			let x0 = v2x(dayMin);
			let x1 = v2x(dayMax);
			let y0 = v2y(0);
			let y1 = v2y(maxValue);

			// draw chart

			let histo = [];
			for (let x = 0; x < (width-paddingLeft)*retina; x++) {
				let d = x2v(x/retina + paddingLeft) - dayMin;
				let d0 = Math.floor(d);
				if (d0 < 0) d0 = 0;
				if (d0 > dayMax-1) d0 = dayMax-1;
				let a = Math.min(1,Math.max(0,d-d0));
				let h0 = data.histo[d0];
				let h1 = data.histo[d0+1];
				let p = [0];
				for (let i = 0; i < 15; i++) p[i+1] = h0[i]*(1-a) + a*h1[i];
				histo[x] = p;
			}

			let img = ctx1.getImageData(
				retina*paddingLeft,
				0,
				retina*(width-paddingLeft),
				retina*(height-paddingBottom)
			)

			for (let x = 0; x < img.width; x++) {
				h = histo[x];
				let i = 15;
				for (let y = 0; y < img.height; y++) {
					let v = y2v(y/retina);
					while (h[i] > v) i--;
					let color;
					if (i === 15) {
						color = 255
					} else {
						let v0 = h[i];
						let v1 = h[i+1];
						let c0 = i/15;
						let c1 = (i+1)/15;
						//color = (c0+c1)/2;
						color = ((v-v0)/(v1-v0)*(c1-c0)+c0);
					}
					let index = (y*img.width+x)*4;
					img.data[index+0] = 255;
					img.data[index+1] = 255;
					img.data[index+2] = 255;
					img.data[index+3] = 170*(1-color);
				}
			}

			ctx1.putImageData(img,x0*retina,y1*retina);

			// draw axes
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

		function highlightCurves() {
			if (!chartDirty) return;
			chartDirty = false;

			let entries = highlight;
			ctx2.clearRect(0,0,width*retina,height*retina);
			ctx2.lineWidth = 1*retina;

			if (entries) {
				ctx2.strokeStyle = 'rgba(251,184,0,1.0)';
				ctx2.fillStyle = 'rgba(251,184,0,0.2)';
				entries.forEach(e => {
					ctx2.beginPath();
					let path = e.normalized.map((v,i) => [v2x(i+dayMin),v2y(v)]);
					line(ctx2, path, v2y(0));
					ctx2.lineTo(v2x(dayMax)*retina, v2y(0)*retina);
					ctx2.lineTo(v2x(dayMin)*retina, v2y(0)*retina);
					ctx2.fill();
					ctx2.stroke();
				});
			}

			ctx2.strokeStyle = baseColor;
			ctx2.beginPath();
			ctx2.moveTo(v2x(day+data.dayMin)*retina, retina*v2y(maxValue));
			ctx2.lineTo(v2x(day+data.dayMin)*retina, retina*v2y(0));
			ctx2.stroke();
		}

		function v2y(v) {
			return (1-v/maxValue)*(height-paddingBottom)
		}

		function v2x(v) {
			return (v-dayMin)/(dayMax-dayMin)*(width-paddingLeft)+paddingLeft
		}

		function y2v(y) {
			return (1-y/(height-paddingBottom))*maxValue;
		}

		function x2v(x) {
			return (x-paddingLeft)/(width-paddingLeft)*(dayMax-dayMin)+dayMin;
		}

		function updateCanvasLayout() {
			retina = window.devicePixelRatio;
			width  = container.innerWidth();
			height = container.innerHeight();
			canvas1.attr({width:width*retina, height:height*retina}).css({width,height});
			canvas2.attr({width:width*retina, height:height*retina}).css({width,height});
			drawChart1();
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

		function curve(ctx, path, zero) {
			let p0, p1;
			path.forEach((p2, i) => {
				if (i === 0) {
					ctx.moveTo(p2[0]*retina, p2[1]*retina);
					p1 = p2;
				} else {
					let b = (p2[1]-p0[1])/(p2[0]-p0[0])*(p2[0]-p1[0])+p1[1];
					if (b > zero) b = zero;
					ctx.quadraticCurveTo(p2[0]*retina, b*retina, p2[0]*retina, p2[1]*retina);
				}
				p0 = p1;
				p1 = p2;
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
				mapDirty = true;
				chartDirty = true;
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
			mapDirty = true;
			chartDirty = true;
		})
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
})