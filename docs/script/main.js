

$(function () {
	let blurWindow = 7;

	let day, markerDirty, animation, map;
	let data = window.fvOZwtTDlpiMFxSV;
	let slider, sliderLabel;
	let chart;
	const months = 'Jan.,Feb.,März,April,Mai,Juni,Juli,Aug.,Sep.,Okt.,Nov.,Dez.'.split(',')

	initMap();
	initData(() => {
		initSlider();

		markerDirty = true;
		setInterval(updateMarkerColors, 20);

		animation = initAnimation();
		$('#button_play').click(animation.play);
		setTimeout(animation.play, 1000);

		chart = initChart();
	});

	initLegend();

	function initData(cb) {
		let days = [];
		let colorStart = value2color(0);
		for (let i = 0; i <= data.dayMax-data.dayMin; i++) days[i] = i;

		data.landkreise.forEach(l => {
			let index = l.index;
			l.fall = days.map(d => data.days[d][index]);
			l.blurred = l.fall.map((v,i) => {
				for (let j = Math.max(0,i-blurWindow); j < i; j++) v += l.fall[j];
				return v;
			})
			l.normalized = l.blurred.map(v => 100000*v/l.ew);

			l.marker = L.circleMarker([l.y, l.x], {
				radius:l.r,
				stroke:true,
				weight:0.1,
				color:'#000000',
				opacity:1,
				fillOpacity:1,
				fillColor:colorStart,
			});
			l.marker.bindTooltip(l.title+'<br><small>'+l.type+'</small>');
			l.marker.on('tooltipopen',  () => chart.highlight([l]));
			l.marker.on('tooltipclose', () => chart.highlight());
			map.addLayer(l.marker);
		});

		cb();
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

		return {
			highlight: highlightCurves,
		}

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

			ctx1.fillStyle = 'rgba(127,127,127,0.005)';
			data.landkreise.forEach(e => {
				ctx1.beginPath();
				let path = e.normalized.map((v,i) => [v2x(i+dayMin),v2y(v)]);
				line(ctx1, path);
				ctx1.lineTo(v2x(dayMax)*retina, v2y(0)*retina);
				ctx1.lineTo(v2x(dayMin)*retina, v2y(0)*retina);
				ctx1.fill();
			});
		}

		function highlightCurves(entries) {
			ctx2.clearRect(0,0,width*retina,height*retina);
			
			if (!entries) return;

			ctx2.strokeStyle = 'rgba(170,0,0,0.8)';
			ctx2.fillStyle = 'rgba(170,0,0,0.2)';
			ctx2.lineWidth = 1*retina;
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

		data.landkreise.forEach(f => {
			let color = value2color(f.normalized[day])

			f.marker.setStyle({
				fillColor:color
			})
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