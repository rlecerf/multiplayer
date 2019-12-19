(function ($, undefined) {
	"use strict";

	var event_map = {
		ready: null,
		play: null,
		pause: null,
		finish: null,
		buffering: null,
		timeupdate: null,
		durationchange: null,
		volumechange: null,
		error: "onError"
	};

	var next_id = 1;

	$.embedplayer.register({
		origin: 'https://www.youtube.com',
		matches: function () {
			return $.nodeName(this,"iframe") && /^https?:\/\/(www\.)?youtube(-nocookie)?\.com\/embed\/[-_a-z0-9]+.*[\?&]enablejsapi=1/i.test(this.src);
		},
		init: function (data,callback) {
			var self = this;
			data.detail.player_id = next_id ++;
			callback('youtube_'+data.detail.player_id);
			data.detail.origin = /^https?:\/\/(www\.)?youtube-nocookie\.com\//i.test(this.src) ? 'https://www.youtube-nocookie.com' : 'https://www.youtube.com';
			data.detail.duration = NaN;
			data.detail.currenttime = NaN;
			data.detail.volume = NaN;
			data.detail.commands = [];
			data.detail.video_id = /^https?:\/\/(?:www\.)?youtube(?:-nocookie)?\.com\/embed\/([-_a-z0-9]+)/i.exec(this.src)[1];
			data.detail.timer = setInterval(function () {
				if (!$.contains(self.ownerDocument.body, self)) {
					clearInterval(data.detail.timer);
					data.detail.timer = null;
					return;
				}
				else if (self.contentWindow) {
					self.contentWindow.postMessage(JSON.stringify({event:'listening',id:data.detail.player_id}),data.detail.origin);
				}
			}, 500);
		},
		play: function (data) {
			send(this,data,"playVideo");
		},
		play: function (data) {
			send(this,data,"playVideo");
		},
		pause: function (data) {
			send(this,data,"pauseVideo");
		},
		stop: function (data) {
			send(this,data,"stopVideo");
		},
		next: function (data) {
			send(this,data,"nextVideo");
		},
		prev: function (data) {
			send(this,data,"previousVideo");
		},
		volume: function (data, callback) {
			callback(data.detail.volume);
		},
		
		duration: function (data, callback) {
			callback(data.detail.duration);
		},
		currenttime: function (data, callback) {
			callback(data.detail.currenttime);
		},
		setVolume: function (data,volume) {
			send(this,data,'setVolume',volume*100);
		},
		seek: function (data,position) {
			send(this,data,'seekTo',position);
		},
		listen: function (data,events) {
			var done = {};
			for (var i = 0; i < events.length; ++ i) {
				var event = event_map[events[i]];
				if (event && done[event] !== true) {
					done[event] = true;
					send(this,data,'addEventListener',event);
				}
			}
		},
		link: function (data) {
			return 'https://www.youtube.com/watch?v='+data.detail.video_id;
		},
		parseMessage: function (event) {
			var message = {
				data: JSON.parse(event.data)
			};
			message.player_id = 'youtube_'+message.data.id;
			return message;
		},
		processMessage: function (data,message,trigger) {
			if (message.data.event === "infoDelivery") {
				var info = message.data.info;
				if (info) {
					if ('volume' in info) {
						var volume;
						if (info.muted) {
							volume = 0.0;
						}
						else {
							volume = info.volume / 100;
						}
						if (data.detail.volume !== volume) {
							data.detail.volume = volume;
							trigger("volumechange",{volume:volume});
						}
					}

					if ('playerState' in info) {
						switch (info.playerState) {
						case -1: // unstarted
							break;

						case  0: // ended
							trigger("finish");
							break;

						case  1: // playing
							trigger("play");
							break;

						case  2: // paused
							trigger("pause");
							break;

						case  3: // buffering
							trigger("buffering");
							break;

						case  5: // cued
							trigger("pause");
							break;
						}
					}

					if ('duration' in info) {
						if (info.duration !== data.detail.duration) {
							data.detail.duration = info.duration;
							trigger("durationchange",{duration:info.duration});
						}
					}

					if ('currentTime' in info) {
						if (info.currentTime !== data.detail.currenttime) {
							data.detail.currenttime = info.currentTime;
							trigger("timeupdate",{currentTime:info.currentTime});
						}
					}

					if ('videoData' in info) {
						data.detail.videoData = info.videoData;
					}
					
					if ('availableQualityLevels' in info) {
						data.detail.availableQualityLevels = info.availableQualityLevels;
					}
				}
			}
			else if (message.data.event === "initialDelivery") {
				if (data.detail.timer !== null) {
					clearInterval(data.detail.timer);
					data.detail.timer = null;
				}
			}
			else if (message.data.event === "onReady") {
				trigger("ready");
				var win = this.contentWindow;
				if (win && data.detail.commands) {
					for (var i = 0; i < data.detail.commands.length; ++ i) {
						win.postMessage(JSON.stringify(data.detail.commands[i]),data.detail.origin);
					}
					data.detail.commands = null;
				}
			}
			else if (message.data.event === "onError") {
				var error;
				switch (message.data.info) {
				case 2: // The request contains an invalid parameter value.
					error = "illegal_parameter";
					break;

				case 100: // The video requested was not found.
					error = "not_found";
					break;

				case 101: // The owner of the requested video does not allow it to be played in embedded players.
				case 150: // This error is the same as 101. It's just a 101 error in disguise!
					error = "forbidden";
					break;

				default:
					error = "error";
				}
				trigger("error",{error:error});
			}
		}
	});

	function send (element,data,func) {
		var command = {
			id: data.detail.player_id,
			event: "command",
			func: func,
			args: Array.prototype.slice.call(arguments,3)
		};

		if (data.state === "init") {
			data.detail.commands.push(command);
		}
		else {
			var win = element.contentWindow;
			if (win) {
				win.postMessage(JSON.stringify(command),data.detail.origin);
			}
		}
	}
})(jQuery);
(function ($, undefined) {
	"use strict";

	$.embedplayer.register({
		origin: ['https://www.dailymotion.com',"http://www.dailymotion.com"],
		matches: function () {
			return $.nodeName(this,"iframe") && /^https?:\/\/(?:www\.)?dailymotion\.com\/embed\/video\/[-_a-z0-9]+[\?&]api=postMessage/i.test(this.src);
		},
		init: function (data,callback) {
			var match = /^https?:\/\/(?:www\.)?dailymotion\.com\/embed\/video\/([-_a-z0-9]+)\?([^#]*)/i.exec(this.src);
			var video_id = match[1];
			var params = $.embedplayer.parseParams(match[2]);

			callback(params.id);
			data.detail.volume = NaN;
			data.detail.currenttime = NaN;
			data.detail.duration = NaN;
			data.detail.commands = [];
			data.detail.origin = $.embedplayer.origin(this.src);
			data.detail.video_id = video_id;
			data.detail.callbacks = {};
		},
		play: function (data) {
			send(this,data,"play");
		},
		pause: function (data) {
			send(this,data,"pause");
		},
		stop: function (data) {
			send(this,data,"pause");
		},
		volume: function (data,callback) {
			callback(data.detail.volume);
		},
		duration: function (data,callback) {
			callback(data.detail.duration);
		},
		currenttime: function (data,callback) {
			callback(data.detail.currenttime);
		},
		setVolume: function (data,volume) {
			send(this,data,'volume',volume);
		},
		seek: function (data,position) {
			send(this,data,'seek',position);
		},
		link: function (data) {
			return 'https://www.dailymotion.com/video/'+data.detail.video_id;
		},
		parseMessage: function (event) {
			var message = {
				data: $.embedplayer.parseParams(event.data.replace(/\+/g,' '))
			};
			message.player_id = message.data.id;
			return message;
		},
		processMessage: function (data,message,trigger) {
			switch (message.data.event) {
			case "timeupdate":
				var currenttime = parseFloat(message.data.time);
				if (currenttime !== data.detail.currenttime) {
					data.detail.currenttime = currenttime;
					trigger('timeupdate',{currentTime:currenttime});
				}
				break;

			case "volumechange":
				var volume;
				if (message.data.muted === "true") {
					volume = 0;
				}
				else {
					volume = parseFloat(message.data.volume);
					// workaround for buggy API
					if (volume > 1) {
						volume /= 100;
					}
				}
				if (volume !== data.detail.volume) {
					data.detail.volume = volume;
					trigger("volumechange",{volume:volume});
				}
				break;

			case "durationchange":
				var duration = parseFloat(message.data.duration);
				if (duration !== data.detail.duration) {
					data.detail.duration = duration;
					trigger("durationchange",{duration:duration});
				}
				break;

			case "play":
				trigger("play");
				break;

			case "pause":
				trigger("pause");
				break;
				
			case "ended":
				trigger("finish");
				break;
				
			case "error":
				var statusCode = parseInt(message.data.statusCode,10);
				var error = "error";

				if (statusCode >= 100 && statusCode < 200) {
					error = "informational";
				}
				else if (statusCode >= 200 && statusCode < 300) {
					error = "successful";
				}
				else if (statusCode >= 300 && statusCode < 400) {
					if (statusCode === 302) {
						error = "found";
					}
					else if (statusCode === 304) {
						error = "not_modified";
					}
					else {
						error = "redirection";
					}
				}
				else if (statusCode >= 400 && statusCode < 500) {
					if (statusCode === 403) {
						error = "forbidden";
					}
					else if (statusCode === 404) {
						error = "not_found";
					}
					else {
						error = "client_error";
					}
				}
				else if (statusCode >= 500 && statusCode < 600) {
					if (statusCode === 500) {
						error = "internal_server_error";
					}
					else if (statusCode === 500) {
						error = "not_implemented";
					}
					else {
						error = "server_error";
					}
				}

				trigger("error",{
					error:error,
					statusCode:message.data.statusCode,
					title:message.data.title,
					message:message.data.message});
				break;

			case "apiready":
				trigger("ready");
				var win = this.contentWindow;
				if (win && data.detail.commands) {
					for (var i = 0; i < data.detail.commands.length; ++ i) {
						win.postMessage(data.detail.commands[i],data.detail.origin);
					}
					data.detail.commands = null;
				}
				break;

			default:
				break;
			}
		}
	});

	function send (element,data,method,value) {
		var command = method;

		if (arguments.length > 3) {
			command += '=' + value;
		}

		if (data.state === "init") {
			data.detail.commands.push(command);
		}
		else {
			var win = element.contentWindow;
			if (win) {
				win.postMessage(command,data.detail.origin);
			}
		}
	}
})(jQuery);
(function ($, undefined) {
	"use strict";

	var event_map = {
		ready: null,
		play: 'play',
		pause: 'pause',
		finish: 'finish',
		buffering: null,
		timeupdate: 'playProgress',
		durationchange: 'loadProgress',
		volumechange: null,
		error: null
	};

	$.embedplayer.register({
		origin: ['https://player.vimeo.com',"http://player.vimeo.com"],
		matches: function () {
			return $.nodeName(this,"iframe") && /^https?:\/\/player\.vimeo\.com\/video\/\d+.*[\?&]api=1/i.test(this.src);
		},
		init: function (data,callback) {
			var match = /^https?:\/\/player\.vimeo\.com\/video\/(\d+)[^\?#]*(?:\?(.*))/i.exec(this.src);
			var video_id = match[1];
			var params = $.embedplayer.parseParams(match[2]);

			callback(params.player_id);
			data.detail.duration = NaN;
			data.detail.currenttime = NaN;
			data.detail.commands = [];
			data.detail.origin = $.embedplayer.origin(this.src);
			data.detail.video_id = video_id;
			data.detail.callbacks = {};
		},
		play: function (data) {
			send(this,data,"play");
		},
		pause: function (data) {
			send(this,data,"pause");
		},
		stop: function (data) {
			send(this,data,"unload");
		},
		volume: function (data,callback) {
			if (data.detail.callbacks.getVolume) {
				data.detail.callbacks.getVolume.push(callback);
			}
			else {
				data.detail.callbacks.getVolume = [callback];
			}
			send(this,data,"getVolume");
		},
		duration: function (data,callback) {
			callback(data.detail.duration);
		},
		currenttime: function (data,callback) {
			callback(data.detail.currenttime);
		},
		setVolume: function (data,volume) {
			send(this,data,'setVolume',volume);
		},
		seek: function (data,position) {
			send(this,data,'seekTo',position);
		},
		listen: function (data,events) {
			var done = {};
			for (var i = 0; i < events.length; ++ i) {
				var event = event_map[events[i]];
				if (event && done[event] !== true) {
					done[event] = true;
					send(this,data,'addEventListener',event);
				}
			}
		},
		link: function (data) {
			return 'https://vimeo.com/'+data.detail.video_id;
		},
		parseMessage: function (event) {
			var message = {
				data: JSON.parse(event.data)
			};
			message.player_id = message.data.player_id;
			return message;
		},
		processMessage: function (data,message,trigger) {
			if (message.data.event === "ready") {
				trigger("ready");
				// get the initial volume value
				send(this,data,"getVolume");
				var win = this.contentWindow;
				if (win && data.detail.commands) {
					for (var i = 0; i < data.detail.commands.length; ++ i) {
						win.postMessage(JSON.stringify(data.detail.commands[i]),data.detail.origin);
					}
					data.detail.commands = null;
				}
			}
			else if (message.data.event === "playProgress") {
				if ('seconds' in message.data.data) {
					var currenttime = message.data.data.seconds;
					if (currenttime !== data.detail.currenttime) {
						data.detail.currenttime = currenttime;
						trigger('timeupdate',{currentTime:currenttime});
					}
				}
			}
			else if (message.data.event === "loadProgress") {
				if ('duration' in message.data.data) {
					var duration = message.data.data.duration;
					if (duration !== data.detail.duration) {
						data.detail.duration = duration;
						trigger("durationchange",{duration:duration});
					}
				}
			}
			else if (message.data.event === "play") {
				trigger("play");
			}
			else if (message.data.event === "pause") {
				trigger("pause");
			}
			else if (message.data.event === "finish") {
				trigger("finish");
			}
			else if (message.data.method) {
				var callbacks = data.detail.callbacks[message.data.method];
				if (callbacks) {
					for (var i = 0; i < callbacks.length; ++ i) {
						callbacks[i].call(this,message.data.value);
					}
					data.detail.callbacks[message.data.method] = null;
				}
				if (message.data.method === "getVolume") {
					trigger("volumechange",{volume:message.data.value});
				}
			}
		}
	});

	function send (element,data,method,value) {
		var command = {
			method: method
		};

		if (arguments.length > 3) {
			command.value = value;
		}

		if (data.state === "init") {
			data.detail.commands.push(command);
		}
		else {
			var win = element.contentWindow;
			if (win) {
				win.postMessage(JSON.stringify(command),data.detail.origin);
			}
		}
	}
})(jQuery);


(function ($, undefined) {
	"use strict";

	var event_map = {
		ready: null,
		play: 'play',
		pause: 'pause',
		finish: 'finish',
		buffering: null,
		timeupdate: 'playProgress',
		durationchange: 'loadProgress',
		volumechange: null,
		error: null
	};

	$.embedplayer.register({
		origin: ['https://player.vimeo.com',"http://player.vimeo.com"],
		matches: function () {
			return $.nodeName(this,"iframe") && /^https?:\/\/player\.vimeo\.com\/video\/\d+.*[\?&]api=1/i.test(this.src);
		},
		init: function (data,callback) {
			var match = /^https?:\/\/player\.vimeo\.com\/video\/(\d+)[^\?#]*(?:\?(.*))/i.exec(this.src);
			var video_id = match[1];
			var params = $.embedplayer.parseParams(match[2]);

			callback(params.player_id);
			data.detail.duration = NaN;
			data.detail.currenttime = NaN;
			data.detail.commands = [];
			data.detail.origin = $.embedplayer.origin(this.src);
			data.detail.video_id = video_id;
			data.detail.callbacks = {};
		},
		play: function (data) {
			send(this,data,"play");
		},
		pause: function (data) {
			send(this,data,"pause");
		},
		stop: function (data) {
			send(this,data,"unload");
		},
		volume: function (data,callback) {
			if (data.detail.callbacks.getVolume) {
				data.detail.callbacks.getVolume.push(callback);
			}
			else {
				data.detail.callbacks.getVolume = [callback];
			}
			send(this,data,"getVolume");
		},
		duration: function (data,callback) {
			callback(data.detail.duration);
		},
		currenttime: function (data,callback) {
			callback(data.detail.currenttime);
		},
		setVolume: function (data,volume) {
			send(this,data,'setVolume',volume);
		},
		seek: function (data,position) {
			send(this,data,'seekTo',position);
		},
		listen: function (data,events) {
			var done = {};
			for (var i = 0; i < events.length; ++ i) {
				var event = event_map[events[i]];
				if (event && done[event] !== true) {
					done[event] = true;
					send(this,data,'addEventListener',event);
				}
			}
		},
		link: function (data) {
			return 'https://vimeo.com/'+data.detail.video_id;
		},
		parseMessage: function (event) {
			var message = {
				data: JSON.parse(event.data)
			};
			message.player_id = message.data.player_id;
			return message;
		},
		processMessage: function (data,message,trigger) {
			if (message.data.event === "ready") {
				trigger("ready");
				// get the initial volume value
				send(this,data,"getVolume");
				var win = this.contentWindow;
				if (win && data.detail.commands) {
					for (var i = 0; i < data.detail.commands.length; ++ i) {
						win.postMessage(JSON.stringify(data.detail.commands[i]),data.detail.origin);
					}
					data.detail.commands = null;
				}
			}
			else if (message.data.event === "playProgress") {
				if ('seconds' in message.data.data) {
					var currenttime = message.data.data.seconds;
					if (currenttime !== data.detail.currenttime) {
						data.detail.currenttime = currenttime;
						trigger('timeupdate',{currentTime:currenttime});
					}
				}
			}
			else if (message.data.event === "loadProgress") {
				if ('duration' in message.data.data) {
					var duration = message.data.data.duration;
					if (duration !== data.detail.duration) {
						data.detail.duration = duration;
						trigger("durationchange",{duration:duration});
					}
				}
			}
			else if (message.data.event === "play") {
				trigger("play");
			}
			else if (message.data.event === "pause") {
				trigger("pause");
			}
			else if (message.data.event === "finish") {
				trigger("finish");
			}
			else if (message.data.method) {
				var callbacks = data.detail.callbacks[message.data.method];
				if (callbacks) {
					for (var i = 0; i < callbacks.length; ++ i) {
						callbacks[i].call(this,message.data.value);
					}
					data.detail.callbacks[message.data.method] = null;
				}
				if (message.data.method === "getVolume") {
					trigger("volumechange",{volume:message.data.value});
				}
			}
		}
	});

	function send (element,data,method,value) {
		var command = {
			method: method
		};

		if (arguments.length > 3) {
			command.value = value;
		}

		if (data.state === "init") {
			data.detail.commands.push(command);
		}
		else {
			var win = element.contentWindow;
			if (win) {
				win.postMessage(JSON.stringify(command),data.detail.origin);
			}
		}
	}
})(jQuery);



