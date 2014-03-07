
function Middleware() {
}
Middleware.prototype.restrictedArea = function (req, res, next) {
	if (!req.session || !req.session.user) {
		res.redirect('/login');
	} else {
		ReactiveUser.checkSessionValidity(req.session.user, function (valid) {
			if (!valid) {
				res.redirect('/login');
			}
			next();
		});
	}
};
Middleware.prototype.checkApiToken = function (req, res, next) {
	if (req.param('token', '') !== 'ultrasecuretoken') {
		res.json({
			error: 'Request not allowed'
		});
		return;
	}
	next();
};

module.exports = new Middleware();