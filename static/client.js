$(function() {
	var socket = io.connect('http://dex.im:5353'), state = [], queue = [], results = [], albums = [], elapsed = 0, lastsearch = '', mousedown = false, custom = '', customlist = [];
	function toObject(data) {
		var out = {};
		data = data.replace(/^OK\s*/gm, '');
		data = data.split("\n");
		for (var i in data) {
			if (data[i] !== undefined && data[i].trim() != '') {
				data[i] = data[i].split(/: (.+)?/);
				out[data[i][0].toLowerCase()] = data[i][1];
			}
		}
		return out;
	}
	function toArray(data, sep) {
		var out = [];
		data = data.replace(/^OK\s*/gm, '');
		var reg = new RegExp('^'+sep+': ', 'gm');
		data = data.split(reg);
		console.log(data);
		for (var i in data) {
			if (data[i] != undefined && data[i].trim() != '') {
				out.push(toObject(sep+': '+data[i]));
			}
		}
		return out;		
	}
	function updateAlbums(data) {
		if (data !== undefined) {
			albums = toArray(data, 'Artist');
		}
		$('#albums-body').html('');
		for (var i in albums) {
			var s = albums[i];
			$('#albums-body').append('<tr><td><a href="#" class="button-find-artist" data-id="'+i+'"><i class="fa fa-fw fa-search"></i> '+s.artist+' </td><td><a href="#" class="button-find-album" data-id="'+i+'"><i class="fa fa-fw fa-search"></i> '+s.album+'</td><td>'+s.date+'</td></tr>');
		}
		$('#tab-albums .text').html('All albums ('+albums.length+')');
	}
	function updatePlaylists(data) {
		var lists = toArray(data, 'playlist');
		$('#playlists-body').html('');
		for (var i in lists) {
			var s = lists[i];
			$('#playlists-body').append('<tr><td><a href="#" class="button-edit-list" data-name="'+s.playlist+'"><i class="fa fa-fw fa-pencil"></i> '+s.playlist+' </td><td>'+s['last-modified']+'</td><td><a href="#" class="button-queue-list" data-name="'+s.playlist+'"><i class="fa fa-fw fa-plus"></i> Queue list</a></td></tr>');
		}
		$('#tab-playlists .text').html('Saved playlists ('+lists.length+')');
	}
	function updateCustom(data) {
		if (data !== undefined) {
			customlist = toArray(data, 'file');
		}
		$('#custom-body').html('');
		for (var i in customlist) {
			var s = customlist[i];
			var act = '<a href="" class="button-action" data-cmd=\'playlistmove \"'+custom+'\" '+i+' '+(1*i-1)+'\'><i class="fa fa-arrow-up fa-fw"></i></a>'
				+'<a href="" class="button-action" data-cmd=\'playlistmove \"'+custom+'\" '+i+' '+(1*i+1)+'\'><i class="fa fa-arrow-down fa-fw"></i></a>'
				+'<a href="" class="button-action" data-cmd=\'playlistdelete \"'+custom+'\" '+i+'\'><i class="fa fa-trash fa-fw"></i></a>';
			$('#custom-body').append('<tr><th>'+(1+1*i)+' </th><td>'+formatTime(s.time)+' </td><td><a href="#" class="button-action" data-cmd="play '+s.pos+'"><i class="fa fa-play"></i> '+s.title+'</a> </td><td><a href="#" class="button-find-artist" data-id="'+i+'"><i class="fa fa-fw fa-search"></i> '+s.artist+' </td><td><a href="#" class="button-find-album" data-id="'+i+'"><i class="fa fa-fw fa-search"></i> '+s.album+'</td><td>'+act+'</td></tr>');
		}
		$('#tab-custom .text').html(custom+' ('+customlist.length+')');
	}
	function updateQueue(data) {
		if (data !== undefined) {
			queue = toArray(data, 'file');
		}
		$('#queue-body').html('');
		for (var i in queue) {
			var s = queue[i];
			var act = '<a href="" class="button-action" data-cmd="move '+s.pos+' '+(1*s.pos-1)+'"><i class="fa fa-arrow-up fa-fw"></i></a>'
				+'<a href="" class="button-action" data-cmd="move '+s.pos+' '+(1*s.pos+1)+'"><i class="fa fa-arrow-down fa-fw"></i></a>'
				+'<a href="" class="button-action" data-cmd="delete '+s.pos+'"><i class="fa fa-trash fa-fw"></i></a>';
			$('#queue-body').append('<tr><th>'+(1+1*s.pos)+' </th><td>'+formatTime(s.time)+' </td><td><a href="#" class="button-action" data-cmd="play '+s.pos+'"><i class="fa fa-play"></i> '+s.title+'</a> </td><td><a href="#" class="button-find-artist" data-id="'+i+'"><i class="fa fa-fw fa-search"></i> '+s.artist+' </td><td><a href="#" class="button-find-album" data-id="'+i+'"><i class="fa fa-fw fa-search"></i> '+s.album+'</td><td>'+act+'</td></tr>');
		}
		$('#tab-queue .text').html('Play queue ('+queue.length+')');
	}
	function updateState(data) {
		if (data !== undefined) {
			state = toObject(data);
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
			if(state['elapsed']) {
				$('.song-elapsed').html(formatTime(state['elapsed']));
			} else {
				$('.song-elapsed').html('0:00');
			}
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
				$('#button-play .text').html('Pause');
				break;
			case 'pause':
			case 'stop':
				$('#button-play i').removeClass('fa-play fa-stop fa-pause');
				$('#button-play i').addClass('fa-play');
				$('#button-play .text').html('Play');
				break;
			default:
		}
		$('#setting-buttons button').removeClass('active');
		if (state['random'] === '1') $('#button-random').addClass('active');
		if (state['consume'] === '1') $('#button-consume').addClass('active');
		if (state['single'] === '1') $('#button-single').addClass('active');
		if (state['repeat'] === '1') $('#button-repeat').addClass('active');
		$('#tab-queue .text').html('Play queue ('+state['playlistlength']+')');
	}
	function updateResults(data) {
		if (data !== undefined) {
			results = toArray(data, 'file');
		}
		$('#results-body').html('');
		for (var i in results) {
			var s = results[i];
			$('#results-body').append('<tr><td>'+formatTime(s.time)+' </td><td><a href="#" class="button-add" data-id="'+i+'"><i class="fa fa-fw fa-plus"></i> '+s.title+'</a> </td><td><a href="#" class="button-find-artist" data-id="'+i+'"><i class="fa fa-fw fa-search"></i> '+s.artist+' </td><td><a href="#" class="button-find-album" data-id="'+i+'"><i class="fa fa-fw fa-search"></i> '+s.album+'</td></tr>');
		}
		$('#tab-results').html('Search results ('+results.length+')');
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
	$('#queue-body, #results-body, #albums-body, #playlists-body').on('click', '.button-action', function(e) {
		e.preventDefault();
		socket.emit('cmd', $(this).data('cmd'));
	});
	$('#custom-body').on('click', '.button-action', function(e) {
		e.preventDefault();
		socket.emit('cmd', $(this).data('cmd'));
		socket.emit('cmd', 'listplaylistinfo "'+custom+'"');
	});
	$('#results-body').on('click', '.button-add', function(e) {
		e.preventDefault();
		if ($('#playlist').val() == '') {
			socket.emit('cmd', 'findadd file "'+results[$(this).data('id')]['file']+'"');
		} else {
			socket.emit('cmd', 'playlistadd "'+$('#playlist').val()+'" "'+results[$(this).data('id')]['file']+'"');
		}
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
	$('#albums-body').on('click', '.button-find-artist', function(e) {
		e.preventDefault();
		socket.emit('cmd', 'find artist "'+albums[$(this).data('id')]['artist']+'"');
		$('#search').val(albums[$(this).data('id')]['artist']);
		lastsearch = 'find artist "'+albums[$(this).data('id')]['artist']+'"';
		$('')
	});
	$('#albums-body').on('click', '.button-find-album', function(e) {
		e.preventDefault();
		socket.emit('cmd', 'find album "'+albums[$(this).data('id')]['album']+'"');
		$('#search').val(albums[$(this).data('id')]['album']);
		lastsearch = 'find album "'+albums[$(this).data('id')]['album']+'"';
	});
	$('#playlists-body').on('click', '.button-queue-list', function(e) {
		e.preventDefault();
		socket.emit('cmd', 'load "'+$(this).data('name')+'"');
	});
	$('#playlists-body').on('click', '.button-edit-list', function(e) {
		e.preventDefault();
		custom = $(this).data('name');
		$('#tab-custom .text').html(custom);
		$('#tab-custom').show().click();
		if(custom !== '') {
			socket.emit('cmd', 'listplaylistinfo "'+custom+'"');
		}
	});
	$('#save').click(function() {
		var name = prompt('Save playlist as');
		if (name !== '') {
			socket.emit('cmd', 'save "'+name+'"');
		}
	});
	$('#clear').click(function() {
		socket.emit('cmd', 'clear');
	});
	$('#delete').click(function() {
		if(custom !== '') {
			socket.emit('cmd', 'rm "'+custom+'"');
		}
		$('#tab-playlists').click();
		$('#tab-custom').hide();
	});
	$('#addall').click(function() {
		var addcmd = lastsearch.replace(/^find/, 'findadd').replace(/^search/, 'searchadd');
		socket.emit('cmd', addcmd);
	});
	$(document).keydown(function(e){
		if(!$(e.target).is('input')) {
			$('#search').focus();
		}
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
	$(window).focus(function() {
		socket.emit('cmd', 'status');
	});
	$('#slider').mouseup(function() {
		socket.emit('cmd', 'seekcur '+$(this).val());
	});
	socket.on('connect', function(data) {
		socket.emit('cmd', 'playlistinfo');
		socket.emit('cmd', 'status');
		socket.emit('cmd', 'list artist group album group date');
		socket.emit('cmd', 'listplaylists');
	});
	socket.on('status', function(data) {
		updateState(data);
	});
	socket.on('playlistinfo', function(data) {
		updateQueue(data);
	});
	socket.on('list', function(data) {
		updateAlbums(data);
	});
	socket.on('listplaylists', function(data) {
		updatePlaylists(data);
		if (custom !== '') {
			socket.emit('listplaylistinfo "'+custom+'"');
		}
	});
	socket.on('listplaylistinfo', function(data) {
		updateCustom(data);
	})
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
			var left = queue[state['song']]['time']-elapsed;
			if(left > 60) {
				$('#timeleft').html(formatTime(left));
			} else {
				$('#timeleft').html(left.toFixed(1));
			}
			if (!mousedown) {
				$('#slider').val(elapsed);
			}
		} else {
			$('#timeleft').html('');
		}
	}, 100);
});