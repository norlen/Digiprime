const Message = require("../models/messages");
const User = require("../models/user");
const ExpressError = require("../utils/ExpressError");
const { displayDate } = require("../lib/auction");
const { getPage, createPagination } = require("../lib/paginate");

/**
 * Create and send a message to a recipient.
 *
 * Expects a JSON body containing
 * ```json
 * {
 *   "username": "",
 *   "title": "",
 *   "body": ""
 * }
 * ```
 *
 * @param {*} req
 * @param {*} res
 */
module.exports.create = async (req, res) => {
  const { _id: from } = req.user;
  const { username: toUsername, title, body } = req.body;

  const toUser = await User.findOne({ username: toUsername });
  if (!toUser) {
    throw new ExpressError(
      `Cannot send to ${toUsername}: not a valid user`,
      400
    );
  }

  const message = new Message({
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

/**
 * List all messages.
 *
 * @param {*} req
 * @param {*} res
 */
module.exports.list = async (req, res) => {
  const { _id } = req.user;
  const { filter } = req.query;
  const page = getPage(req.query.page);
  const perPage = 10;

  let search = undefined;
  if (filter === "unread") {
    search = {
      $or: [
        { $and: [{ to: _id, to_read: false }] },
        { $and: [{ from: _id, from_read: false }] },
      ],
    };
  } else if (filter === "read") {
    search = {
      $or: [
        { $and: [{ to: _id, to_read: true }] },
        { $and: [{ from: _id, from_read: true }] },
      ],
    };
  } else if (filter === "marked") {
    search = {
      $or: [
        { $and: [{ to: _id, to_marked: true }] },
        { $and: [{ from: _id, from_marked: true }] },
      ],
    };
  } else {
    search = {
      $or: [{ to: _id }, { from: _id }],
    };
  }

  const [messages, count] = await Promise.all([
    Message.find(search)
      .populate("from")
      .populate("to")
      .sort({ updatedAt: -1 })
      .skip(perPage * (page - 1))
      .limit(perPage),
    Message.countDocuments(search),
  ]);

  res.render("messages/list", {
    page: createPagination(messages, count, page, perPage),
    displayDate,
    filter,
  });
};

/**
 * Show a single conversation.
 *
 * @param {*} req
 * @param {*} res
 */
module.exports.show = async (req, res) => {
  const { id } = req.params;

  const message = await Message.findById(id)
    .populate("from")
    .populate("to")
    .exec();

  if (message.to.username === req.user.username) {
    await Message.updateOne({ _id: id }, { to_read: true });
  } else {
    await Message.updateOne({ _id: id }, { from_read: true });
  }

  res.render("messages/show", { message });
};

/**
 * Post a reply in a conversation.
 *
 * @param {*} req
 * @param {*} res
 */
module.exports.reply = async (req, res) => {
  const { id } = req.params;
  const { body } = req.body;
  const { _id: userId } = req.user;

  const message = await Message.findById(id).exec();
  if (!(message.to == userId || message.from == userId)) {
    throw new ExpressError("Cannot reply to other people's messages", 403);
  }

  const update = { $push: { messages: { body } } };
  if (message.to == userId) {
    update.from_read = false;
  } else {
    update.to_read = false;
  }
  await Message.updateOne({ _id: id }, update);

  res.redirect(`/messages/${id}`);
};

/**
 * Mark a message to keep track of.
 *
 * @param {*} req
 * @param {*} res
 */
module.exports.mark = async (req, res) => {
  const { id } = req.params;
  const { _id: userId } = req.user;

  const message = await Message.findById(id).exec();
  if (!(message.to == userId || message.from == userId)) {
    throw new ExpressError("Cannot modify other people's messages", 403);
  }

  if (message.to == userId) {
    message.to_marked = !message.to_marked;
  } else {
    message.from_marked = !message.from_marked;
  }
  await message.save();

  res.redirect(`/messages`);
};
