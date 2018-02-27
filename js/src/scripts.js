/*
	-Load in xml feed of all episodes into a list/table.
	-Total all episode lengths.
	-Checkbox to indicate if it's been listened to.
	-Total all checked episodes.
	-Save list of checked in localstorage? so it's persistent.
	-fixed header and footer.
	-update moment to display total hours and not cut into days.
	update to take a feed url in
		scope localstorage per url
	add click toggle to view descirptions
	sorting columns
	complex sorting
	calculate percentage listened (in episodes and time)
	add a queue - to listen to list
*/

var app = new Vue({
	el: '#app',
	data: {
		listened: [],
		feedurl: 'https://mormonstories.libsyn.com/rss/',
		response: '',
		xml: null,
		feeddata: null,
		episodes: null,
		sortKey: 'id',
		reverse: false,
		total: {
			time: '0',
			seconds: 0,
			listened: 0,
			listened_time: '0',
			episodes: 0,
			episodes_listened: 0,
		},
	},

	created: function(){
		this.load();
	},

	methods: {

		load: function(){
			this.loadLS();
			this.loadfeed();
		},

		loadLS: function(){
			if ( localStorage.getItem('listened') ) {
				this.listened = JSON.parse( localStorage.getItem('listened') );
			} else {
				this.listened = Array(900).fill(0);
			}
			// localStorage.setItem('listened', JSON.stringify(this.listened));
			// this.listened = Array(900).fill(0);
		},

		sortBy: function(sortKey){
			this.reverse = (this.sortKey === sortKey) ? !this.reverse : false;
			this.sortKey = sortKey;
		},

		loadfeed: function(){
			this.response = 'Loading...';
			var app = this;

			axios.get( this.feedurl )
			.then( function(response) {
				app.response = response.data;
				app.convertfeed( response.data );
			})
			.catch( function(error){
				app.response = 'error '+error;
			});
		},

		convertfeed: function(xmlString){
			console.log('start');
			var parser = new DOMParser();
			this.xml = parser.parseFromString(xmlString, "text/xml");
			this.feeddata = this.xmlToJson(this.xml);
			this.episodes = this.processEpisodes( this.feeddata.rss.channel.item.slice().reverse() );
			console.log('done');
		},

		//process episodes
		processEpisodes: function(episodes){
			for (var i = 0; i < episodes.length; i++){
				episodes[i].id = i + 1;
				episodes[i].seconds = 0;
				episodes[i].listened = 0;
				if ( episodes[i].itunesduration ) {
					episodes[i].seconds = this.calculateSeconds( episodes[i].itunesduration.text );
					this.total.seconds += parseInt( episodes[i].seconds );
				} else {
					episodes[i].itunesduration = { text: 0 };
				}
				
				if ( this.listened[episodes[i].id] == 1 ) {
					episodes[i].listened = 1;
					this.incrementSeconds(true, episodes[i].seconds, episodes[i].id);
				}

				// Fri, 19 Oct 2007 17:54:14 +0000
				episodes[i].relative = moment( episodes[i].pubdate.text, "ddd, DD MMM YYYY HH:mm:ss Z").fromNow();
				episodes[i].date = moment( episodes[i].pubdate.text, "ddd, DD MMM YYYY HH:mm:ss Z").format('YYYY.MM.DD');;
			}
			this.total.time = this.calculateTime( this.total.seconds );
			this.total.episodes = episodes.length;

			return episodes;
		},

		calculateTime: function(seconds){
			// return moment().startOf('year')
			// 	.seconds(seconds)
			// 	.format('DDD H:mm:ss');
			var time = this.calculateHours(seconds) + ':';
			time += moment().startOf('year')
				.seconds(seconds)
				.format('mm:ss');
			return time;
		},

		calculateHours: function(seconds){
			return Math.floor( 
				moment.duration({
					seconds: seconds
				}).asHours()
			);
		},

		incrementSeconds: function(sign, seconds, id) {
			if ( !sign ) {
				seconds *= -1;
				this.listened[id] = 0;
				localStorage.setItem('listened', JSON.stringify(this.listened));
				this.total.episodes_listened--;
			} else {
				this.listened[id] = 1;
				localStorage.setItem('listened', JSON.stringify(this.listened));
				this.total.episodes_listened++;
			}
			this.total.listened += parseInt( seconds );
			this.total.listened_time = this.calculateTime( this.total.listened );
		},

		calculateTotal: function(){
			this.total.listened = 0;
			for (var i = 0; i < this.episodes.length; i++){
				if ( this.episodes[i].listened ) {
					this.total.listened += parseInt( this.episodes[i].seconds );
				}
			}
			this.total.listened_time = this.calculateTime( this.total.listened );
		},

		calculateSeconds: function(duration){
			var seconds = 0;
			var place = 1;
			if ( duration.indexOf(':') >= 0 ) {
				var times = duration.split(':');
				while (times.length > 0) {
					seconds += place * parseInt(times.pop(), 10);
					place *= 60;
				}
			} else {
				seconds = duration;
			}
			return seconds;
		},

		// Changes XML to JSON
		xmlToJson: function(xml) {
			// Create the return object
			var obj = {};

			if ( xml.nodeType == 1 ) { // element
				// do attributes
				if (xml.attributes.length > 0) {
				obj["@attributes"] = {};
					for (var j = 0; j < xml.attributes.length; j++) {
						var attribute = xml.attributes.item(j);
						obj["@attributes"][attribute.nodeName] = attribute.nodeValue;
					}
				}
			} else if (xml.nodeType == 3) { // text
				obj = xml.nodeValue;
			}
			// do children
			if ( xml.hasChildNodes() ) {
				for(var i = 0; i < xml.childNodes.length; i++) {
					var item = xml.childNodes.item(i);
					var nodeName = this.tidyName(item.nodeName);
					if (typeof(obj[nodeName]) == "undefined") {
						obj[nodeName] = this.xmlToJson(item);
					} else {
						if (typeof(obj[nodeName].push) == "undefined") {
							var old = obj[nodeName];
							obj[nodeName] = [];
							obj[nodeName].push(old);
						}
						obj[nodeName].push( this.xmlToJson(item));
					}
				}
			}
			return obj;
		},

		tidyName: function(str){
			str = str.replace(/^\s+|\s+$/g, ''); // trim
			str = str.toLowerCase();
		
			// remove accents, swap ñ for n, etc
			var from = "àáäâèéëêìíïîòóöôùúüûñç·/_,:;#@-";
			var to   = "aaaaeeeeiiiioooouuuunc_________";
			for (var i=0, l=from.length ; i<l ; i++) {
				str = str.replace(new RegExp(from.charAt(i), 'g'), to.charAt(i));
			}

			str = str.replace(/[^a-z0-9 -]/g, '') // remove invalid chars
				.replace(/\s+/g, '-') // collapse whitespace and replace by -
				.replace(/-+/g, '-'); // collapse dashes

			return str;
		}

	},

	watch: {
		
	},

	filters: {

	},

	computed: {
		
	},

	mounted(){
		
	}

});