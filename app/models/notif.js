var mongoose = require('mongoose'),
Schema = mongoose.Schema,
Query = mongoose.Query,
ObjectId = Schema.ObjectId,
castToObjectId = mongoose.mongo.BSONPure.ObjectID;
async = require('async'),
util = require('util'),
_ = require('underscore'),
async = require('async');

function BaseNotifSchema() {
	Schema.apply(this, arguments);

	this.add({
		name: String,
		createdAt: { type: Date, default: Date.now },
		title: {
			type: String,
			required: true
		},
		content: {
			type: String,
			required: true
		},
		link: {
			type: String,
			required: true
		}
	});
}

util.inherits(BaseNotifSchema, Schema);

var NotifSchema = new BaseNotifSchema();

NotifSchema.methods.propagate = function (cb) {
	var self = this;
	ReactiveUser.find({}, function (err, users) {
		if (err || !users) {
			return cb(err || 'no users');
		}
		async.each(users, function (user, next) {
			if (!user) {
				return;
			}
			user.notifs.push({
				_id: self._id.toString(),
				read: false
			});
			user.save(next);
		});
		if (typeof cb === 'function') {
			cb(null);
		}
	});
}


var Notif = DbReactive.model('Notif', NotifSchema);
global.Notif = Notif;
global.BaseNotifSchema = BaseNotifSchema;
