/**
 * Model for the messages.
 *
 * They are currently designed to act more as a chat conversation, where the
 * participants can select a topic and discuss briefly about it. We
 * intentioally chose not to support long running conversations, and instead
 * focused on having a coherent threaded conversation.
 */
const mongoose = require("mongoose");
const Schema = mongoose.Schema;

/**
 * Schema for a single message.
 */
const MessagesSchema = new Schema(
  {
    body: String,
  },
  {
    timestamps: true,
  }
);

/**
 * Schema for a conversation, contains multiple messages.
 */
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

module.exports = mongoose.model("Messages", ConversationSchema);
