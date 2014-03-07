
function Site() {
}

Site.prototype.index = function (req, res, next) {
	res.render('main/index.html');
};

Site.prototype.loginPage = function (req, res, next) {
	res.render('main/login.html');
};

Site.prototype.login = function (req, res, nextRoute) {
	var email = req.param('email', false);
	var password = req.param('password', false);
	var errors = {
		email: [],
		password: [],
		general: []
	};
	var self = this;
	async.waterfall([
		function checkParams (next) {
			if (!email) {
				errors.email.push('Missing parameter email');
			}
			if (!password) {
				errors.password.push('Missing parameter password');
			}
			if (errors.email.length + errors.password.length > 0) {
				next(true);
			} else {
				next();
			}
		},
		function auth (next) {
			User.authenticate(email, password, next);
		}, function retrieveReactiveUser(user, next) {
			if (!user) {
				next('User not found')
			} else {
				ReactiveUser.createOrLogin(user, next);
			}
		}, function fillSession (realUser, next) {
			app.io.broadcast('notif', {
				type:'USER_LOGIN',
				title: realUser.firstname+' just logged in',
				content: '',
				date: new Date()
			});
			req.session.user = realUser;
			res.redirect('/');
		}
	], function (error) {
		if (typeof error === 'string') {
			errors['general'].push(error);
		}
		res.locals.errors = errors;
		res.render('main/login.html');
	});
}


module.exports = new Site();