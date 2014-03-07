var async = require('async');

function Api () {
}

/**
@params:
	[ID] conv_id
	[ID] thread_number
	[NUMBER] msg_index
*/
Api.prototype.newMessage = function (req, res, nextRoute) {
	var threadNumber = req.param('thread_number', false);
	var conversationId = req.param('conv_id', false);
	var messageIndex = req.param('msg_index', false);
	async.waterfall([
		function checkParams (next) {
			var missingParams = [];
			if (!threadNumber) {
				missingParams.push('thread_number');
			}
			if (!conversationId) {
				missingParams.push('conv_id')
			}
			if (missingParams.length > 0) {
				var err = 'Missing parameter'+(missingParams.length > 1 ? 's' : '')+' '+missingParams.join(',');
				next(err);
			} else {
				next();
			}
		}, function createNotif (next) {
			MessageNotif.createNotif(conversationId, threadNumber, messageIndex, next);
		}, function end (notif, next) {
			app.io.broadcast('notif', {
				type:'NEW_MESSAGE',
				title: notif.title,
				content: notif.content,
				date: notif.createdAt,
				link: notif.link
			});
			res.json({success:true, message:'received'});
			notif.propagate(next);
		}
 	], function (error) {
		res.json({success:false, error:error});
	});
}

Api.prototype.requestHandlers = {
	newMessage: function (params, cb) {
		async.waterfall([
			function checkParams (next) {
				var missingParams = [];
				if (!params.threadNumber) {
					missingParams.push('threadNumber');
				}
				if (!params.conversationId) {
					missingParams.push('conversationId')
				}
				if (missingParams.length > 0) {
					var err = 'Missing parameter'+(missingParams.length > 1 ? 's' : '')+' '+missingParams.join(',');
					next(err);
				} else {
					next();
				}
			}, function createNotif (next) {
				MessageNotif.createNotif(params.conversationId, params.threadNumber, params.messageIndex, next);
			}, function end (notif, next) {
				app.io.broadcast('notif', {
					type:'NEW_MESSAGE',
					title: notif.title,
					content: notif.content,
					date: notif.createdAt,
					link: notif.link
				});
				notif.propagate(next);
			}
	 	], cb);
	}
}

Api.prototype.handle = function (request, cb) {
	if (typeof request !== 'object' || typeof request.type !== 'string' || typeof request.params === 'undefined') {
		cb('Invalid request format');
	}
	if (typeof this.requestHandlers[request.type] == 'function') {
		this.requestHandlers[request.type](request.params, cb);
	}
}

module.exports = new Api();
