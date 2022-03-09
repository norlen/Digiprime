const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const MessagesSchema = new Schema(
	{
		body: String,
	},
	{
		timestamps: true,
	}
);

const ConversationSchema = new Schema(
	{
		from: {
			type: Schema.Types.ObjectId,
			ref: "User",
		},
		from_read: Boolean,
		from_marked: Boolean,
		to: {
			type: Schema.Types.ObjectId,
			ref: "User",			
		},
		to_read: Boolean,
		to_marked: Boolean,
		title: String,
		messages: [MessagesSchema],
	},
	{
		timestamps: true,
	}
);

module.exports = mongoose.model("Messages", ConversationSchema)

