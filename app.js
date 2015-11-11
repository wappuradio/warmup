try {
	require.resolve('./config');
} catch(e) {
	console.log('config.js is missing, check config.js.example');
	process.exit();
}
var config = require('./config');
var DB_PATH = 'uploads';

var express = require('express');
var app = express();
var server = require('http').createServer(app);
var io = require('socket.io')(server);
var Mpd = require('mpd');
var FLAC = require('flac-parser');
var multer = require('multer');
var upload = multer({
	dest: 'uploads/'
});
var fs = require('fs');
var mkdirp = require('mkdirp');
var sanitize = require('sanitize-filename');
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
	clearInterval(recon);
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
  if(config.http_user == '' && config.http_pass == '') {
    return next();
  }

  function unauthorized(res) {
    res.set('WWW-Authenticate', 'Basic realm=Authorization Required');
    return res.sendStatus(401);
  };

  var user = basicAuth(req);

  if (!user || !user.name || !user.pass) {
    return unauthorized(res);
  };

  if (user.name === config.http_user && user.pass === config.http_pass) {
    return next();
  } else {
    return unauthorized(res);
  };
};

app.use(express.static(__dirname + '/bower_components'));
app.use(express.static(__dirname + '/static'));
app.get('/', auth, function (req, res, next) {
	res.sendFile(__dirname + '/index.html');
});

function moveFile(file) {
	var out = '';
	console.log(file.originalname, file.path);
	var stream = fs.createReadStream(file.path);
	var parser = stream.pipe(new FLAC());
	var artist, albumartist, album, title;
	parser.on('data', function (tag) {
		switch (tag.type) {
		case 'TITLE':
			title = tag.value;
			break;
		case 'ARTIST':
			artist = tag.value;
			break;
		case 'ALBUMARTIST':
			albumartist = tag.value;
			break;
		case 'ALBUM':
			album = tag.value;
			break;
		default:
		}
	});
	parser.on('finish', function () {
		artist = albumartist || artist;
		if (title && album && artist) {
			artist = sanitize(artist);
			album = sanitize(album);
			var filename = sanitize(file.originalname);
			var newdir = DB_PATH + '/' + artist + '/' + album;
			var newfile = newdir + '/' + filename;
			mkdirp(newdir, function (err) {
				if (err) {
					io.sockets.emit('upload', 'mkdirp ' + err);
					fs.unlink(file.path, function (err) {
						if (err) {
							io.sockets.emit('upload', 'unlink ' + err);
						}
					});
				} else {
					var input = fs.createReadStream(file.path);
					var output = fs.createWriteStream(newfile);
					var writer = input.pipe(output);
					writer.on('finish', function () {
						fs.unlink(file.path, function (err) {
							if (err) {
								io.sockets.emit('upload', 'unlink ' + err);
							}
						});
						io.sockets.emit('upload', 'Added ' + newfile);
					});
					writer.on('error', function (err) {
						io.sockets.emit('upload', 'writer ' + err);
					});
				}
			});
		} else {
			io.sockets.emit('upload', 'Error: no tags in ' + file.originalname);
			fs.unlink(file.path, function (err) {
				if (err) {
					io.sockets.emit('upload', 'unlink ' + err);
				}
			});
		}
	});
	parser.on('error', function (err) {
		if (err) {
			io.sockets.emit('upload', 'parser ' + err);
			fs.unlink(file.path, function (err) {
				if (err) {
					io.sockets.emit('upload', 'unlink ' + err);
				}
			});
		}
	})
};
app.post('/', auth, upload.array('files'), function (req, res, next) {
	for (var i in req.files) {
		moveFile(req.files[i]);
	}
	res.send('OK');
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
