
function Events() {
}

Events.prototype.joinRoom = function (req) {
	req.io.join(req.data);
    req.io.room(req.data).broadcast('notif', {
    	type: 'USER_JOINED',
        message: 'New client in the ' + req.data + ' room. '
    });
};

module.exports = new Events();