$.fn.animateRotate = function(start, angle, duration, complete) {
  return this.each(function() {
    var $elem = $(this);

    $({deg: start}).animate({deg: angle}, {
      duration: duration,
      easing: 'linear',
      step: function(now) {
        $elem.css({
           transform: 'rotateY(' + now + 'deg)'
         });
      },
      complete: complete || $.noop
    });
  });
};

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
			$('#albums-body').append('<tr><td><a href="#" class="button-find" data-key="artist" data-value="'+s.artist+'"><i class="fa fa-fw fa-search"></i> '+s.artist+'</a> </td><td><a href="#" class="button-find" data-key="album" data-value="'+s.album+'"><i class="fa fa-fw fa-search"></i> '+s.album+'</a> </td><td><a href="#" class="button-find" data-key="genre" data-value="'+s.genre+'"><i class="fa fa-fw fa-search"></i> '+s.genre+'</a> </td><td><a href="#" class="button-find" data-key="date" data-value="'+s.date+'"><i class="fa fa-fw fa-search"></i> '+s.date+'</a> </td></tr>');
		}
		$('#tab-albums .text').html('All albums ('+albums.length+')');
	}
	function updatePlaylists(data) {
		var lists = toArray(data, 'playlist');
		$('#playlists-body').html('');
		for (var i in lists) {
			var s = lists[i];
			$('#playlists-body').append('<tr><td><a href="#" class="button-edit-list" data-name="'+s.playlist+'"><i class="fa fa-fw fa-pencil"></i> '+s.playlist+' </td><td>'+s['last-modified']+'</td><td><a href="#" class="button-queue-list" data-name="'+s.playlist+'"><i class="fa fa-fw fa-plus-circle"></i> Queue all</a></td></tr>');
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
			$('#custom-body').append('<tr><th>'+(1+1*i)+' </th><td>'+formatTime(s.time)+' </td><td><a href="#" class="button-add" data-id="'+i+'"><i class="fa fa-plus-circle"></i> '+s.title+'</a> </td><td><a href="#" class="button-find" data-key="artist" data-value="'+s.artist+'"><i class="fa fa-fw fa-search"></i> '+s.artist+'</a> </td><td><a href="#" class="button-find" data-key="album" data-value="'+s.album+'"><i class="fa fa-fw fa-search"></i> '+s.album+'</a> </td><td><a href="" class="button-action" data-cmd=\'playlistdelete \"'+custom+'\" '+i+'\'><i class="fa fa-trash fa-fw"></i></a></td></tr>');
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
			$('#queue-body').append('<tr><th>'+(1+1*s.pos)+' </th><td>'+formatTime(s.time)+' </td><td><a href="#" class="button-action" data-cmd="play '+s.pos+'"><i class="fa fa-play-circle"></i> '+s.title+'</a> </td><td><a href="#" class="button-find" data-key="artist" data-value="'+s.artist+'"><i class="fa fa-fw fa-search"></i> '+s.artist+'</a> </td><td><a href="#" class="button-find" data-key="album" data-value="'+s.album+'"><i class="fa fa-fw fa-search"></i> '+s.album+'</a> </td><td><a href="#" class="button-action" data-cmd="delete '+s.pos+'"><i class="fa fa-trash fa-fw"></i></a></td></tr>');
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
		if ($('.player-icon').data('state') != state['state']) {
			$('.player-icon').animateRotate(0, 90, 300, function() {
				$('.player-icon').removeClass('fa-stop fa-play fa-pause').addClass('fa-'+state['state']);
				$('.player-icon').animateRotate(90, 0, 300, function() {
					$('.player-icon').data('state', state['state']);
				});
			});
		}
		if (queue.length > 0 && state['song'] !== undefined) {
			$('#player').fadeIn();
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
			//$('#queue-body tr:nth-child('+(1+1*state['song'])+')').addClass('cur');
			if (state['nextsong'] !== undefined && queue.length > state['nextsong']) {
				$('#next').fadeIn();
				for (var i in queue[state['nextsong']]) {
					if (queue[state['nextsong']].hasOwnProperty(i)) {
						$('.next-'+i).html(queue[state['nextsong']][i]);
					}
				}
				$('.next-time').html(formatTime(queue[state['nextsong']]['time']));
				//$('#queue-body tr:nth-child('+(1+1*state['nextsong'])+')').addClass('next');
			} else {
				$('#next').fadeOut();
			}
		} else {
			$('#player, #next').fadeOut();
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
		//$('#tab-queue .text').html('Play queue ('+state['playlistlength']+')');
	}
	function updateResults(data) {
		if (data !== undefined) {
			results = toArray(data, 'file');
		}
		$('#results-body').html('');
		for (var i in results) {
			var s = results[i];
			$('#results-body').append('<tr><td>'+formatTime(s.time)+' </td><td><a href="#" class="button-add" data-id="'+i+'"><i class="fa fa-fw fa-plus-circle"></i> '+s.title+'</a> </td><td><a href="#" class="button-find" data-key="artist" data-value="'+s.artist+'"><i class="fa fa-fw fa-search"></i> '+s.artist+'</a> </td><td><a href="#" class="button-find" data-key="album" data-value="'+s.album+'"><i class="fa fa-fw fa-search"></i> '+s.album+'</a> </td></tr>');
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
	$('#custom-body').on('click', '.button-add', function(e) {
		e.preventDefault();
		socket.emit('cmd', 'findadd file "'+customlist[$(this).data('id')]['file']+'"');
	});
	$('#queue-body, #results-body, #albums-body, #custom-body').on('click', '.button-find', function(e) {
		e.preventDefault();
		var key = $(this).data('key');
		var value = $(this).data('value');
		var search = 'find '+key+' "'+value+'"';
		socket.emit('cmd', search);
		$('#search').val(key+' "'+value+'"');
		lastsearch = search;
	});
	$('#playlists-body').on('click', '.button-queue-list', function(e) {
		e.preventDefault();
		socket.emit('cmd', 'load "'+$(this).data('name')+'"');
		socket.emit('cmd', 'status');
		socket.emit('cmd', 'playlistinfo');
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
		if (name) {
			socket.emit('cmd', 'save "'+name+'"');
		}
	});
	$('#shuffle').click(function() {
		socket.emit('cmd', 'shuffle');
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
		} else if (e.which == 27) {
			e.preventDefault();
			$('#search').val('');
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
		socket.emit('cmd', 'status');
		socket.emit('cmd', 'playlistinfo');
		socket.emit('cmd', 'list artist group album group date group genre');
		socket.emit('cmd', 'listplaylists');
	});
	socket.on('status', function(data) {
		updateState(data);
		updateQueue();
	});
	socket.on('playlistinfo', function(data) {
		updateQueue(data);
		updateState();
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
	socket.on('upload', function(data) {
		$('#uploaded').append('<div class="msg">'+data+'</div>');
	});
	setInterval(function() {
		if (state['state'] == 'play' && queue.length > 0 && state['song'] != undefined && queue[state['song']] != undefined) {
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
	$(window).load(function() {
		$('#queue-table').rowSorter({
			onDrop: function(tbody, row, index, oldIndex) {
				socket.emit('cmd', 'move '+oldIndex+' '+index);
			}
		});
		$('#custom-table').rowSorter({
			onDrop: function(tbody, row, index, oldIndex) {
				socket.emit('cmd', 'playlistmove "'+custom+'" '+oldIndex+' '+index);
				socket.emit('cmd', 'listplaylistinfo "'+custom+'"');
			}
		});
	});

    var dropZone = document.getElementById('drop-zone');
    var uploadForm = document.getElementById('js-upload-form');
    var startUpload = function(files) {
	    var formData = new FormData();
	    var n = 0;
	    for (var file in files) {
	    	if (files.hasOwnProperty(file)) {
		    	if (files[file].type == 'audio/flac') {
			        formData.append('files', files[file]);
			        n++;
			    } else {
			    	$('#uploaded').append('<div class="msg">Not a flac</div>');
			    }
			}
	    }
	    if (n > 0) {
		    var xhr = new XMLHttpRequest();
		    xhr.upload.onprogress = function(e) {
		    	var percent = Math.ceil((e.loaded / e.total) * 100);
		    	$('#progress').addClass('active');
		    	$('#progress .progress-bar').css('width',  percent+'%').attr('aria-valuenow', percent);
		    }
		    xhr.onload = function(e) {
		    	$('#progress').removeClass('active');
		    }
		    xhr.open('POST', '/', true);
		    xhr.setRequestHeader('X-Requested-With','XMLHttpRequest');
		    xhr.send(formData);
		}
    }
    uploadForm.addEventListener('submit', function(e) {
        var uploadFiles = document.getElementById('js-upload-files').files;
        e.preventDefault()
        startUpload(uploadFiles)
    })
    dropZone.ondrop = function(e) {
        e.preventDefault();
        this.className = 'upload-drop-zone';

        startUpload(e.dataTransfer.files)
    }
    dropZone.ondragover = function() {
        this.className = 'upload-drop-zone drop';
        return false;
    }
    dropZone.ondragleave = function() {
        this.className = 'upload-drop-zone';
        return false;
    }

    $(dropZone).click(function() {
    	$('#js-upload-files').click();
    });
    $('#js-upload-files').on('change', function() {
    	var uploadFiles = document.getElementById('js-upload-files').files;
    	startUpload(uploadFiles);
    });
});