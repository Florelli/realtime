express = require('express.io');
app = express().http().io();
ejs = require('ejs');


express = require('express.io');
app = express().http().io();
var moment = require('moment'),
mongoose = require('mongoose'),
async = require('async'),
RedisStore = require('connect-redis')(express),
log4js = require('log4js');
var logger = log4js.getLogger();

app.crypto = crypto = require('crypto');

app.engine('html', require('ejs').renderFile);
app.set('views', __dirname + '/views');
app.use(express.logger('dev'));
app.use(express.cookieParser());
app.use(express.bodyParser());
app.use(express.session({
	secret: "Is3cr3tlyl0v3H3ll0ki77yU",
	cookie: { maxAge: 1000 * 60 * 60 * 24 * 365 },
	store: new RedisStore()
}));
app.use(express.static(__dirname + '/public', {
	maxAge: 86400000, // one day
	redirect: false
}));
app.use(function (req, res, next) {
	res.locals({
		title: 'Realtime App',
		path: req.url.split('?')[0],
		moment: moment,
		session:req.session
	});
	next();
});

app.listen(7000);


async.parallel({
	tcpSocket: function (callback) {
		require('net').createServer(function (socket) {
			callback(null, socket);
		}).listen(7002);
	},
	DbLBA: function (callback) {
		var db = mongoose.createConnection('mongodb://localhost/lba_data').on('open', function (err) {
			if (err) {
				callback('Can not connect to database "lba_data"');
			} else {
				logger.info('Successfully connected to database "chef_fr"');
				callback(null, db);
			}
		});
	},
	DbReactive: function (callback) {
		var DbReactive = mongoose.createConnection('mongodb://localhost/lba_realtime').on('open', function (err) {
			if (err) {
				callback('Can not connect to database "lba_realtime"');
			} else {
				logger.info('Successfully connected to database "lba_realtime"');
				callback(null, DbReactive);
			}
		});
	}
}, function (err, result) {
	if (err) {
		throw err;
		logger.error(err);
		process.exit(11);
	} else {
		global.DbLBA = result.DbLBA;
		global.DbReactive = result.DbReactive;
		app.tcpSocket = result.tcpSocket;
		// LBA models
		require('./models/user');
		require('./models/order');
		require('./models/request');
		require('./models/message');

		// Reactive models
		require('./models/reactiveUser');
		require('./models/notif');
		require('./models/messageNotif');

		require('./routes').apply(app);
		var port = process.env.PORT || 7000;
		logger.info('server listening on port ', port);
		app.listen(port);
	}
});
