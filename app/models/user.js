var mongoose = require('mongoose'),
Schema = mongoose.Schema,
Query = mongoose.Query,
_ = require('underscore'),
_s = require('underscore.string'),
async = require('async'),
crypto = require('crypto');

var address = {
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
};

var Address = new Schema(address);

var SignatureDishSchema = new Schema({
	name: String,
	image: String,
	description: String
});

var UserSchema = new Schema({
	addresses: {
		personal: [Address],
		billing: address,
		cooking: address
	},
	chefSignatureDishes: [SignatureDishSchema],
	firstname: {
		type: String,
		required: true,
		set: cleanField
	},
	lastname: {
		type: String,
		required: true
	},
	phone: {
		type: String,
		required: true,
		set: noSpace
	},
	email: {
		type: String,
		required: true,
		unique: true,
		set: toLower
	},
	birthday: {
		type: String
	},
	city: {
		name: {
			type: String
		},
		lnglat: {
			type: [Number]
		}
	},
	about: String,
	password: {
		type: String,
		set: setPassword
	},
	restorePasswordToken: String,
	salt: {
		type: String
	},
	subscriptions: {
		news: {
			type: Boolean,
			default: 1
		},
		offers: {
			type: Boolean,
			default: 1
		},
		smsOffers: {
			type: Boolean,
			default: 1
		}
	},
	postcodesCH: {
		type: [String],
		set: function(value) {
			var postcodesCH = _.chain(value)
					.reduce(function(postcodesCH, value) {
				return postcodesCH.concat(value.split(","));
			}, [])
					.map(function(item) {
				return _s.trim(item);
			})
					.reject(function(item) {
				return item.length == 0;
			})
					.uniq()
					.value();
			return postcodesCH;
		}
	},
    postcodesHD: {
		type: [String],
		set: function(value) {
			var postcodesHD = _.chain(value)
					.reduce(function(postcodesHD, value) {
				return postcodesHD.concat(value.split(","));
			}, [])
					.map(function(item) {
				return _s.trim(item);
			})
					.reject(function(item) {
				return item.length == 0;
			})
					.uniq()
					.value();
			return postcodesHD;
		}
	},
	slug: {type: String, lowercase: true, trim: true},
	role: String,
	resetPasswordkey: String,
	bankDetail: {
		accountOwner: String,
		iban: String,
		bic: String,
		rib: String
	},
	companyDetail: {
		type: {
			type: String,
			enum: ['FREELANCE', 'SAS', 'SARL', 'NO'],
			default: 'NO'
		},
		name: String,
		regNumber: String,
		siret: String,
		tva: {
			type: Number,
			default: 0,
			min: 0,
			max: 100
		}
	},
	featured: {
		type: Boolean,
		default: false
	},
	createdAt: {
		type: Date,
		default: Date.now
	},
	isAvailable: {
		type: Boolean,
		default: true
	},
	status: {
		type: String,
		default: 'NEWCONTACT'
	},
	tuto: {
		complete: Boolean,
		step: Number,
		stepDetails: Schema.Types.Mixed
	},
	subscribnumber: String,
	subscribdate: Date,
	tags: [String],
	lang: [String],
	tagline: String,
	profilPic: String,
	coverPic: String,
	gallery: [{
		title: String,
		img: String
	}],
	backgroundImage: String,
	chefQuestions: [{
		id: String,
		answer: String
	}],
	rangeWork: {
		type: Number,
		min: 1,
		max: 300,
		default: 10
	},
	lbaVerified: Boolean,
	gamme: Number,
	incompleteCount: Number,
	activedDate: Date,
	betaTester: {
		type: Boolean,
		default: false
	}
}, {
	toJSON: { virtuals: true },
	toObject: { virtuals: true }
});

UserSchema.path('email').validate(function (email) {
	return (/^([^@\s]+)@((?:[-a-z0-9]+\.)+[a-z]{2,})$/i).test(email);
}, 'invalid');

UserSchema.path('phone').validate(function (phone) {
	return !phone || /^((0|\+33|0033)\d(\d{2}){4})$|^(\+\d+)$/.test(phone.replace(/\s/g, ''));
}, 'invalid');

function setPassword(v) {
	return v.length ? v : this.password;
}

function toLower(v) {
	return v.toLowerCase();
}

function cleanField(v) {
	return v.replace(/\w\S*/g, function (txt) { return txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase(); });
}

function noSpace(v) {
	return v.replace(/\s/g, '');
}

UserSchema.pre('save', function (next) {
	if (!this.salt) {
		if (!this.password) {
			this.realPassword = crypto.randomBytes(4).toString('hex');
			this.password = this.realPassword;
		}
		this.generateSalt();
		this.password = this.hashPassword(this.password, this.salt);
	}
	if (this.role === 'chef' && (!this.slug || this.slug === "")) {
		var thisUser = this;

		this.slugGenerator(null, function (err, s) {
			thisUser.slug = s;
			next();
		});
	} else {
		next();
	}
});

UserSchema.methods.slugGenerator = function (slug, next) {

	function clean(w) {
		return w.toLowerCase()
			.replace(/[àáâãäå]/g, 'a')
			.replace(/æ/g, 'ae')
			.replace(/ç/g, 'c')
			.replace(/[èéêë]/g, 'e')
			.replace(/[ìíîï]/g, 'i')
			.replace(/ñ/g, 'n')
			.replace(/[òóôõö]/g, 'o')
			.replace(/œ/g, 'oe')
			.replace(/[ùúûü]/g, 'u')
			.replace(/[ýÿ]/g, 'y') /* above accented letters */
			.replace(/[^a-z0-9\s\-]/g, '') /* remove all srange things */
			.replace(/^(\s|-)*|(\s|-)*$/g, '') /* No spaces/dashs before/after */
			.replace(/\s{2,}/, ' ') /* replace multi-space by one */
			.replace(/\s/g, '-') /* replace space by dash*/
			.replace(/(-)\1+/g, '-'); /* tricks for Jean-marc */
	}

	var thisUser = this;
	var addOnlyCity = true;
	var uniq = 42;
	var chefId = (thisUser._id != 'undefined') ? thisUser._id : mongoose.Types.ObjectId('000000000000000000000000');
	var slug_clean = (slug) ? clean(slug) : clean(this.firstname) + "-" + clean(this.lastname);

	/*
		Chek if slug exist
		If exist add city at the end
		and if city or if slug-city exist add an random number
	*/
	async.until(
		function () {
			return (uniq === 0) ? true : false;
		},
		function (cb) {
			User.find({_id: {$ne: chefId}, slug: slug_clean}).count(function(err, count) {
				uniq = count;
				if (uniq !== 0) {
					slug_clean = (addOnlyCity && thisUser.city.name != "undefined") ? clean(slug_clean + " " + thisUser.city.name) : clean(slug_clean + Math.round(Math.random() * 10));
					addOnlyCity = false;
					cb();
				} else {
					cb();
				}
			});
		},
		function (err) {
			next(err, slug_clean);
		}
	);
};

UserSchema.methods.changePassword = function (realpassword) {
	this.password = realpassword;
	this.generateSalt();
	this.password = this.hashPassword(this.password, this.salt);
	return realpassword;
};

UserSchema.methods.changeSecurePassword = function (oldp, newp) {
	var oldHash = this.hashPassword(oldp, this.salt);

	if (oldHash != this.password) {
		this.invalidate("password", "badpassword");
		return "";
	} else {
		this.password = newp;
		this.generateSalt();
		this.password = this.hashPassword(this.password, this.salt);
		return newp;
	}
};

UserSchema.methods.updateCompanyStatus = function (type) {
	this.companyDetail.type = type;
	if (type == 'FREELANCE' || type == 'NO') {
		this.companyDetail.tva = 0;
		this.companyDetail.regNumber = '';
	}
	if (type == 'NO') {
		this.companyDetail.siret = '';
	}
}

UserSchema.methods.getChefAllRating = function(cb) {
	var chef = this;
	return Order
			.where('chef', this._id)
			.find(function(err, orders) {
		var rating = 0;
		if (orders.length) {
			var ratedOrders = 0;
			orders.forEach(function(order) {
				if (typeof(order.rating) != 'undefined') {
					ratedOrders++;
					rating += order.rating;
				}
			});

			if (ratedOrders != 0) {
				rating = ((rating / ratedOrders) / 5) * 100;
			}

		}

		chef.rating = rating;
		cb(null, chef);
	});
};

UserSchema.methods.getChefUserRating = function (userId, cb) {
	var chef = this;
	return Order
		.where('chef', this._id)
		.where('user', userId)
		.find(function (err, orders) {
			var rating = 0;
			if (orders && orders.length) {
				var ratedOrders = 0;
				orders.forEach(function (order) {
					if (typeof(order.rating) != 'undefined') {
						ratedOrders++;
						rating += order.rating;
					}
				});

				if (ratedOrders != 0) {
					rating = ((rating / ratedOrders) / 5) * 100;
				}

			}
			chef.userRating = rating;
			cb(null, chef);
		});
};

UserSchema.methods.getUserOrderCount = function (cb) {
	return Order
		.where('user', this._id)
		.where('status').nin(Order.notPaidStatus)
		.count(cb);
};

UserSchema.methods.getChefOrders = function (cb) {
	return Order
		.where('chef', this._id)
		.where('status').nin(Order.notPaidStatus)
		.find(cb);
};

UserSchema.methods.getUserOrders = function (cb) {
	return User
		.where('user', this._id)
		.exec(cb);
};

UserSchema.methods.hashPassword = function hashPassword (password, key) {
	return crypto.createHmac('sha256', key).update(password).digest('hex');
};

UserSchema.methods.generateSalt = function generateSalt () {
	this.salt = Math.round((new Date().valueOf() * Math.random())) + '';
};

UserSchema.methods.getRating = function (delimetr) {
	delimetr = delimetr || 20;
	return Math.ceil((this.rating / delimetr) * 10) / 10;
};

UserSchema.methods.findAddressByType = function (type) {
	var address = _.find(this.addresses, function (address) {
		return address.type == type;
	});

	if (address) {
		return address;
	} else {
		var AddressSchema = mongoose.model('Address', Address);
		return new AddressSchema({type: type});
	}
};

UserSchema.methods.findAddressById = function (id) {
	var address = _.find(this.addresses, function (address) {
		return address.id == id;
	});

	if (address) {
		return address;
	} else {
		var AddressSchema = mongoose.model('Address', Address);
		return new AddressSchema();
	}
};

UserSchema.virtual('fullname').get(function () {
	return this.firstname + " " + this.lastname;
});

UserSchema.virtual('mainPersonalAddress').get(function () {
	if (typeof this.addresses !== 'object' || typeof this.addresses.personal !== 'object' || typeof this.addresses.personal[0] !== 'object') {
		return {address: {}};
	} else {
		return this.addresses.personal[0];
	}
});


UserSchema.statics.authenticate = function (email, password, fn) {

	email = email.toLowerCase();
	this.findOne({
		email: email
	}, function(err, user) {
		if (!user) {
			fn('Hmm.. maybe you made a mistake in your email, or maybe you don\'t belong here ?');
		} else {
			if (password && password !== "") {
				var hashedpwd = user.hashPassword(password, user.salt);
				if (user.password != hashedpwd) {
					fn('Forgot your password ?');
				} else if (user.status == "DEACTIVATED" || user.role !== 'admin') {
					fn('This place is for LBA Staff. Got lost ? Please go back to the <a href="https://labelleassiette.fr">website</a>.');
				} else {
					fn(err, user);
				}
			} else {
				fn("Why didn't you type a password ?");
			}
		}
	});
};

UserSchema.statics.chefMapAdmin = function (cb) {
	User.find({role: 'chef'}, 'status firstname addresses lastname city rangeWork').lean().exec(function (err, chefs) {

		async.eachSeries(chefs, function (chef, nextChef) {
			var addr;
			if (chef.addresses.cooking) {
				addr = chef.addresses.cooking.address.lineFirst + ' ' + chef.addresses.cooking.address.postcode + ' ' + chef.addresses.cooking.address.city;
			} else if (chef.addresses.billing) {
				addr = chef.addresses.billing.address.lineFirst + ' ' + chef.addresses.billing.address.postcode + ' ' + chef.addresses.billing.address.city;
			} else if (chef.addresses.personal && chef.addresses.personal[0]) {
				addr = chef.addresses.personal[0].address.lineFirst + ' ' + chef.addresses.personal[0].address.postcode + ' ' + chef.addresses.personal[0].address.city;
			}
			if (addr && addr !== '  ') {
				LocationCache.getLngLat(addr, function (err, lnglat) {
					if (err) {
						nextChef(err);
					} else {
						chef.lnglat = lnglat;
						nextChef(null);
					}
				});
			} else {
				nextChef(null);
			}
		}, function (err) {
			cb(err, chefs);
		});
	});
};

UserSchema.statics.register = function (user, req, fn) {
	if (user.firstname && user.lastname && user.phone && user.email && user.password) {
		var u = new User({
			firstname: user.firstname,
			lastname: user.lastname,
			phone: user.phone,
			email: user.email.toLowerCase(),
			password: user.password,
			role: 'user',
			status: 'ACTIVE'
		});

		if (u.password === "" || u.password.length < 6) {
			u.invalidate('password', 'invalidepassword');
		}

		/*
			We verifie that email isn't already used
		*/
		this.count({
			email: u.email
		}, function (err, count) {
			if (count !== 0) {
				fn("emailAlreadyExists");
			} else {
				u.validate(function (err) {
					if (err) {
						fn(err);
					} else {
						u.save(function (err, user) {
							if (!err) {
								customerEmail = "welcomeFr";
								customerEmailSubject = "Bienvenue sur La Belle Assiette";
								var mailData = {
									title: customerEmailSubject,
									to: user.email,
									data: {
										username: user.fullname,
										login: user.email,
										password: u.password
									},
									templateName: 'welcomeUserFr'
								};
								$.component('mail4').pool(mailData, function () {
									req.session.user = {
										_id: user._id,
										name: user.fullname,
										email: user.email,
										role: user.role,
										betaTester: user.betaTester,
										status: user.status,
										pic: user.profilPic || ''
									};
									KM.set(user.email, {
										lastname: user.lastname,
										firstname: user.firstname
									});
									//Cb without errors
									fn(null, user);
								});
							} else {
								fn(new Error("Error saving"));
							}
						});
					}
				});
			}
		});
	} else {
		fn("Parameters missing");
	}
};

UserSchema.statics.login = function (email, password, req, fn) {
	this.findOne({
		email: email.toLowerCase()
	}, function (err, user) {
		if (!user) {
			fn("noUser", false);
		} else {
			if (password && password !== "") {
				var hashedpwd = user.hashPassword(password, user.salt);

				if (user.password != hashedpwd) {
					fn("invalidePassword");
				} else if (user.status == "DEACTIVATED") {
					fn("notActive");
				} else {
					req.session.user = {
						_id: user._id,
						name: user.fullname,
						email: user.email,
						role: user.role,
						betaTester: user.betaTester,
						status: user.status,
						pic: user.profilPic || ''
					};
					KM.set(user.email, {
						lastname: user.lastname,
						firstname: user.firstname
					});
					fn(null, user);
				}
			} else {
				fn("empty password");
			}
		}
	});
};

UserSchema.statics.authenticateFast = function (userId, fn) {
	this.findOne({
		_id: userId
	}, function (err, user) {
		fn(err, user);
	});
};

UserSchema.statics.getLastestChefs = function (cb) {
	return this
		.where("role", "chef")
		.where("status", "ACTIVE")
		.exists("city.name", true)
		.sort("-createdAt")
		.select("firstname lastname fullname city slug")
		.limit(3)
		.find(cb);
};

UserSchema.statics.getChefBeforeMe = function (date, cb) {
	var query = this.where("role", "chef");
	query.where("status", "ACTIVE")
		.exists("city.name", true)
		.where("createdAt").lt(date)
		.sort("-createdAt")
		.select("firstname lastname fullname city slug")
		.limit(3);

	query.find(function (err, c) {
		cb(err, c);
	});
};

UserSchema.statics.findAllAvailablePostcodes = function (fn) {
	return this.find(function (err, users) {
		var postcodes = _
				.chain(users)
				.reduce(function (postcodes, user) {
			return postcodes.concat(user.postcodesCH).concat(user.postcodesHD);
		}, [])
				.uniq()
				.value();
		fn(err, postcodes);
	});
};

UserSchema.statics.findAllByRole = function (role, cb) {
	var query = this.where('role', role).sort('-createdAt');
	if (role == 'chef') {
		query.with ('getChefAllRating');
	}
	query.find(cb);
};

UserSchema.statics.findByPk = function (id, userId, cb) {
	return this
			.where('_id', id)
			.with ('getChefAllRating')
			.with ('getChefUserRating', [userId])
			.exec(function (err, users) {
		if (users.length) {
			cb(err, users[0]);
		} else {
			cb(err, null);
		}
	});
};

UserSchema.statics.findByEmail = function (email, cb) {
	return this
		.where('email', email)
		.exec(function (err, users) {
			if (users.length) {
				cb(err, users[0]);
			} else {
				cb(err, null);
			}
		});
};

UserSchema.statics.findByToken = function (token, cb) {
	return this
		.where('restorePasswordToken', token)
		.exec(function (err, users) {
			if (users.length) {
				cb(err, users[0]);
			} else {
				cb(err, null);
			}
		});
};

UserSchema.statics.findByCity = function (city, userId, cb) {
	return this
		.where('city', city)
		.where('role', 'chef')
		.with ('getChefAllRating')
		.exec(function (err, users) {
			if (users.length) {
				cb(err, users);
			} else {
				cb(err, null);
			}
		});
};

UserSchema.statics.findBySlug = function (slug, userId, cb) {
	return this
		.where('slug', slug)
		.with ('getChefAllRating')
		.with ('getChefUserRating', [userId])
		.exec(function (err, users) {
			if (users.length) {
				cb(err, users[0]);
			} else {
				cb(err, null);
			}
		});
};

UserSchema.statics.countChefByPostalCode = function (cp, cb) {
	return this
		.where('role', 'chef')
		.exec(function (err, chef) {
			chef = _.filter(chef, function (i) {
				return _.include(i.postcodesCH, cp);
			});
			cb(chef.length, cp);
		});
};

UserSchema.statics.checkRange = function (data, cb) {
	function distanceBetweenLngLat(lnglat1, lnglat2) {
		function toRad(d) {
			return d * Math.PI / 180;
		}
		var R = 6371; // km
		var dLat = toRad(lnglat2[1] - lnglat1[1]);
		var dLon = toRad(lnglat2[0] - lnglat1[0]);
		var lat1 = toRad(lnglat1[1]);
		var lat2 = toRad(lnglat2[1]);

		var a = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.sin(dLon / 2) * Math.sin(dLon / 2) * Math.cos(lat1) * Math.cos(lat2);
		var c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
		return R * c;
	}

	var query = this.where('_id').equals(data.chef);

	query.select('rangeWork city.lnglat').findOne(function (err, chef) {
		if (err) {
			cb(err);
		} else {
			LocationCache.getLngLat(data.client, function (err, lnglat) {
				if (err) {
					cb(err);
				} else {
					dist = distanceBetweenLngLat(lnglat, chef.city.lnglat);
					if (dist > chef.rangeWork) {
						cb(null, false, dist);
					} else {
						cb(null, true, dist);
					}
				}
			});
		}
	});
};

UserSchema.statics.getChefMissingPart = function (chefId, cb) {
	User.findById(chefId, function (err, chef) {
		if (err || !chef) {
			pnext(err || 'no chef with id ' + chefId);
		} else {
			var missing = [];
			if (!chef.tagline || chef.tagline === '') {
				missing.push('tagline');
			}
			if (!chef.about || chef.about === '') {
				missing.push('about');
			}
			if (!chef.lang || chef.lang.length === 0) {
				missing.push('lang');
			}
			if (!chef.tags || chef.tags.length === 0) {
				missing.push('tags');
			}
			if (!chef.chefQuestions || chef.chefQuestions.length === 0) {
				missing.push('chefQuestions');
			}
			if (!chef.profilPic || chef.profilPic === '') {
				missing.push('profilPic');
			}
			if (!chef.coverPic || chef.coverPic === '') {
				missing.push('coverPic');
			}
			if (!chef.gallery || chef.gallery.length === 0) {
				missing.push('gallery');
			}
			if (!chef.addresses || !chef.addresses.billing || !chef.addresses.cooking) {
				missing.push('addresses');
			}
			async.parallel([
				function (nextMissing) {
					Menu.count({user: chef._id}, function (err, menusCount) {
						if (menusCount === 0) {
							missing.push('menu');
						}
						nextMissing(err);
					});
				},
				function (nextMissing) {
					Schedule.count({user: chef._id}, function (err, schedulesCount) {
						if (schedulesCount === 0) {
							missing.push('schedule');
						}
						nextMissing(err);
					});
				}
			], function (err) {
				cb(err, missing);
			});
		}
	});
};

var User = DbLBA.model('User', UserSchema);

global.User = User;
global.Address = Address;
