var express = require('express');
var app = express();
var server = require('http').createServer(app);
var io = require('socket.io')(server);
var Mpd = require('mpd');

var mpd = Mpd.connect({
	host: 'localhost',
	port: 6600
});
mpd.on('ready', function() {
	console.log('MPD ready');
});
/*mpd.on('system', function(name) {
	console.log('update', name);
});*/
mpd.on('system-player', function() {
	mpd.sendCommand('status', function(err, msg) {
		io.sockets.emit('status', msg);
	});
});
mpd.on('system-options', function() {
	mpd.sendCommand('status', function(err, msg) {
		io.sockets.emit('status', msg);
	});
});
mpd.on('system-playlist', function() {
	mpd.sendCommand('playlistinfo', function(err, msg) {
		io.sockets.emit('playlistinfo', msg);
	});
});

app.use(express.static(__dirname + '/bower_components'));
app.use(express.static(__dirname + '/static'));
app.get('/', function(req, res,next) {
	res.sendFile(__dirname + '/index.html');
});

io.on('connection', function(client) {
	console.log('Client connected...');
	client.on('cmd', function(data) {
		var cli = client;
		var sent = data.split(' ')[0];
		mpd.sendCommand(data, function(err, msg) {
			if (err) console.log(err);
			cli.emit(sent, msg);
		});
	});
})

server.listen(5353);