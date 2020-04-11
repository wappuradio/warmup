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
var expressWs = require('express-uws')(app);
//var server = require('http').createServer(app);
/*var WSS = require('uws').Server;
var wss = new WSS({
    host: config.ws_host,
    port: config.ws_port
});*/
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
            res.status(400)
            res.send(msg);
            return;
        }
        res.setHeader('content-type', 'image/png');
        var filereg = /^file: (.*)$/gm;
        var file = filereg.exec(msg);
        if (file !== null) {
            var waveform = spawn('wav2png', ['-w', '1800', '-h', '100', '-b', '2e3338ff', '-f', '00000000', '-o', '/tmp/waveform.png', config.music_dir + '/' + file[1]]);
            waveform.on('close', function(code) {
                console.log('wav2png exited with code ' + code)
                res.sendFile('/tmp/waveform.png');
            })
        }
    });
});

//wss.on('connection', function(client, request) {
app.ws('/', function(ws, req) {
    console.log('Client connected...');
    ws.on('message', function(data) {
        var cmd = data.split(' ')[0];
        var cli = ws;

        var ip = ws._socket.remoteAddress.replace(/^::ffff:/i, '');
        var proxyForwardedFor = req.headers['x-forwarded-for'];
        var proxyAllowControl = req.headers['allow-control'];

        console.log(`Request from ${ip}, forwarded-for: ${proxyForwardedFor}, allow-control: ${proxyAllowControl}, command: ${cmd}`);

        if(config.trusted_proxies.indexOf(ip) != -1 && proxyForwardedFor) {
            // Use the original IP provided by a trusted proxy
            ip = proxyForwardedFor;
        }

        var allowControl = false;
        if(config.trusted_proxies.indexOf(ip) != -1 && proxyAllowControl) {
            if (proxyAllowControl === 'deny') {
                return;
            }
            if (proxyAllowControl === 'permit') {
                allowControl = true;
            }
        }

        if(ipRangeCheck(ip, config.whitelist) || config.safecommands.indexOf(cmd) != -1 || allowControl) {
            mpd.sendCommand(data, function(err, msg) {
                if (err) console.log(err);
                send(cli, data, msg);
            });
        }
    });
});

app.listen(config.http_port);
