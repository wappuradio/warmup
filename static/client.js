$.fn.animateRotate = function(start, angle, duration, complete) {
    return this.each(function() {
        var $elem = $(this);

        $({
            deg: start
        }).animate({
            deg: angle
        }, {
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
String.prototype.hashCode = function() {
    var hash = 0,
        i, chr, len;
    if (this.length === 0) {
        return hash;
    }
    for (i = 0, len = this.length; i < len; i++) {
        chr = this.charCodeAt(i);
        hash = ((hash << 5) - hash) + chr;
        hash |= 0; // Convert to 32bit integer
    }
    return hash;
};
$(function() {
    //var wsurl = window.location.href.replace(/^http/, 'ws') + 'ws',
    var wsurl = 'ws://' + window.location.hostname + ':6681',
        socket,
        state = {},
        queue = [],
        results = [],
        albums = [],
        elapsed = 0,
        laststate = 0,
        lastsearch = '',
        mousedown = false,
        custom = '',
        customlist = [],
        playlists = [],
        locked = true;

    function exec(line) {
        if (locked && !line.split(' ')[0].match(/^(status|find|search|playlistinfo|list|listplaylists|playlistadd|listplaylistinfo|listplaylist|playlistmove|playlistdelete|save|rm)$/gm)) {
            console.log('Blocked: ' + line);
            return;
        }
        console.log('cmd: ' + line);
        socket.send(line);
    }

    function escapeRegExp(str) {
        return str.replace(/[\-\[\]\/\{\}\(\)\*\+\?\.\\\^\$\|]/g, "\\$&");
    }

    function toObject(data) {
        var out = {};
        data = data.toString().replace(/^OK\s*/gm, '');
        data = data.split("\n");
        for (var i in data) {
            if (data[i] !== undefined && data[i].trim() !== '') {
                data[i] = data[i].split(/: (.+)?/);
                out[data[i][0].toLowerCase()] = data[i][1];
            }
        }
        return out;
    }

    function toArray(data, sep) {
        var out = [];
        data = data.toString().replace(/^OK\s*/gm, '');
        var reg = new RegExp('^' + sep + ': ', 'gm');
        data = data.split(reg);
        for (var i in data) {
            if (data[i] !== undefined && data[i].trim() !== '') {
                out.push(toObject(sep + ': ' + data[i]));
            }
        }
        return out;
    }

    function updateAlbums(data) {
        if (data !== undefined) {
            albums = toArray(data, 'Artist');
        }
        albums.sort(function(a, b) {
            if(a.artist && b.artist) {
                return (a.artist.localeCompare(b.artist));
            } else {
                return 0;
            }
        });
        $('#albums-body').html('');
        for (var i in albums) {
            var s = albums[i];
            $('#albums-body').append('<tr><td><a href="#" class="button-find" data-key="artist" data-value="' + s.artist + '"><i class="fa fa-lg fa-fw fa-search"></i> ' + s.artist + '</a> </td><td><a href="#" class="button-find" data-key="album" data-value="' + s.album + '"><i class="fa fa-lg fa-fw fa-search"></i> ' + s.album + '</a> </td><td>' + (s.date ? '<a href="#" class="button-find" data-key="date" data-value="' + s.date.replace(/-.*/, '') + '"><i class="fa fa-lg fa-fw fa-search"></i> ' + s.date.replace(/-.*/, '') + '</a>' : '') + '</td></tr>');
        }
        $('#tab-albums .text').html('Database (' + albums.length + ')');
    }

    function updatePlaylists(data) {
        if (data === undefined) {
            return;
        }
        var lists = toArray(data, 'playlist');
        $('#playlists-body').html('');
        for (var i in lists) {
            var s = lists[i];
            exec('listplaylist "' + s.playlist + '"');
            $('#playlists-body').append('<tr><td><a href="#" class="button-edit-list" data-name="' + s.playlist + '"><i class="fa fa-lg fa-fw fa-pencil"></i> ' + s.playlist + ' </td><td>' + s['last-modified'] + '</td><td><a href="#" class="button-queue-list" data-name="' + s.playlist + '"><i class="fa fa-lg fa-fw fa-plus-circle"></i> Queue all</a></td></tr>');
        }
        $('#tab-playlists .text').html('Saved playlists (' + lists.length + ')');
    }

    function updateCustom(data) {
        if (data !== undefined) {
            customlist = toArray(data, 'file');
        }
        $('#custom-body').html('');
        for (var i in customlist) {
            var s = customlist[i];
            $('#custom-body').append('<tr><th>' + (1 + 1 * i) + ' </th><td>' + formatTime(s.time) + '</td><td><a href="#" class="button-add" data-key="track" data-value="' + s.title + '" data-id="' + i + '"><i class="fa fa-plus-circle"></i> ' + s.title + '</a> </td><td><a href="#" class="button-find" data-key="artist" data-value="' + s.artist + '"><i class="fa fa-lg fa-fw fa-search"></i> ' + s.artist + '</a> </td><td><a href="#" class="button-find" data-key="album" data-value="' + s.album + '"><i class="fa fa-lg fa-fw fa-search"></i> ' + s.album + '</a> </td><td><a href="" class="button-action" data-cmd=\'playlistdelete \"' + custom + '\" ' + i + '\'><i class="fa fa-trash fa-lg fa-fw"></i></a></td></tr>');
        }
        $('#tab-custom .text').html(custom + ' (' + customlist.length + ')');
    }

    function updateQueue(data) {
        if (data !== undefined) {
            queue = toArray(data, 'file');
        }
        $('#queue-body').html('');
        for (var i in queue) {
            var s = queue[i];
            $('#queue-body').append('<tr><th>' + (1 + 1 * s.pos) + ' </th><td>' + formatTime(s.time) + '</td><td><a href="#" class="button-action" data-cmd="play ' + s.pos + '"><i class="fa fa-lg fa-fw fa-play-circle"></i> ' + s.title + '</a> </td><td><a href="#" class="button-find" data-key="artist" data-value="' + s.artist + '"><i class="fa fa-lg fa-fw fa-search"></i> ' + s.artist + '</a> </td><td><a href="#" class="button-find" data-key="album" data-value="' + s.album + '"><i class="fa fa-lg fa-fw fa-search"></i> ' + s.album + '</a> </td><td><a href="#" class="button-action" data-cmd="delete ' + s.pos + '"><i class="fa fa-trash fa-lg fa-fw"></i></a></td></tr>');
        }
        $('#tab-queue .text').html('Play queue (' + queue.length + ')');
        updateState();
    }

    function updateState(data) {
        if (data !== undefined) {
            state = toObject(data);
            if (state.elapsed === undefined) {
                state.elapsed = 0;
            }
            laststate = +new Date();
            elapsed = parseFloat(state.elapsed);
            $('#slider').val(elapsed);
        }
        if (state === undefined) return;
        $('body').removeClass();
        $('body').addClass(state.state);
        $('#queue-body tr').removeClass('cur next');
        if ($('.player-icon').data('state') != state.state) {
            $('.player-icon').animateRotate(0, 90, 300, function() {
                $('.player-icon').removeClass('fa-stop fa-play fa-pause').addClass('fa-' + state.state);
                $('.player-icon').animateRotate(90, 0, 300, function() {
                    $('.player-icon').data('state', state.state);
                });
            });
        }
        if (queue.length > 0 && state.song !== undefined) {
            var hash = queue[state.song].file.hashCode();
            $('#waveform').css('background-size', '100% 1000%');
            //$('#waveform').css('height', '0');
            //$('#waveform').css('margin-top', '50px');
            $('#waveform').css('background-color', '#2e3338');
            $('<img/>').attr('src', 'waveform?' + hash).load(function() {
                $(this).remove();
                $('#waveform').css('background-image', 'url(waveform?' + hash + ')');
                $('#waveform').css('background-color', 'rgba(0,0,0,0.4)');
                $('#waveform').css('background-size', '100% 100%');
                //$('#waveform').css('height', '100px');
                //$('#waveform').css('margin-top', '0');
            });
            $('#player').fadeIn();
            for (var i in queue[state.song]) {
                if (queue[state.song].hasOwnProperty(i)) {
                    $('.song-' + i).html(queue[state.song][i]);
                }
            }
            if (state.elapsed) {
                $('.song-elapsed').html(formatTime(state.elapsed));
            } else {
                $('.song-elapsed').html('0:00');
            }
            $('.song-time').html(formatTime(queue[state.song].time));
            $('#slider').attr('max', queue[state.song].time);
            $('#queue-body tr:nth-child(' + (1 + 1 * state.song) + ')').addClass('cur');
            if (state.nextsong !== undefined && queue.length > state.nextsong) {
                $('#next').fadeIn();
                for (var j in queue[state.nextsong]) {
                    if (queue[state.nextsong].hasOwnProperty(j)) {
                        $('.next-' + j).html(queue[state.nextsong][j]);
                    }
                }
                $('.next-time').html(formatTime(queue[state.nextsong].time));
                $('#queue-body tr:nth-child(' + (1 + 1 * state.nextsong) + ')').addClass('next');
            } else {
                $('#next').fadeOut();
            }
        } else {
            $('#player, #next').fadeOut();
        }
        switch (state.state) {
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
        if (state.random == 1) $('#button-random').addClass('active');
        if (state.consume == 1) $('#button-consume').addClass('active');
        if (state.single == 1) $('#button-single').addClass('active');
        if (state.repeat == 1) $('#button-repeat').addClass('active');
    }

    function updateResults(data) {
        if (data !== undefined) {
            results = toArray(data, 'file');
        }
        $('#results-body').html('');
        for (var i in results) {
            var s = results[i];
            var tag = [];
            for (var j in playlists) {
                var reg = new RegExp(escapeRegExp(s.file), 'gm');
                if (playlists[j].match(reg)) {
                    tag.push(j);
                }
            }
            if (tag.length) {
                tag = '<div class="tag">' + tag.join(', ') + '</div>';
            }
            $('#results-body').append('<tr><td>' + (1 * i + 1) + '</td><td>' + formatTime(s.time) + '</td><td>' + tag + '<a href="#" class="button-add" data-key="title" data-value="' + s.title + '" data-id="' + i + '"><i class="fa fa-lg fa-fw fa-plus-circle"></i> ' + s.title + '</a> </td><td><a href="#" class="button-find" data-key="artist" data-value="' + s.artist + '"><i class="fa fa-lg fa-fw fa-search"></i> ' + s.artist + '</a> </td><td><a href="#" class="button-find" data-key="album" data-value="' + s.album + '"><i class="fa fa-lg fa-fw fa-search"></i> ' + s.album + '</a> </td><td>' + (s.date ? '<a href="#" class="button-find" data-key="date" data-value="' + s.date.replace(/-.*/, '') + '"><i class="fa fa-lg fa-fw fa-search"></i> ' + s.date.replace(/-.*/, '') + '</a>' : '') + '</td></tr>');
        }
        $('#tab-results .text').html('Search results (' + results.length + ')');
    }

    function formatTime(time) {
        var sec_num = parseInt(time, 10);
        var hour = Math.floor(sec_num / 3600);
        var min = Math.floor((sec_num - (hour * 3600)) / 60);
        var sec = sec_num - (hour * 3600) - (min * 60);
        if (hour > 0 && min < 10) {
            min = '0' + min;
        }
        if (sec < 10) {
            sec = '0' + sec;
        }
        return (hour > 0 ? hour + ':' : '') + min + ':' + sec;
    }
    $('#control-buttons button').click(function() {
        if ($(this).data('cmd') !== 'pause') {
            exec($(this).data('cmd'));
        } else {
            switch (state.state) {
                case 'stop':
                    exec('play');
                    break;
                case 'pause':
                    exec('pause 0');
                    break;
                case 'play':
                    exec('pause 1');
                    break;
                default:
            }
        }
    });
    $('#setting-buttons button').click(function() {
        exec($(this).data('cmd') + ' ' + ($(this).hasClass('active') ? '0' : '1'));
    });
    $('#queue-body, #results-body, #albums-body, #playlists-body').on('click', '.button-action', function(e) {
        e.preventDefault();
        exec($(this).data('cmd'));
    });
    $('#custom-body').on('click', '.button-action', function(e) {
        e.preventDefault();
        exec($(this).data('cmd'));
        exec('listplaylistinfo "' + custom + '"');
    });
    $('#results-body').on('click', '.button-add', function(e) {
        e.preventDefault();
        if ($('#playlist').val() === '') {
            exec('findadd file "' + results[$(this).data('id')].file + '"');
        } else {
            exec('playlistadd "' + $('#playlist').val() + '" "' + results[$(this).data('id')].file + '"');
        }
    });
    $('#custom-body').on('click', '.button-add', function(e) {
        e.preventDefault();
        exec('findadd file "' + customlist[$(this).data('id')].file + '"');
    });
    $('#queue-body, #results-body, #albums-body, #custom-body').on('click', '.button-find', function(e) {
        e.preventDefault();
        var key = $(this).data('key');
        var value = $(this).data('value');
        var search = 'find ' + key + ' "' + value + '"';
        exec(search);
        $('#search').val(key + ' "' + value + '"');
        lastsearch = search;
    });
    $('#playlists-body').on('click', '.button-queue-list', function(e) {
        e.preventDefault();
        exec('load "' + $(this).data('name') + '"');
        exec('status');
        exec('playlistinfo');
        $('#tab-queue').tab('show');
    });
    $('#playlists-body').on('click', '.button-edit-list', function(e) {
        e.preventDefault();
        custom = $(this).data('name');
        $('#tab-custom .text').html(custom);
        $('#tab-custom').show().click();
        if (custom !== '') {
            exec('listplaylistinfo "' + custom + '"');
        }
    });
    $('#save').click(function() {
        var name = prompt('Save playlist as');
        if (name) {
            exec('save "' + name + '"');
        }
    });
    $('#shuffle').click(function() {
        exec('shuffle');
    });
    $('#queueall').click(function() {
        exec('load "' + custom + '"');
        $('#tab-queue').tab('show');
    });
    $('#clear').click(function() {
        if (confirm('Are you sure? Clearing will stop the current song.')) exec('clear');
    });
    $('#delete').click(function() {
        if (custom !== '' && confirm('Are you sure you want to delete playlist ' + custom + '?')) {
            exec('rm "' + custom + '"');
        }
        $('#tab-playlists').click();
        $('#tab-custom').hide();
    });
    $('#addall').click(function() {
        if ($('#playlist').val() == '') {
            var addcmd = lastsearch.replace(/^find/, 'findadd').replace(/^search/, 'searchadd');
            exec(addcmd);
            $('#tab-queue').tab('show');
        } else {
            $('.button-add').click();
        }
    });
    $(document).keydown(function(e) {
        if (!$(e.target).is('input')) {
            $('#search').focus();
        }
        var str = $('#search').val();
        if (e.which == 13) {
            e.preventDefault();
            if (str.length < 3 && !confirm('Are you sure? This might take a few seconds...')) {
                return;
            }
            if (str.match('^.+ ".+"$')) {
                exec('find ' + str);
                lastsearch = 'find ' + str;
            } else if (lastsearch == 'search any "' + str + '"') {
                var keys = ['title', 'artist', 'album'];
                $('#results tbody tr').each(function(i, tr) {
                    for (var i in keys) {
                        var data = $(tr).find('[data-key="' + keys[i] + '"]').data('value') || '';
                        data = data.toString().toLowerCase();
                        str = str.toLowerCase();
                        if (data == str) {
                            return;
                        }
                    }
                    $(tr).toggle();
                });
            } else {
                exec('search any "' + str + '"');
                lastsearch = 'search any "' + str + '"';
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
        exec('status');
    });
    $('#slider').mouseup(function() {
        if(state.state == 'stop') {
            exec('play');
            exec('pause 1');
        }
        exec('seekcur ' + $(this).val());
    });

    function init() {
        socket = new WebSocket(wsurl);
        window.socket = socket;

        socket.onopen = function(data) {
            exec('status');
            exec('playlistinfo');
            exec('list artist group album group date');
            exec('listplaylists');
        };

        socket.onclose = function(e) {
            setTimeout(init, 500);
        };

        socket.onmessage = function(e) {
            var data = JSON.parse(e.data);
            if (!data.cmd) return;
            var cmd = data.cmd.split(' ')[0];
            if (cmd == 'status') {
                console.log('got status');
                updateState(data.msg.toString());
                updateQueue();
            } else if (cmd == 'playlistinfo') {
                console.log('got queue');
                updateQueue(data.msg.toString());
                exec('status');
            } else if (cmd == 'list') {
                console.log('got albums');
                updateAlbums(data.msg.toString());
            } else if (cmd == 'listplaylists') {
                console.log('got playlists');
                updatePlaylists(data.msg.toString());
                if (custom !== '') {
                    exec('listplaylistinfo "' + custom + '"');
                }
            } else if (cmd == 'listplaylistinfo') {
                console.log('got custom');
                if (data.msg !== undefined) {
                    updateCustom(data.msg.toString());
                }
            } else if (cmd == 'search') {
                console.log('got results');
                updateResults(data.msg);
                $('#tab-results').click();
            } else if (cmd == 'find') {
                console.log('got results');
                updateResults(data.msg.toString());
                $('#tab-results').click();
            } else if (cmd == 'listplaylist') {
                console.log('got all playlists');
                var listname = data.cmd.match(/^listplaylist "(.*)"$/);
                console.log(listname);
                listname = listname[1];
                playlists[listname] = data.msg.toString();
            }
        };
    }
    setInterval(function() {
        if (state.state == 'play' && queue.length > 0 && state.song !== undefined && queue[state.song] !== undefined) {
            //elapsed += 0.1;
            elapsed = parseFloat(state.elapsed) + (new Date() - laststate) / 1000 + 0.5;
            elapsed = Number(elapsed.toFixed(3));
            if (!mousedown) {
                $('#slider').val(elapsed);
            }
            $('.song-elapsed').html(formatTime(elapsed));
            var total = queue[parseInt(state.song)].time;
            if (state.consume == '0' && state.repeat == '1') {
                $('#timeleft').html('');
                return;
            } else if (state.single == '0' && state.random == '0' && state.repeat == '0') {
                total = 0;
                for (i = state.song; i < queue.length; i++) {
                    total += parseInt(queue[i].time);
                }
            } else if (state.single == '1' && state.repeat == '0') {
                total = queue[parseInt(state.song)].time;
            } else if (state.consume == '1' && state.random == '1') {
                total = 0;
                for (i = 0; i < queue.length; i++) {
                    total += parseInt(queue[i].time);
                }
            }
            var left = total - elapsed;
            if (left > 60) {
                $('#timeleft').html(formatTime(left));
                $('title').html('&#9654; ' + formatTime(left));
            } else {
                $('#timeleft').html(left.toFixed(1));
                $('title').html('&#9654; ' + left.toFixed(0) + 's');
            }
        } else {
            $('#timeleft').html('');
            $('title').html('&#9632;');
        }
    }, 100);
    $(window).load(function() {
        $('#queue-table').rowSorter({
            onDrop: function(tbody, row, index, oldIndex) {
                if (tbody.id == 'queue-body') {
                    exec('move ' + oldIndex + ' ' + index);
                } else if (tbody.id == 'custom-body') {
                    exec('playlistmove "' + custom + '" ' + oldIndex + ' ' + index);
                    exec('listplaylistinfo "' + custom + '"');
                }
            }
        });
        $('#custom-table').rowSorter({
            onDrop: function(tbody, row, index, oldIndex) {
                if (tbody.id == 'queue-body') {
                    exec('move ' + oldIndex + ' ' + index);
                } else if (tbody.id == 'custom-body') {
                    exec('playlistmove "' + custom + '" ' + oldIndex + ' ' + index);
                    exec('listplaylistinfo "' + custom + '"');
                }
            }
        });
    });

    $('#controls button, #slider, #tab-queue').attr('disabled', 'disabled');
    $('#unlock').click(function() {
        locked = false;
        $('#controls button, #slider').removeAttr('disabled');
        $('#tab-queue').show();
        $('#lock').hide();
    });
    init();
});
