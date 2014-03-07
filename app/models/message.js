var mongoose = require('mongoose'),
crypto = require('crypto'),
Schema = mongoose.Schema,
Query = mongoose.Query,
ObjectId = Schema.ObjectId,
castToObjectId = mongoose.mongo.BSONPure.ObjectID;
async = require('async'),
_ = require('underscore'),
moment = require('moment');

var Msg = new Schema({
	date: Date,
	from: {
		type: Schema.ObjectId,
		ref: 'User'
	},
	msg: {
		type: String,
		required: true,
		set: nl2br
	},
	printRequest: Boolean,
	offers: [new Schema({
			offer: {
				type: Schema.ObjectId,
				ref: 'Offer'
			}
		})]
});

var toSchema = new Schema({
	user: {
		type: Schema.ObjectId,
		ref: 'User'
	},
	unread: {
		type: Number,
		default: 0
	},
	reminded: Number
});

var MessageSchema = new Schema({
	created: Date,
	updated: Date,
	request: {
		type: Schema.ObjectId,
		ref: 'Request'
	},
	order: {
		type: Schema.ObjectId,
		ref: 'Order'
	},
	threads: [{
		updated: Date,
		reference: {
			type: String,
			default: createReference,
			required: true
		},
		to: [toSchema],
		msgs: [Msg]
	}]
});

function nl2br(str) {
	return (str + '').replace(/(\r\n|\n\r|\r|\n)/g, '<br />');
}

function createReference() {
	return crypto.randomBytes(3).toString('hex').toUpperCase();
}

MessageSchema.methods.getConversationTitle = function () {
	var title = 'Conversation';
	if (typeof this.request === 'object') {
		title = 'Request for '+this.request.person+' persons for the '+moment(this.request.date).format('DD/MM');
	} else if (typeof this.order === 'object') {
		title = 'Order for the '+moment(this.order.time).format('DD/MM');
	}
	return title;
}

MessageSchema.methods.getThreadLink = function (threadnum) {
	var link = '/inbox/'+this._id;
	var currentThread = _.find(this.threads, function(t,i) {
		return (t.reference == threadnum);
	});
	link += '/'+currentThread.reference;
	return link;
}

MessageSchema.methods.getNotifContent = function (threadnum, msgIndex, cb) {
	var thread = _.find(this.threads, function(t,i) {
		return (t.reference == threadnum);
	});
	if (typeof thread === 'undefined') {
		return cb('Thread not found');
	}
	var msg = null;
	if (typeof msgIndex === 'undefined' || msgIndex === null || isNaN(parseFloat(msgIndex)) || !thread || !thread.msgs) {
		msg = thread.msgs[thread.msgs.length-1];
	} else {
		msg = thread.msgs[msgIndex];
	}
	if (typeof msg === 'undefined' || msg === null) {
		return cb('Message not found');
	}
	User
	.findById(msg.from)
	.select('firstname lastname')
	.exec(function (err, emitter) {
		var name = 'Unknow user';
		if (emitter) {
			name = emitter.firstname + ' ' + emitter.lastname;
		}
		var shortMsg = msg.msg.substr(0, 130);
		if (msg.msg.length > shortMsg.length) {
			shortMsg += '...';
		}
		var content = 'From '+name+': '+shortMsg;
		cb(null, content);
	});
}
/*
	Return all conversations for an user
*/
MessageSchema.statics.findByUser = function (userId, f, c) {
	var cb, find;
	if (arguments.length == 2) {
		cb = f;
	} else {
		cb = c;
		find = f;
	}

	var match = (userId === 'admin') ? {} : {'threads.to.user': castToObjectId.fromString(userId)};
	if (find) {
		match['threads.msgs.msg'] = {$regex: '(' + find + ')', $options: 'gi'};
	}

	/*
		Find conversation with participed threads

		We UNWIND each threads
		MATCH threads (exclude for user/chef)
		SORT by updated date
		GROUP by conversation id
		and finaly reSORT

		After we populate our USER/REQUEST/ORDER field (thx Mongoose 3.6)
		And Voila !
	*/
	Message.aggregate({
		$project: {
			updated: 1,
			threads: 1,
			request: 1,
			order: 1
		}
	}, {
		$unwind: '$threads'
	}, {
		$match: match
	}, {
		$sort: {'threads.updated': -1}
	}, {
		$group: {
			_id: {
				id: '$_id',
				request: '$request',
				order: '$order'
			},
			threads: {$push: '$threads'}
		}
	}, {
		$sort: {'threads.updated': -1}
	}, function (err, result) {
		if (err) {
			cb(err);
		} else {
			Message.populate(result, [{
				path: 'threads.to.user',
				model: 'User'
			}, {
				path: '_id.request',
				model: 'Request'
			}, {
				path: '_id.order',
				model: 'Order'
			}], function (err, r) {
				cb(err, r);
			});
		}
	});
};

/*
	Return the number of unread message
*/
MessageSchema.statics.getUnreadCount = function (userId, cb) {
	var unreadMessage = 0;
	Message.find({'threads.to.user': userId}).exec(function (err, m) {
		if (err) {
			cb(err);
		} else {
			_.each(m, function (m) {
				_.each(m.threads, function (t) {
					_.each(t.to, function (u) {
						if (u.user == userId) {
							unreadMessage += u.unread;
						}
					});
				});
			});
		}
		cb(null, unreadMessage);
	});
};

/*
	Update unread count by reading thread
*/
MessageSchema.statics.read = function(conversation, thread, user, cb) {
	Message.findById(conversation, function(err, c) {
		if (err || !c) {
			cb(err || 'no conversation with %s id', conversation);
		} else {
			var currentThread = _.find(c.threads, function(t) {
				return (t.reference == thread);
			});
			if (currentThread) {
				_.each(currentThread.to, function(t) {
					if (JSON.stringify(user) === JSON.stringify(t.user)) {
						t.unread = 0;
					}
				});
				c.save(function(err) {
					if (err) {
						cb(err);
					} else {
						Message.getUnreadCount(user, cb);
					}
				});
			} else {
				cb('incorrect thread number');
			}
		}
	});
};

var Message = DbLBA.model('Message', MessageSchema);

global.Message = Message;
