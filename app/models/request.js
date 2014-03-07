var mongoose = require('mongoose'),
Schema = mongoose.Schema,
Query = mongoose.Query,
ObjectId = Schema.ObjectId,
_ = require('underscore');

var NotesSchema = new Schema({
	date: {
		type: Date,
		required: true,
	},
	author: {
		type: ObjectId,
		ref: 'User',
		required: true
	},
	text: {
		type: String,
		required: true
	}
});

var RequestSchema = new Schema({
	user: {
		type: ObjectId,
		ref: 'User',
		required: true
	},
	companyName: String,
	city: {
		type: String,
		required: true
	},
	date: {
		type: Date,
		default: Date.now()
	},
	requestDate: {
		type: Date,
		default: new Date()
	},
	dateStart: Date,
	dateEnd: Date,
	performanceType: {
		type: String,
		required: true
	},
	person: {
		type: Number,
		required: true
	},
	flexible: String,
	ppp: Number,
	budget: Number,
	budgetDaily: Number,
	performanceDetails : {
		type: String,
		required: true
	},
	tags : {
		type: [String]
	},
	beverage: {
		type: String,
		enum: ['INCLUDE', 'INCLUDE_NO_BUDGET', 'NOT']
	},
	waiters: {
		type: String,
		enum: ['INCLUDE', 'NO', 'NOT_NEED']
	},
	dishes: {
		type: String,
		enum: ['NEED_NO_BUDGET', 'SOME_NEED', 'NEED']
	},
	kitchen: {
		type: String,
		enum: ['YES', 'YES_SMALL', 'NO']
	},
	status: {
		type: String,
		default: 'NEW_REQUEST'
	},
	companyPerformanceType: {
		type: String,
		enum: ['ELEGANT_LUNCH', 'TEAM_LUNCH', 'TEAM_BUILDING', 'COOKING_LESSON', 'COCKTAIL', 'COCKTAIL_DELIVERED', 'BUFFET_DELIVERED', 'PREMIUM_DINNER', 'BREAKFAST', 'MEAL_DELIVERED']
	},
	chefs: [{
		type: ObjectId,
		ref: 'User'
	}],
	allowOtherChefs : {
		type: Boolean
	},
	notes: [NotesSchema],
	activity: {
		create: Date,
		description: String,
		responsible: {
			type: ObjectId,
			ref: 'User'
		},
		dueDate: Date
	},
	ingredients: {
		type: String,
		enum: ['PROVIDED', 'NOT_PROVIDED']
	},
	equipementDescription: String
});

/*
 * Validators
 */
RequestSchema.path('performanceType').validate(function (value) {
  return /CHEF_AT_HOME|BUSINESS_LUNCH|BUSINESS_DINNER|FULLTIME_CHEF|COCKTAIL_BUFFET|COCKTAIL_RECEPTION|COCKTAIL_DINNER|COOKING_LESSON|FOOD_DELIVERY|WEDDING|BRUNCH|ENTREPRISE|OTHER/i.test(value);
}, 'Invalid performanceType');

RequestSchema.path('flexible').validate(function (value) {
  return /NOT_FLEXIBLE|FLEXIBLE|VERY_FLEXIBLE/i.test(value);
}, 'Invalid flexible');

RequestSchema.path('status').validate(function (value) {
  return /NEW_REQUEST|SENT_TO_CHEF|ORDER_FINALIZED|NO_DEAL|CHEF_RESPONDED|OFFER_SENT|ARCHIVED/i.test(value);
}, 'Invalid status');

RequestSchema.statics.findByUser = function(id, cb) {
	return this.find()
		.or([{user: id}, {chef: id}])
		.exec(cb);
};

var Request = DbLBA.model('Request', RequestSchema);

global.Request = Request;
