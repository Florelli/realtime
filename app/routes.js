var site = require('./controllers/site');
var api = require('./controllers/api');
var events = require('./controllers/events');
var middleware = require('./controllers/middleware');

exports.apply = function (app) {
	// main routes
	app.get('/', [
		middleware.restrictedArea,
		site.index
	]);

	app.get('/login', [
		site.loginPage
	]);
	app.post('/login', [
		site.login
	]);

	// events
	app.io.route('join', events.joinRoom);

	// api
	app.get('/message/new', [
		middleware.checkApiToken,
		api.newMessage
	]);

	app.tcpSocket.on('data', function (data) {
		if (data && typeof data.toString == 'function' && typeof data.toString() == 'string') {
			data = data.toString();
			try {
				data = JSON.parse(data);
				api.handle(data, function (err) {
					if (err) {
						console.log(err);
					}
				});
			} catch(err) {
				console.log(err);
				return;
			}
			if (data.length < 2) {
				return;
			}
		}
	});

};