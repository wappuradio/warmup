$(function() {
	var socket = io.connect('http://dex.im:5353'), state = [], queue = [], results = [], elapsed = 0, lastsearch = '', mousedown = false;
	function dataToObject(data) {
		var out = {};
		data = data.split("\n");
		for (var i in data) {
			if (data[i] !== '') {
				data[i] = data[i].split(/: (.+)?/);
				out[data[i][0].toLowerCase()] = data[i][1];
			}
		}
		return out;
	}
	function filesToArray(data) {
		var out = [];
		data = data.split(/^file: /gm);
		for (var i in data) {
			if (data[i] !== '') {
				out.push(dataToObject('file: '+data[i]));
			}
		}
		return out;
	}
	function updateQueue(data) {
		if (data !== undefined) {
			queue = filesToArray(data);
		}
		$('#queue-body').html('');
		for (var i in queue) {
			var s = queue[i];
			var act = '<a href="" class="button-action" data-cmd="move '+s.pos+' '+(1*s.pos-1)+'"><i class="fa fa-arrow-up fa-fw"></i></a>'
				+'<a href="" class="button-action" data-cmd="move '+s.pos+' '+(1*s.pos+1)+'"><i class="fa fa-arrow-down fa-fw"></i></a>'
				+'<a href="" class="button-action" data-cmd="delete '+s.pos+'"><i class="fa fa-trash fa-fw"></i></a>';
			$('#queue-body').append('<tr><th>'+(1+1*s.pos)+' </th><td>'+formatTime(s.time)+' </td><td><a href="#" class="button-action" data-cmd="play '+s.pos+'"><i class="fa fa-play"></i> '+s.title+'</a> </td><td><a href="#" class="button-find-artist" data-id="'+i+'"><i class="fa fa-fw fa-search"></i> '+s.artist+' </td><td><a href="#" class="button-find-album" data-id="'+i+'"><i class="fa fa-fw fa-search"></i> '+s.album+'</td><td>'+act+'</td></tr>');
		}
		$('#tab-queue').html('Queue ('+queue.length+')');
	}
	function updateState(data) {
		if (data !== undefined) {
			state = dataToObject(data);
			elapsed = parseFloat(state['elapsed']);
			$('.song-elapsed').html(elapsed);
			$('#slider').val(elapsed);
		}
		$('#queue-body tr').removeClass('cur next');
		$('.player-icon').removeClass('fa-play fa-stop fa-pause');
		$('.player-icon').addClass('fa-'+state['state']);
		if (queue.length > 0 && state['song'] !== undefined) {
			$('#nowplaying').show();
			for (var i in queue[state['song']]) {
				if (queue[state['song']].hasOwnProperty(i)) {
					$('.song-'+i).html(queue[state['song']][i]);
				}
			}
			$('.song-elapsed').html(formatTime(state['elapsed']));
			$('.song-time').html(formatTime(queue[state['song']]['time']));
			$('#slider').attr('max', queue[state['song']]['time']);
			$('#queue-body tr:nth-child('+(1+1*state['song'])+')').addClass('cur');
			if (queue.length > 1 && state['nextsong'] !== undefined) {
				$('#next').show();
				for (var i in queue[state['nextsong']]) {
					if (queue[state['nextsong']].hasOwnProperty(i)) {
						$('.next-'+i).html(queue[state['nextsong']][i]);
					}
				}
				$('.next-time').html(formatTime(queue[state['nextsong']]['time']));
				$('#queue-body tr:nth-child('+(1+1*state['nextsong'])+')').addClass('next');
			} else {
				$('#next').hide();
			}
		} else {
			$('#nowplaying, #next').hide();
		}
		switch(state['state']) {
			case 'play':
				$('#button-play i').removeClass('fa-play fa-stop fa-pause');
				$('#button-play i').addClass('fa-pause');
				break;
			case 'pause':
			case 'stop':
				$('#button-play i').removeClass('fa-play fa-stop fa-pause');
				$('#button-play i').addClass('fa-play');
				break;
			default:
		}
		$('#setting-buttons button').removeClass('active');
		if (state['random'] === '1') $('#button-random').addClass('active');
		if (state['consume'] === '1') $('#button-consume').addClass('active');
		if (state['single'] === '1') $('#button-single').addClass('active');
		if (state['repeat'] === '1') $('#button-repeat').addClass('active');
		$('#tab-queue').html('Queue ('+state['playlistlength']+')');
	}
	function updateResults(data) {
		if (data !== undefined) {
			results = filesToArray(data);
		}
		$('#results-body').html('');
		for (var i in results) {
			var s = results[i];
			$('#results-body').append('<tr><td>'+formatTime(s.time)+' </td><td><a href="#" class="button-add" data-id="'+i+'"><i class="fa fa-fw fa-plus"></i> '+s.title+'</a> </td><td><a href="#" class="button-find-artist" data-id="'+i+'"><i class="fa fa-fw fa-search"></i> '+s.artist+' </td><td><a href="#" class="button-find-album" data-id="'+i+'"><i class="fa fa-fw fa-search"></i> '+s.album+'</td></tr>');
		}
		$('#tab-results').html('Results ('+results.length+')');
	}
	function formatTime(time) {
		time = parseInt(time);
		return parseInt(time/60)+':'+(time%60 < 10 ? '0'+time%60 : time%60);
	}
	$('#control-buttons button').click(function() {
		if ($(this).data('cmd') !== 'pause') {
			socket.emit('cmd', $(this).data('cmd'));
		} else {
			switch (state['state']) {
				case 'stop':
					socket.emit('cmd', 'play');
					break;
				case 'pause':
					socket.emit('cmd', 'pause 0');
					break;
				case 'play':
					socket.emit('cmd', 'pause 1');
					break;
				default:
			}
		}
	});
	$('#setting-buttons button').click(function() {
		socket.emit('cmd', $(this).data('cmd')+' '+($(this).hasClass('active')?'0':'1'));
	});
	$('#queue-body').on('click', '.button-action', function(e) {
		e.preventDefault();
		socket.emit('cmd', $(this).data('cmd'));
	});
	$('#results-body').on('click', '.button-add', function(e) {
		e.preventDefault();
		socket.emit('cmd', 'findadd file "'+results[$(this).data('id')]['file']+'"');
	});
	$('#results-body').on('click', '.button-find-artist', function(e) {
		e.preventDefault();
		socket.emit('cmd', 'find artist "'+results[$(this).data('id')]['artist']+'"');
		$('#search').val(results[$(this).data('id')]['artist']);
		lastsearch = 'find artist "'+results[$(this).data('id')]['artist']+'"';
		$('')
	});
	$('#results-body').on('click', '.button-find-album', function(e) {
		e.preventDefault();
		socket.emit('cmd', 'find album "'+results[$(this).data('id')]['album']+'"');
		$('#search').val(results[$(this).data('id')]['album']);
		lastsearch = 'find album "'+results[$(this).data('id')]['album']+'"';
	});
	$('#queue-body').on('click', '.button-find-artist', function(e) {
		e.preventDefault();
		socket.emit('cmd', 'find artist "'+queue[$(this).data('id')]['artist']+'"');
		$('#search').val(queue[$(this).data('id')]['artist']);
		lastsearch = 'find artist "'+queue[$(this).data('id')]['artist']+'"';
		$('')
	});
	$('#queue-body').on('click', '.button-find-album', function(e) {
		e.preventDefault();
		socket.emit('cmd', 'find album "'+queue[$(this).data('id')]['album']+'"');
		$('#search').val(queue[$(this).data('id')]['album']);
		lastsearch = 'find album "'+queue[$(this).data('id')]['album']+'"';
	});
	$('#clear').click(function() {
		socket.emit('cmd', 'clear');
	});
	$('#addall').click(function() {
		var addcmd = lastsearch.replace(/^find/, 'findadd').replace(/^search/, 'searchadd');
		socket.emit('cmd', addcmd);
	});
	$(document).keydown(function(e){
		$('#search').focus();
		var str = $('#search').val();
		if(e.which == 13) {
			e.preventDefault();
			if (str.match(/^.+ ".+"$/)) {
				socket.emit('cmd', 'find '+str);
				lastsearch = 'find '+str;
			} else {
				socket.emit('cmd', 'search any "'+str+'"');
				lastsearch = 'search any "'+str+'"';
			}
		}
	});
	$(document).mousedown(function() {
		mousedown = true;
	});
	$(document).mouseup(function() {
		mousedown = false;
	});
	$('#slider').mouseup(function() {
		socket.emit('cmd', 'seekcur '+$(this).val());
	});
	socket.on('connect', function(data) {
		socket.emit('cmd', 'playlistinfo');
		socket.emit('cmd', 'status');
	});
	socket.on('status', function(data) {
		updateState(data);
	});
	socket.on('playlistinfo', function(data) {
		updateQueue(data);
	});
	socket.on('search', function(data) {
		updateResults(data);
		$('#tab-results').click();
	});
	socket.on('find', function(data) {
		updateResults(data);
		$('#tab-results').click();
	});
	setInterval(function() {
		if (state['state'] == 'play') {
			elapsed += 0.1;
			elapsed = Number(elapsed.toFixed(3));
			$('.song-elapsed').html(formatTime(elapsed));
			if (!mousedown) {
				$('#slider').val(elapsed);
			}
		}
	}, 100);
});