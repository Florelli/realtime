var mongoose = require('mongoose'),
Schema = mongoose.Schema,
Query = mongoose.Query,
ObjectId = Schema.ObjectId,
_ = require('underscore'),
_s = require('underscore.string'),
async = require('async'),
crypto = require('crypto');

var ReactiveUserSchema = new Schema({
	email: {
		type: String,
		required: true,
		unique: true
	},
	firstname: {
		type: String,
		required: true
	},
	lastname: {
		type: String,
		required: true
	},
	phone: {
		type: String,
		required: true
	},
	createdAt: {
		type: Date,
		default: Date.now
	},
	lastConnection: {
		type: Date,
		default: Date.now
	},
	notifs: [{
		_id: {
			type: Schema.ObjectId,
			ref: 'Notif'
		},
		read: {
			type: Boolean,
			default: false
		}
	}]
}, {
	/* User schema option */
	toObject: {virtuals: true} // save virtual field after call toObject
});

ReactiveUserSchema.statics.createOrLogin = function (lbaUser, cb) {
	if (!lbaUser || !lbaUser.email) {
		cb('invalid lbaUser object');
		return;
	}
	async.waterfall([
		function findReactiveUser (next) {
			ReactiveUser.findOne({email:lbaUser.email}, next);
		}, function createOrSynchronize (user, next) {
			if (user) {
				user.firstname = lbaUser.firstname;
				user.lastname = lbaUser.lastname;
				user.phone = lbaUser.phone;
				user.lastConnection = new Date();
			} else {
				var data = {
					email: lbaUser.email,
					firstname: lbaUser.firstname,
					lastname: lbaUser.lastname,
					phone: lbaUser.phone,
				};
				user = new ReactiveUser(data);
			}
			user.save(next);
		}, function sendBack (user, next) {
			cb(null, user);
		}
	], function (error) {
		cb(error, null);
	})
}

ReactiveUserSchema.statics.checkSessionValidity = function (userSession, cb) {
	async.waterfall([
		function checkSession (next) {
			if (!userSession.email || !userSession.firstname || !userSession.lastname || !userSession.lastConnection) {
				next(true);
			} else {
				next();
			}
		}, function retrieveUser (next) {
			ReactiveUser.findOne({email:userSession.email, lastname:userSession.lastname, firstname:userSession.firstname}, function (error, user) {
				if (error || !user) {
					next(true);
				} else {
					next(null, user);
				}
			});
		}, function checkLoginTime (user, next) {
			var loginTime = new Date().getTime() - user.lastConnection.getTime();
			if (loginTime > 3600000) {
				next(true);
			} else {
				next();
			}
		}, function end (next) {
			cb(true);
		}
	], function (error) {
		cb(false);
	});
};

ReactiveUserSchema.methods.flushNotifs = function (cb) {
	for (var i = this.notifs.length; i-- > 0;) {
		this.notifs[i].read = true;
	}
	this.save(cb);
}

var ReactiveUser = DbReactive.model('ReactiveUser', ReactiveUserSchema);

global.ReactiveUser = ReactiveUser;
