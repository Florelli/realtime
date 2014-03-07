var mongoose = require('mongoose'),
Schema = mongoose.Schema,
Query = mongoose.Query,
ObjectId = Schema.ObjectId,
castToObjectId = mongoose.mongo.BSONPure.ObjectID;
async = require('async'),
_ = require('underscore');

var FactSchema = new Schema({
	created: Date,
	category: {
		type: String,
		required: true
	},
	content: {
		type: String,
		required: true
	}
});

var Fact = DbReactive.model('Fact', FactSchema);

global.Fact = Fact;
