var mongoose = require('mongoose'),
Schema = mongoose.Schema,
moment = require('moment'),
ObjectId = Schema.ObjectId,
async = require('async'),
_ = require('underscore');

/*
	For Fixed Menu
		* title: title name
		* Section: copy of the sections menu
			* name: section name
			* dishes: Array of dishes' section' name
		* Quantity: aka person number
		* PPU: from fixedPriceMap

	For an A la carte (old)
		* title: from the menu
		* dishes: Array of selected dishes
			* Name
			* Quantity
			* Price: Unit price

	For an option (futur)
		* title
		* reference (probably): reference to a new collections of options
		* quantity
		* PPU
*/
var OrderItem = new Schema({
	type: {
		type: String,
		required: true
	},
	title: String,
	link: String,
	menu: { type: Schema.ObjectId, ref: 'Menu' },
	dish: String,
	hash: String,
	number: String,
	dishType: String,
	sections: [{
		dishes: [{
			name: String
		}],
		title: {
			type: String,
			required: true
		}
	}],
	dishes: [{
		name: String,
		quantity: Number,
		ppu: Number
	}],
	section: String,
	quantity: {
		type: Number,
		required: true
	},
	commission: Number,
	ppu: {
		type: Number,
		required: true
	}
});

var OrderSchema = new Schema({
	createdAt: Date,
	updated: Date,
	user: { type: Schema.ObjectId, ref: 'User' }, /* Reference to the user who paid. Customer can be different */
	chef: { type: Schema.ObjectId, ref: 'User' }, /* Reference to the chef */
	day: String, /* Day and hours is use during search */
	hours: String,
	time: Date, /* Real date+time of the prestation */
	log: [{
		msg: String,
		date: Date
	}],
	status: {
		type: String,
		default: 'PAYMENT_PROCESSING',
		enum: [
			'ORDER_PROCESSING',
			'PAYMENT_PROCESSING',
			'PAYMENT_ABANDONED',
			'CONFIRMED',
			'ACCEPTED_BY_CHEF',
			'ACCEPTED_BY_ADMIN',
			'REJECTED_BY_CHEF',
			'REJECTED_BY_ADMIN',
			'AWAITING_FEEDBACK',
			'FEEDBACK_RECEIVED',
			'FAIL',
			'ARCHIVED'
		]
	},
	activationCode: String, /* reference passed to the bank */
	minOrder: Number,
	customer: {
		firstname: String,
		lastname: String,
		company: String,
		phone: {
			type: String,
			set: noSpace
		},
		address: {
			lineFirst: String,
			lineSecond: String,
			postcode: String,
			city: String
		},
		instructions: String
	},
	billing: {
		firstname: String,
		lastname: String,
		company: String,
		phone: {
			type: String,
			set: noSpace
		},
		address: {
			lineFirst: String,
			lineSecond: String,
			postcode: String,
			city: String
		}
	},
	items: {
		type: [OrderItem],
		default: []
	},
	total: { /* Total price for all items without commission/discount */
		type: Number,
		default: 0
	},
	commission: { /* Calculate from the Settings and stock for preving changement */
		chef: {
			type: Number,
			default: 0
		},
		client: {
			type: Number,
			default: 0
		}
	},
	fee: Number, /* Calculate from the Settings and stock for preving changement */
	discount: {
		id: { type: Schema.ObjectId, ref: 'Discount' },
		amount: Number /* Calculate from the Settings and stock for preving changement */
	},
	instructions: String,
	rating: Number,
	review: {
		type: String,
		set: setReview
	},
	privateReview: {
		type: String,
		set: setReview
	},
	chefNotes: {
		type: String
	},
	reviewDate: Date,
	offer: {
		type: Schema.ObjectId,
		ref: 'Offer'
	},
	person: Number, /* Number of people can be differents that number of quantity of an items */
	guests: [{
		mail: String,
		dueAmount: Number,
		token: String
	}],
	activatedGuests: [{
		user: { type: Schema.ObjectId, ref: 'User' },
		dueAmount: Number,
		feedbackStatus: {
			type: String,
			default: 'GUEST_DEFAULT'
		},
		feedbackRating: Number,
		feedbackReview: {
			type: String,
			set: setReview
		},
		privateReview: {
			type: String,
			set: setReview
		},
		feedbackDate: Date,
		transactions: [{
			date: Date,
			amount: Number,
			discount: {type: Schema.ObjectId, ref: 'Discount'}
		}],
		feedbackReminded: Number
	}],
	feedbackReminded: Number,
	accepteReminded: Number
});

function setReview(review) {
	return review.replace(/(<([^>]+)>)/ig, '');
}

function noSpace(v) {
	return v.replace(/\s/g, '');
}

OrderSchema.virtual('customer.name').get(function () {
	return this.customer.firstname + ' ' + this.customer.lastname;
});

OrderSchema.virtual('customer.fullname').get(function () {
	return this.customer.firstname + ' ' + this.customer.lastname;
});

/*
	For chef: menu Price * person - lba chef commission
*/
OrderSchema.virtual('totalChef').get(function () {
	return this.total - this.commission.chef;
});

/*
	For client: Adjusted menu price ( (menu price - lba client commission) * person) + fee - discount
*/
OrderSchema.virtual('totalClient').get(function () {
	var discount = (this.discount.amount) ? this.discount.amount : 0;
	var around = Math.round( ( this.total + this.commission.client + this.fee - discount) * 100) / 100;
	return (around > 0)? around : 0;
});

/*
	For LBA:
*/
OrderSchema.virtual('totalLBA').get(function () {
	var discount = (this.discount && this.discount.amount) ? this.discount.amount : 0;
	return this.commission.client + this.commission.chef + this.fee - discount;
});

OrderSchema.virtual('hash').get(function () {
	if (this.items && this.items.length > 0 && this.chef) {
		var m = moment(this.time);
		var chefId = this.chef;
		var menuId = this.items[0].menu;
		if (this.chef._id)
			chefId = this.chef._id;
		if (this.items[0].menu._id)
			menuId = this.items[0].menu._id;
		return m.format('YYMMDD-HHmm')+'-'+chefId+'-ch-'+menuId;
	} else {
		return false;
	}
});

OrderSchema.virtual('totalItems').get(function () {
	var nb = 0;
	this.items.forEach(function (item, index) {
		if (typeof item.hash !== 'undefined' || item.type !== 'ALACARTE') {
			nb += parseInt(item.quantity, 10);
		}
	})
	return nb;
});



/*
	Used if we want give an url ready to pay
	Need to find an other way beacause it's deprecated cause of items[]
	we can't pull all item in a url

	YYMMDD-HHmm-chef._id-ch-items[0]._id
*/
OrderSchema.virtual('formatedHours').get(function () {
	return moment(this.time).format('HH:mm');
});

OrderSchema.virtual('formatedDate').get(function () {
	return moment(this.time).format('DD/MM/YYYY');
});

OrderSchema.statics.generateTotal = function (order, cb) {
	async.parallel({
		client: function (next) {
			Settings.findByName('clientCommission', next);
		},
		chef: function (next) {
			Settings.findByName('chefCommission', next);
		}
	}, function (err, result) {
		/*
			We arround the PPU so the client commission is
				totalWithCommision - order.total
			the save PPU is still the real but we can have the PPU shown by
				item.ppu + (cart.commission.client / item.quantity)
		*/

		var totalWithCommision = _.reduce(order.items, function (total, i) {
			if (i.type === 'FIXEDMENU' || i.type === 'ALACARTE' || i.type === 'UNIQUEPRICE') {
				if (typeof i.commission !== 'undefined' && i.commission !== null)
					return total + (i.ppu + i.commission) * i.quantity;
				else
					return total + i.ppu * i.quantity;
			}
		}, 0);
		order.total = _.reduce(order.items, function (total, i) {
			if (i.type === 'FIXEDMENU' || i.type === 'ALACARTE' || i.type === 'UNIQUEPRICE') {
				return total + (i.ppu * i.quantity);
			}
		}, 0);
		order.commission = {
			client: totalWithCommision - order.total,
			chef: order.total * (result.chef / 100)
		};
		cb(null, order);
	});
};


OrderSchema.methods.logging = function (msg) {
	this.log.push({
		msg: msg,
		date: Date.now()
	});
};

/*
	Status methods
*/
OrderSchema.methods.changeStatus = function (status, cb) {
	var oldStatus = this.status;
	this.status = status;
	this.logging('Status '+oldStatus+' to '+status);
	this.save(function (err, o) {
		cb(err, o);
	});
};

OrderSchema.methods.confirmed = function (cb) {
	this.changeStatus('CONFIRMED', cb);
};

OrderSchema.methods.accepted_by_chef = function (cb) {
	this.changeStatus('ACCEPTED_BY_CHEF', cb);
};

OrderSchema.methods.accepted_by_admin = function (cb) {
	this.changeStatus('ACCEPTED_BY_ADMIN', cb);
};

/*
	Add items methods
*/

OrderSchema.methods.removeItem = function(index) {
	if (this.items.length > index && typeof this.items[index] !== 'undefined') {
		this.items.splice(index, 1);
		return true;
	}
	return false;
}

/*
	Please use the addFixedMenu method which is a shortcut for this method with security checks.
*/
OrderSchema.methods.addMenuItem = function (data, cb) {
	var self = this;
	Settings.findByName('clientCommission', function (error, commission) {
		if (error || !commission) {
			cb(err || 'no commission found');
		} else {
			var i = new OrderItem({
				type: data.type,
				menu: data.menu._id,
				title: data.menu.title,
				sections: data.sections,
				quantity: data.quantity,
				commission: Order.getComm(data.ppu, commission),
				ppu: data.ppu
			});
			self.items.push(i);
			cb(null, self);
		}
	});
};

/*
	Please use the addDish method which is a shortcut for this method with security checks.
*/
OrderSchema.methods.addDishItem = function (menuId, item, quantity, ppu, cb) {
	var self = this;
	Settings.findByName('clientCommission', function (error, commission) {
		var i = new OrderItem({
			type: "ALACARTE",
			menu: menuId,
			dish: item.dish,
			title: item.dish,
			quantity: quantity,
			number: item.quantity,
			dishType: item.type,
			commission: Order.getComm(item.ppu, commission),
			ppu: item.ppu,
			hash: item.hash
		});
		self.items.push(i);
		cb(null, self);
	});
};

OrderSchema.methods.addFixedMenu = function (menu, choices, quantity, cb) {
	var self = this;
	if (typeof choices === 'undefined') {
		choices = null;
	}
	if (menu === undefined) {
		cb('unknow menu');
	} else {
		var data = {
			type: 'FIXEDMENU',
			menu: menu,
			sections: Order.filterSections(menu.sections, choices),
			quantity: quantity,
			ppu: menu.getPPP(quantity)
		};
		self.addMenuItem(data, cb);
	}
};

OrderSchema.methods.addUniquePriceMenu = function (menu, cb) {
	var self = this;
	if (menu === undefined) {
		cb('unknow menu');
	} else {
		var data = {
			type: 'UNIQUEPRICE',
			menu: menu,
			sections: Order.filterSections(menu.sections, null),
			quantity: 1,
			ppu: menu.uniquePrice
		};
		self.addMenuItem(data, cb);
	}
};


OrderSchema.methods.addDish = function (menuId, dishHash, quantity, cb) {
	var self = this;
	Menu.findOne({_id: menuId}, function(err, m){
		if (err || m === undefined) {
			cb(err || 'unknow menu');
		} else {
			var dish = m.findDishByHash(dishHash);
			if (dish) {
				dish.hash = dishHash;
				self.addDishItem(m._id, dish, quantity, cb);
			} else {
				cb('this dish doesn\'t exist in this menu');
			}
		}
	});
};

// STATIC METHODS

OrderSchema.statics.filterSections = function (origin, choices) {
	var sections = [];
	origin.forEach(function (menuSection, index) {
		var section = {};
		section.title = menuSection.name;
		section.dishes = [];
		menuSection.dishes.forEach(function (dish, dishIndex) {
			if (!menuSection.choiceMode || (choices && typeof choices['section-'+index] !== 'undefined' && parseInt(choices['section-'+index], 10) === dishIndex)) {
				section.dishes.push({name:dish.dish});
			}
		});
		sections.push(section);
	});
	return sections;
};


/*
	Please use the addDish method which is a shortcut for this method with security checks.
*/
OrderSchema.statics.addDishItem = function (order, menuId, item, quantity, cb) {
	Settings.findByName('clientCommission', function (error, commission) {
		var i = new OrderItem({
			type: "ALACARTE",
			menu: menuId,
			dish: item.dish,
			title: item.dish,
			quantity: quantity,
			number: item.quantity,
			dishType: item.type,
			commission: Order.getComm(item.ppu, commission),
			ppu: item.ppu,
			hash: item.hash
		});
		order.items.push(i);
		cb(null, order);
	});
};

OrderSchema.statics.addDish = function (order, menuId, dishHash, quantity, cb) {
	Menu.findOne({_id: menuId}, function(err, m){
		if (err || m === undefined) {
			cb(err || 'unknow menu');
		} else {
			var dish = m.findDishByHash(dishHash);
			if (dish) {
				dish.hash = dishHash;
				Order.addDishItem(order, m._id, dish, quantity, cb);
			} else {
				cb('this dish doesn\'t exist in this menu');
			}
		}
	});
}

OrderSchema.statics.plusMenuItem = function (order, menuId, cb) {
	var item = null;

	Settings.findByName('clientCommission', function (error, commission) {
		Menu.findById(menuId, function (err, m) {
			if (err || !m) {
				cb(err || 'no menu with id '+menuId);
			} else {
				_.each(order.items, function (i) {
					if (JSON.stringify(i.menu) === JSON.stringify(menuId)) {
						item = i;
						i.quantity++;
						i.ppu = m.getPPP(i.quantity);
						i.commission = Order.getComm(i.ppu, commission);
					}
				});
				if (item !== null) {
					order.person = item.quantity;
					Order.generateTotal(order, function (err, order) {
						cb(err, item, order);
					});
				} else {
					cb('no item');
				}
			}
		});
	});
};

OrderSchema.statics.plusDishItem = function (order, menuId, dishHash, cb) {
	async.waterfall([
		function incrementItemQuantity(next) {
			var item = null;
			_.each(order.items, function (i) {
				if (typeof i.hash !== 'undefined' &&  i.hash.localeCompare(dishHash) === 0 && JSON.stringify(i.menu) === JSON.stringify(menuId)) {
					item = i;
					i.quantity++;
				}
			});
			next(null, item);
		}, function orAddItemToOrder(item, next) {
			if (item == null) {
				Menu.findOne({_id:menuId}, function (err, menu) {
					if (err || !menu) {
						cb(err || 'menu not found');
					} else {
						Order.addDish(order, menu._id, dishHash, 1, function(err, o) {
							if (!err)
								next(null, o, o.items[o.items.length-1]);
							else
								next(err);
						});
					}
				});
			} else {
				next(null, order, item);
			}
		}, function thenUpdateOrderPrice(order, item, next) {
			Order.generateTotal(order, function (err, o) {
				cb(err, item, o);
			});
		}
	], function error(err) {
		cb(err);
	})
}

OrderSchema.statics.plusItem = function (type, order, menuId, hash, cb) {
	if (type == 'FIXEDMENU') {
		Order.plusMenuItem(order, menuId, cb);
	} else if (type =='ALACARTE') {
		Order.plusDishItem(order, menuId, hash, cb);
	} else {
		cb(null, null, order);
	}
}

OrderSchema.statics.minusMenuItem = function (order, menuId, cb) {
	var item = null;
	Settings.findByName('clientCommission', function (error, commission) {
		Menu.findById(menuId, function (err, m) {
			if (err || !m) {
				cb(err || 'no menu with id '+menuId);
			} else {
				_.each(order.items, function (i) {
					if (JSON.stringify(i.menu) === JSON.stringify(menuId)) {
						if (i.quantity > 2) {
							item = i;
							i.quantity--;
							i.ppu = m.getPPP(i.quantity);
							i.commission = Order.getComm(i.ppu, commission);
						}
					}
				});
				if (item !== null) {
					order.person = item.quantity;
					Order.generateTotal(order, function (err, order) {
						cb(err, item, order);
					});
				} else {
					cb('no item');
				}
			}
		});
	});
};

OrderSchema.statics.updateMenuItem = function (order, menu, quantity, choiceSections, cb) {
	var item = null;
	if (quantity < 2) {
		quantity = 2;
	}
	if (typeof cb === 'undefined' && typeof choiceSections === 'function') {
		cb = choiceSections;
		choiceSections = null;
	}
	Settings.findByName('clientCommission', function (error, commission) {
		_.each(order.items, function (i) {
			if (JSON.stringify(i.menu) === JSON.stringify(menu._id)) {
				item = i;
				i.quantity = quantity;
				i.ppu = menu.getPPP(i.quantity);
				i.commission = Order.getComm(i.ppu, commission);
				if (choiceSections) {
					i.sections = Order.filterSections(menu.sections, choiceSections);
				}
			}
		});
		if (item !== null) {
			order.person = item.quantity;
			Order.generateTotal(order, function (err, order) {
				cb(err, item, order);
			});
		} else {
			cb('no item');
		}
	});
};


OrderSchema.statics.minusDishItem = function (order, menuId, dishHash, cb) {
	var item = null;
	_.each(order.items, function (i, index) {
		if (typeof i.hash !== 'undefined' &&  i.hash.localeCompare(dishHash) === 0 && JSON.stringify(i.menu) === JSON.stringify(menuId)) {
			if (i.quantity > 1) {
				item = i;
				i.quantity--;
			} else {
				item = i;
				Order.removeItem(order, index);
			}
		}
	});
	if (item !== null) {
		Order.generateTotal(order, function (err, order) {
			cb(err, item, order);
		});
	} else {
		cb('no item');
	}
};



OrderSchema.statics.minusItem = function (type, order, menuId, hash, cb) {
	if (type == 'FIXEDMENU') {
		Order.minusMenuItem(order, menuId, cb);
	} else if (type =='ALACARTE') {
		Order.minusDishItem(order, menuId, hash, cb);
	}
}

OrderSchema.statics.removeItem = function(order, index) {
	if (order.items.length > index && typeof order.items[index] !== 'undefined') {
		order.items.splice(index, 1);
		return true;
	}
	return false;
}

OrderSchema.statics.getComm = function (ppu, percentage) {
	var ppuWithComm = ppu + (ppu * (percentage / 100));
	if (ppu >= 10) {
		ppuWithComm = Math.ceil(ppuWithComm);
	} else {
		ppuWithComm = Math.ceil(ppuWithComm*10)/10;
	}
	var comm = ppuWithComm-ppu;
	return comm;
}

/*
	Save order to the right place
	* If un-loggued to session

	* If loggued to db
		and set a reference in session for recover later

*/
OrderSchema.methods.saveMe = function (req, cb) {
	if (req.session && req.session.user) {
		/*
			Client is loggued
			We save to db and put a token to session for recover
			the token is the activationCode, use later for bank
		*/
		Order.generateTotal(this, function (err, order) {
			order.activationCode = crypto.randomBytes(7).toString('hex');
			order.save(function (err, order) {
				if (err) {
					cb(err);
				} else {
					req.session.order = undefined;
					req.session.activationCode = order.activationCode;
					Order.populate(order, [{path:'items.menu', model:'Menu', select:'title slug'}, {path:'chef', model:'User'}], function(err, o) {
						cb(err, o);
					});
				}
			});
		});
	} else {
		/*
			Client isn't loggued
			we save order in session
		*/
		var order = this.toJSON({getters: true});
		Order.generateTotal(order, function (err, order) {
			/*
				Beacause order is toJSON before
				we update virtual field manuely
			*/
			order.totalClient = (function(order) {
				var discount = (order.discount && order.discount.amount) ? order.discount.amount : 0;
				var around = Math.round( ( order.total + order.commission.client + order.fee - discount) * 100) / 100;
				return (around > 0)? around : 0;
			})(order);

			req.session.order = order;

			/* /!\ WARNING /!\
			* MAKE SURE YOUR ITEM IS NOT ALREADY POPULATED
			*/
			Order.unpopulate(req.session.order, ['chef', 'items.menu'], function(err, order) {
				Order.populate(order, [{path:'items.menu', model:'Menu', select:'title slug'}, {path:'chef', model:'User'}], function(err, o) {
					cb(null, o);
				});
			});

		});
	}
};

OrderSchema.statics.updateMe = function (req, order, cb) {
	if (req.session && req.session.user) {
		Order.findOne({activationCode: order.activationCode}, function(err, o){
			if (err || !o) {
				cb(err || 'no order');
			} else {
				o.set(order);
				o.updated = Date.now();
				o.save(function (err, o) {
					if (err || !o) {
						cb(err, null);
					} else {
						Order.populate(o, [{path:'items.menu', model:'Menu', select:'title slug'}, {path:'chef', model:'User', select:'slug'}], function(err, order) {
							cb(err, order);
						});
					}
				});
			}
		});
	} else {
		order.updated = Date.now();
		order.totalClient = (function(order) {
			var discount = (order.discount && order.discount.amount) ? order.discount.amount : 0;
			var around = Math.round( ( order.total + order.commission.client + order.fee - discount) * 100) / 100;
			return (around > 0)? around : 0;
		})(order);
		order.totalItems = 0;
		order.items.forEach(function (item, index) {
			if (typeof item.hash !== 'undefined' || item.type !== 'ALACARTE') {
				order.totalItems += parseInt(item.quantity, 10);
			}
		});
		req.session.order = order;

		/* /!\ WARNING /!\
		* MAKE SURE YOUR ITEM IS NOT ALREADY POPULATED
		*/

		Order.unpopulate(req.session.order, ['chef', 'items.menu'], function(err, order) {
			Order.populate(order, [{path:'items.menu', model:'Menu', select:'title slug'}, {path:'chef', model:'User', select:'slug'}], function(err, o) {
				cb(err, o);
			});
		});
	}
};

/*
	After a login/registration
	We transfere the order in session in db
	& put a token to session for recover
*/
OrderSchema.statics.transferMe = function (req, orderSession, cb) {
	orderSession.chef = orderSession.chef._id;
	var order = new Order(orderSession);

	order.user = req.session.user._id;
	order.activationCode = crypto.randomBytes(7).toString('hex');
	order.save(function (err, o) {
		if (err) {
			cb(err);
		} else {
			req.session.order = undefined;
			req.session.activationCode = o.activationCode;
			cb(null, req.session.activationCode);
		}
	});
};

/*
	Try to load Order depending of user
	If it's a loggued user, from db
	if not, from session

	The classic schema is: use the order unpopulated on the server, then populate it before to send it to the client.
	The order should always be unpopulated before use and then repopulated after saving or updating, except in particular cases.

*/
OrderSchema.statics.loadMe = function (req, populate, cb) {
	if (typeof populate === 'function') {
		cb = populate;
		populate = false;
	}
	if (req.session && req.session.user) {
		if (req.session.activationCode) {
			var query = Order.findOne({activationCode: req.session.activationCode});
			if (populate) {
				query.populate('chef').populate('user').populate('items.menu', 'title slug');
			}
			query.exec(function (err, order) {
				if (err)
					cb(err);
				else
					Order.checkMe(order, cb);
			});
		} else {
			cb('no_order');
		}
	} else {
		Order.unpopulate(req.session.order, ['chef', 'items.menu'], function(err, order) {
			Order.checkMe(order, function (err, order) {
				if (err) {
					cb(err, order);
				} else if (!order) {
					cb('no order', null);
				} else if (populate) {
					Order.populate(req.session.order, [{path:'chef', model:'User'},{path:'user', model:'User'}, {path:'items.menu', model:'Menu', select:'title slug'}], function(err, order) {
						cb(err, order);
					});
				} else {
					cb(null, order);
				}
			});
		});
	}
};

/*
	If the order is for a menu 'ALACARTE', checks all
	dishes and remove the ones that have been modified
*/
OrderSchema.statics.checkMe = function (order, cb) {

	if (!order) {
		cb('no_order');
		return;
	}

	function recursiveRemoving(menu, o) {
		for (var i = 1, len = o.items.length; i < len; i++) { // <- starts at index 1 because the first item is the menu
			if (menu.findDishByHash(o.items[i].hash) == null) {
				Order.removeItem(o, i);
				recursiveRemoving(menu, o);
				break;
			}
		}
		return o;
	}

	if (order.items.length > 0 && order.items[0].type === 'ALACARTE') {
		Menu.findOne({_id:order.items[0].menu}, function (err, menu) {
			var itemLength = order.items.length;

			if (err || !menu)
				order.items.length = 0;
			else
				order = recursiveRemoving(menu, order);

			if (order.items.length !== itemLength) {
				Order.generateTotal(order, function (err, o) {
					/*
						Beacause o is toJSON before
						we update virtual field manuely
					*/
					o.totalClient = (function(o) {
						var discount = (o.discount && o.discount.amount) ? o.discount.amount : 0;
						var around = Math.round( ( o.total + o.commission.client + o.fee - discount) * 100) / 100;
						return (around > 0)? around : 0;
					})(o);
					cb(null, o);
				});
			} else {
				cb(null, order);
			}
		});
	} else {
		cb(null, order);
	}
};

OrderSchema.statics.unpopulate = function (order, paths, cb) {

	if (!order) {
		cb('no order', null);
		return;
	}

	function processUnpopulate (path) {
		var way = path.split('.');
		var item = order;
		for (var w = 0, l = way.length; w < l; w++) {
			var subitem = item[way[w]];
			if (typeof subitem === 'undefined' || subitem === null) {
				break;
			}
			if (subitem instanceof Array) {
				for (var t = 0, l2 = subitem.length; t < l2; t++) {
					var row = subitem[t];
					if (way[w+1]&& row[way[w+1]] && row[way[w+1]]._id) {
						var id = _.clone(row[way[w+1]]._id.toString());
						row[way[w+1]] = id;
					}
				}
				break;
			}
			if (subitem instanceof Object && l-w > 1) {
				continue;
			}
			if (subitem && subitem._id) {
				var id = _.clone(item[way[w]]._id.toString());
				item[way[w]] = id;
			}
			item = item[way[w]];
		}
	}
	if (paths instanceof Array) {
		for (var p = 0, l = paths.length; p < l; p++) {
			if (paths[p])
				processUnpopulate(paths[p].toString());
		}
		cb(null, order);
	} else if (paths) {
		processUnpopulate(paths.toString());
		cb(null, order);
	} else {
		cb('invalid path argument', order);
	}
}

/*
	Destroy order
*/
OrderSchema.statics.destroyMe = function (req, order, cb) {
	if (req.session && req.session.user) {
		Order.remove({activationCode: req.session.activationCode}, function(){
			req.session.activationCode = undefined;
			req.session.order = undefined;
			cb();
		});
	} else {
		req.session.order = undefined;
		cb();
	}
};

OrderSchema.statics.activateGuest = function(userId, orderId, token, cb) {
	this.findOne({_id: orderId}, function(err, order) {
		if (!err) {
			if (order.guests !== undefined) {
				var guestFound = false;
				var guestId;
				var payingGuest = false;
				var dueAmount;
				order.guests.forEach(function(guest) {
					if (guest.token == token) {
						guestFound = true;
						guestId = guest._id;
						//Check if paying guest or not
						if (guest.dueAmount !== undefined) {
							payingGuest = true;
							dueAmount = guest.dueAmount;
						}
					}
				});
				//Si on a trouvé le guest, on l'enlève des guests et on le met dans les activated
				if (guestFound) {
					Order.update({_id: orderId},
					{$pull: {guests: {_id: guestId}}}, function(err) {
						if (!err) {
							Order.update({_id: orderId},
							{$push: {activatedGuests: {
										user: userId,
										dueAmount: dueAmount
									}}
							},
							function (err) {
								if (!err) {
									if (payingGuest) {
										cb(null, payingGuest, dueAmount);
									}
									else {
										cb(null, payingGuest);
									}
								}
								else {
									cb(err);
								}
							});
						}
						else {
							cb(err);
						}
					});
				}
				//Sinon
				else {
					cb(new Error('guestCode invalid for this order'));
				}
			}
		}
		else {
			cb(err);
		}
	});
};

OrderSchema.methods.getRating = function(delimetr) {
	delimetr = delimetr || 20;
	return Math.ceil(this.rating / delimetr);
};

OrderSchema.statics.findAllByCustomerId = function(userId, cb) {
	var reviews = [];

	var query = this
		.where('user', userId)
		.where('status').nin(Order.notPaidStatus)
		.sort('-time')
		.populate('chef');

	query.exec(function(err, orders) {
		async.waterfall([
			function(next) {
				async.map(orders, function(order, afterRatingFind) {
					order.chef.getChefAllRating(function(err, chef) {
						afterRatingFind(err, chef);
					});
				}, function(err, orders) {
					next(err);
				});
			},
			function(next) {
				reviews = _.chain(orders)
						.filter(function(order) {
					return order.review && order.review.length;
				})
						.map(function(order) {
					return order;
				}).value();

				next(null, reviews);
			}
		], function(err, reviews) {
			cb(err, reviews);
		});
	});
};

OrderSchema.statics.findAll = function(page, cb) {
	return this.find()
		.where('user').exists()
		.sort('-updated')
		.populate('chef')
		.populate('user')
		.limit(20).skip((page - 1) * 20)
		.exec(cb);
};

OrderSchema.statics.findByCoupon = function(coupon, cb) {
	return this.where('discount.id', coupon)
		.where('status').in(['ACCEPTED_BY_CHEF', 'FEEDBACK_RECEIVED', 'AWAITING_FEEDBACK', 'CONFIRMED'])
		.populate('chef').exec(cb);
};

OrderSchema.statics.getCustomers = function(userId, cb) {
	return this
		.where('chef', userId)
		.exec({'group': 'user'}, cb);
};

OrderSchema.statics.search = function(userId, orderBy, cb) {
	return this
		.where('user', userId)
		.populate('chef')
		.sort({orderBy: -1})
		.find(function(err, orders) {
			/*
				Return rating avg per Chef
			*/
			async.map(orders, function(order, afterMap) {
				async.reduce([
						{
							method: 'getChefAllRating',
							params: []
						}
					],
					order.chef,
					function(item, withMethod, afterWith) {
						withMethod.params.push(function(err, modifiedItem) {
							afterWith(err, modifiedItem);
						});
						item[withMethod.method].apply(item, withMethod.params);
					},
					function(err, item) {
						order.chef.set(item);
						afterMap(err, order);
					});
			}, function(err, orders) {
				cb(err, orders);
			});
		});
};

OrderSchema.statics.getReview = function(chefId, cb) {
	return this.where('chef', chefId).select('review reviewDate status customer rating time activatedGuests').populate('activatedGuests.user').sort('-time').find(function(err, orders) {
		//Delete orders which don't have an host review nor at least one guest review
		orders.forEach(function(order, index) {
			if (order.review === undefined) {
				if (order.activatedGuests === undefined) {
					delete orders[index];
				} else {
					var atLeastOneReview = false;
					order.activatedGuests.forEach(function(guest) {
						if (guest.feedbackReview !== undefined) {
							atLeastOneReview = true;
						}
					});
					if (!atLeastOneReview){
						delete orders[index];
					} else {
						var atLeastOneReview = false;
						order.activatedGuests.forEach(function(guest) {
							if (guest.feedbackReview !== undefined) {
								atLeastOneReview = true;
							}
						});
						if(!atLeastOneReview){
							delete orders[index];
						}
					}
				}
			}
		});
		cb(err, orders);
	});
};

OrderSchema.statics.findWithLocation = function (query, cb) {
	query.exec(function (err, orders) {
		if (err) {
			cb(err || 'Order database error');
		} else if (!orders) {
			cb(null, null);
		} else {
			async.mapSeries(orders, function (order, next) {
				order = order.toObject();
				order.lnglat = [];
				var addr = order.customer.address.lineFirst +
						', ' + order.customer.address.city + ', France';

				LocationCache.getLngLat(addr, function (err, loc) {
					if (err) {
						next(err);
					} else {
						order.lnglat = loc;
						next(null, order);
					}
				});
			}, function (err, ordersWithLocation) {
				cb(err, ordersWithLocation);
			});
		}
	});
};

var Order = DbLBA.model('Order', OrderSchema);
Order.notPaidStatus = ['ORDER_PROCESSING', 'PAYMENT_PROCESSING', 'PAYMENT_ABANDONED', 'FAIL', 'REJECTED_BY_CHEF', 'REJECTED_BY_ADMIN', 'ARCHIVED'];
Order.notConfirmedStatus = ['CONFIRMED', 'ORDER_PROCESSING', 'PAYMENT_PROCESSING', 'PAYMENT_ABANDONED', 'FAIL', 'REJECTED_BY_CHEF', 'REJECTED_BY_ADMIN', 'ARCHIVED'];
Order.paidAndAcceptedStatus = ['AWAITING_FEEDBACK', 'FEEDBACK_RECEIVED', 'ACCEPTED_BY_CHEF', 'ACCEPTED_BY_ADMIN'];

global.Order = Order;

var OrderItem = mongoose.model('OrderItem', OrderItem);
global.OrderItem = OrderItem;
