var mongoose = require('mongoose'),
Schema = mongoose.Schema,
Query = mongoose.Query,
ObjectId = Schema.ObjectId,
castToObjectId = mongoose.mongo.BSONPure.ObjectID;
async = require('async'),
_ = require('underscore');

var MessageNotifSchema = new BaseNotifSchema({
	object: {
		type: Schema.ObjectId,
		ref: 'Message'
	}
});

MessageNotifSchema.statics.createNotif = function (conversationId, threadNumber, messageIndex, cb) {
	var date = new Date();
	Message
	.findOne({_id:conversationId})
	.populate('request', 'person date')
	.populate('order', 'time')
	.exec(function (err, msg) {
		if (err || !msg) {
			cb('Conversation '+conversationId+' not found');
		} else {
			msg.getNotifContent(threadNumber, messageIndex, function (err, content) {
				if (err || !content) {
					return cb(err || 'Thread number or message index invalid');
				}
				var data = {
					object: conversationId,
					title: msg.getConversationTitle(),
					content: content,
					link: msg.getThreadLink(threadNumber)
				};
				var messageNotif = new MessageNotif(data);
				messageNotif.save(cb);
			});
		}
	});
}

var MessageNotif = Notif.discriminator('MessageNotif', MessageNotifSchema);
global.MessageNotif = MessageNotif;
