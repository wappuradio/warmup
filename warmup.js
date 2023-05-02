#!/usr/bin/env node
"use strict";
try {
    require.resolve('./config');
} catch (e) {
    console.log('config.js is missing, check config.js.example');
    process.exit();
}
var config = require('./config');
var express = require('express');
var app = express();
var expressWs = require('express-ws')(app);
var Mpd = require('mpd');
var basicAuth = require('basic-auth');
var mpd, np = {
    song: ''
};
var spawn = require('child_process').spawn;
var ipRangeCheck = require("ip-range-check");

var send = function(me, cmd, data) {
    if (me && me.readyState === 1) {
        var json = JSON.stringify({
            cmd: cmd,
            msg: data
        });
        me.send(json);
    }
}

var broadcast = function(cmd, data) {
    expressWs.getWss().clients.forEach(function(me) {
        if (me && me.readyState === 1) {
            var json = JSON.stringify({
                cmd: cmd,
                msg: data
            });
            me.send(json);
        }
    });
}

mpd = Mpd.connect({
    host: config.mpd_host,
    port: config.mpd_port
});
mpd.on('error', function(err) {
    console.log(err);
});
mpd.on('end', function() {
    console.log('MPD disconnected, quitting');
    process.exit(0);
});
mpd.on('connect', function() {
    console.log('MPD connected');
});
mpd.on('ready', function() {
    console.log('MPD ready');
    if (config.mpd_pass !== '') {
        mpd.sendCommand('password ' + config.mpd_pass, function(err, msg) {
            console.log(msg);
        });
    }
});
mpd.on('system-player', function() {
    mpd.sendCommand('status', function(err, msg) {
        broadcast('status', msg);
    });
});
mpd.on('system-options', function() {
    mpd.sendCommand('status', function(err, msg) {
        broadcast('status', msg);
    });
});
mpd.on('system-playlist', function() {
    mpd.sendCommand('playlistinfo', function(err, msg) {
        broadcast('playlistinfo', msg);
    });
});
mpd.on('system-stored_playlist', function() {
    mpd.sendCommand('listplaylists', function(err, msg) {
        broadcast('listplaylists', msg);
    });
});
mpd.on('system-database', function() {
    mpd.sendCommand('count "(base \'usb\')"', function(err, msg) {
        broadcast('count', msg);
    });
});

var auth = function(req, res, next) {
    if (config.http_user === '' && config.http_pass === '') {
        return next();
    }

    function unauthorized(res) {
        res.set('WWW-Authenticate', 'Basic realm=Authorization Required');
        return res.sendStatus(401);
    }

    var user = basicAuth(req);

    if (!user || !user.name || !user.pass) {
        return unauthorized(res);
    }

    if (user.name === config.http_user && user.pass === config.http_pass) {
        return next();
    } else {
        return unauthorized(res);
    }
};

app.use(express.static(__dirname + '/bower_components'));
app.use(express.static(__dirname + '/static'));
app.get('/', auth, function(req, res, next) {
    res.sendFile(__dirname + '/index.html');
});
app.get('/np', function(req, res, next) {
    mpd.sendCommand('currentsong', function(err, msg) {
        res.setHeader('cache-control', 'no-cache');
        res.setHeader('content-type', 'text/plain; charset=utf-8');
        if (err) {
            res.send('');
            return;
        }
        var artistreg = /^Artist: (.*)$/gm;
        var titlereg = /^Title: (.*)$/gm;
        var artist = artistreg.exec(msg);
        var title = titlereg.exec(msg);
        if (artist !== null && title !== null) {
            np.song = artist[1].trim() + ' - ' + title[1].trim();
        } else {
            np.song = '';
        }
        res.send(np.song);
    });
});
app.get('/waveform', function(req, res, next) {
    mpd.sendCommand('currentsong', function(err, msg) {
        res.setHeader('cache-control', 'no-cache');
        if (err) {
            res.status(400);
            res.send(msg);
            return;
        }
        res.setHeader('content-type', 'image/png');
        var filereg = /^file: (.*)$/gm;
        var file = filereg.exec(msg);
        if (file !== null) {
            var waveform = spawn('ffmpeg', ['-y', '-i', config.music_dir + '/' + file[1], '-filter_complex', '[0:a]showwavespic=s=1800x200:scale=cbrt:colors=white,negate[a];color=#2e3338:1800x200[c];[c][a]alphamerge', '-frames:v', '1', '/tmp/waveform.png']);
            waveform.on('close', function (code) {
                console.log('ffmpeg exited with code ' + code)
                res.sendFile('/tmp/waveform.png');
            })
        }
    });
});

/**
 * Request playlist contents from MPD and broadcast to all clients
 */
function updatePlaylist(listNameQuoted) {
    const cmd = `listplaylist ${listNameQuoted}`;
    mpd.sendCommand(cmd, (err, msg) => {
        broadcast(cmd, msg);
    });
}

function handleCommand(cli, data) {
    const requestTime = new Date().getTime();
    var cmd = data.split(' ')[0];

    if (cmd == 'addrandom') {
        var mpd_conf = 'export MPD_PORT=' + config.mpd_port + ';export MPD_HOST=' + (config.mpd_pass != '' ? config.mpd_pass + '@' : '') + config.mpd_host + ';';
        spawn('sh', ['-c', mpd_conf + 'mpc listall | shuf -n 1 | mpc add']);
    } else {
        mpd.sendCommand(data, function(err, msg) {
           if (err) console.log(err);
            send(cli, data, msg);

            const responseDelay = new Date().getTime() - requestTime;
            console.log(`MPD responded to ${cmd} in ${responseDelay} ms`);

            if (cmd.startsWith('playlist') && cmd != 'playlistinfo') {
                // playlistadd/move/delete/etc. Likely caused a list to change so
                // broadcast the new list to other clients

                // Extract the first quoted argument, quotes included
                const listNameQuoted = data.match(/^playlist[^ ]+ ("[^"]+")/)[1];
                updatePlaylist(listNameQuoted);
            }
        });
    }
}

function isTrustedProxy(socketIp) {
    return config.trusted_proxies.indexOf(socketIp) != -1;
}

function getClientIp(socketIp, proxyForwardedFor) {
    if(isTrustedProxy(socketIp) && proxyForwardedFor) {
        return proxyForwardedFor;
    } else {
        return socketIp;
    }
}

app.ws('/', function(ws, req) {
    const proxyForwardedFor = req.headers['x-forwarded-for'];
    const proxyAllowControl = req.headers['allow-control'];
    const websocketProtocol = req.headers['sec-websocket-protocol'];

    const socketIp = ws._socket.remoteAddress.replace(/^::ffff:/i, '');
    const clientIp = getClientIp(socketIp, proxyForwardedFor);

    const allowControl = isTrustedProxy(socketIp) && proxyAllowControl === 'permit';
    const isWhitelisted = ipRangeCheck(clientIp, config.whitelist);

    // Whitelisted clients get a free pass
    if (!isWhitelisted && websocketProtocol != "warmup1") {
        // Drop clients with incompatible protocol version
        return ws.close();
    }

    console.log('Client connected...');

    ws.on('message', function(data) {
        const cmd = data.split(' ')[0];
        const isSafe = config.safecommands.indexOf(cmd) != -1;

        console.log(`Request from ${socketIp}, forwarded-for: ${proxyForwardedFor}, allow-control: ${proxyAllowControl}, command: ${data}`);

        if(isSafe || isWhitelisted || allowControl) {
            handleCommand(ws, data);
        } else {
            console.log('Denied');
        }
    });
});

app.listen(config.http_port);
