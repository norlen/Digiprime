
const Messages = require("../models/messages");
const User = require("../models/user");
const ExpressError = require("../utils/ExpressError");
const { displayDate } = require("../lib/auction");

module.exports.create = async (req, res) => {
	const { id: from } = req.user;
	const { username: toUsername, title, body } = req.body;
	const toUser = await User.findOne({ username: toUsername});
	if(!toUser) {
		throw new ExpressError(
			`Cannot send to ${toUsername}: not a valid user`,
			400
		);
	}
	
	const message = new Messages({
		from,
		from_read: false,
		from_marked: false,
		to: toUser._id,
		to_read: false,
		to_marked: false,
		title,
		messages: [
			{
				body,
			},
		],
	});
	await message.save();

	req.flash("success", `Successfully sen message to ${toUsername}`);
	res.redirect(`/messages/${message.id}`);
};

module.exports.new = async (req, res) => {
	res.render("messages/new");
};

module.exports.list = async (req, res) => {
	const { id } = req.user;
	const { filter } = req.query;
	let messages;
	let find;
	if(filter === "unread") {
		messages = await Messages.find({
		$or: [ { $and: [{ to: id, to_read: false}]}, { $and: [{from: id, from_read: false}]}]
		})
		.populate("from")
		.populate("to");
	} else if(filter === "read") {
		messages = await Messages.find({
		$or: [ { $and: [{ to: id, to_read: true }]}, { $and: [{from: id, from_read: true}]}]
		})
		.populate("from")
		.populate("to");
	} else if(filter === "marked") {
		messages = await Messages.find({
		$or: [ { $and: [{ to: id, to_marked: true }]}, { $and: [{from: id, from_marked: true}]}]
		})
		.populate("from")
		.populate("to");			
	} else {
		messages = await Messages.find({
			$or: [{ to: id}, { from: id }],
		})
		.populate("from")
		.populate("to");
	}
	
	res.render("messages/messageOverview", { messages, displayDate, filter });
}

module.exports.show = async (req, res) => {
	const { id } = req.params;
	const message = await Messages.findById(id).exec();
	res.render("messages/show", {message});
}

module.exports.reply = async (req, res) => {
	const { id } = req.params;
	const { body } = req.body;
	await Messages.update({ _id:id }, { $push: { messages: { body }}});
	res.redirect(`/messages/${id}`);
}

module.exports.mark = async (req, res) => {
	const { id } = req.params;
	const { marked } = req.marked;
	await Messages.update({ _id:id }, { $push: { messages: { marked }}});
	res.redirect(`/messages/`);
}


