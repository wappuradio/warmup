#!/usr/bin/env node
try {
	require.resolve('./config');
} catch (e) {
	console.log('config.js is missing, check config.js.example');
	process.exit();
}
var config = require('./config');
var express = require('express');
var app = express();
var server = require('http').createServer(app);
var io = require('socket.io')(server);
var Mpd = require('mpd');
var basicAuth = require('basic-auth');
var mpd, recon;

mpd = Mpd.connect({
	host: config.mpd_host,
	port: config.mpd_port
});
mpd.on('end', function () {
	recon = setInterval(function () {
		console.log('MPD reconnecting');
		connect();
	}, 5000);
	console.log('MPD disconnected');
});
mpd.on('connect', function () {
	clearInterval(recon);
	console.log('MPD connected');
});
mpd.on('ready', function () {
	console.log('MPD ready');
});
mpd.on('system-player', function () {
	mpd.sendCommand('status', function (err, msg) {
		io.sockets.emit('status', {
			cmd: 'status',
			msg: msg
		});
	});
});
mpd.on('system-options', function () {
	mpd.sendCommand('status', function (err, msg) {
		io.sockets.emit('status', {
			cmd: 'status',
			msg: msg
		});
	});
});
mpd.on('system-playlist', function () {
	mpd.sendCommand('playlistinfo', function (err, msg) {
		io.sockets.emit('playlistinfo', {
			cmd: 'playlistinfo',
			msg: msg
		});
	});
});
mpd.on('system-stored_playlist', function () {
	mpd.sendCommand('listplaylists', function (err, msg) {
		io.sockets.emit('listplaylists', {
			cmd: 'listplaylists',
			msg: msg
		});
	});
});

var auth = function (req, res, next) {
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
app.get('/', auth, function (req, res, next) {
	res.sendFile(__dirname + '/index.html');
});

io.on('connection', function (client) {
	console.log('Client connected...');
	client.on('cmd', function (data) {
		console.log(data);
		var cli = client;
		var sent = data.split(' ')[0];
		mpd.sendCommand(data, function (err, msg) {
			if (err) console.log(err);
			cli.emit(sent, {
				msg: msg,
				cmd: data
			});
		});
	});
});

server.listen(config.http_port);
