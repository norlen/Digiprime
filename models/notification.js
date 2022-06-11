const mongoose = require("mongoose");
const Schema = mongoose.Schema;

/*
Notifications should be displayed for:
## AUCTION
- Added to newly created auction
- Invited to current auction
- Auction has ended (even if you didn't win?)
  this cannot be supported since we don't end auctions any longer.
- Someone created a higher bid

## NEGOTIATION
- Someone created a negotiation with you
- Someone placed a counter-bid
- Negotation accepted/rejected

## MESSAGE
- Got a message

## AGREEMENT
- todo

## IMPL

- Should always have a history.
- Seen/Unseen

Should probably be like

AUCTION
You have been invited to auction X
(links to auction page, clicking this marks this as seen)

- How to mark as seen for that specific link?
Middleware that can do that?
*/

/**
 * Schema for a single notification.
 *
 * A notification should be displayed for each user when an action of interest
 * has occured that relates to the user.
 */
const NotificationSchema = new Schema(
  {
    user: {
      type: Schema.Types.ObjectId,
      ref: "User",
    },

    // Category for notification.
    category: {
      type: String,
      enum: ["Auction", "Negotiation", "Message", "Agreement"],
    },

    // Short message that summarizes what happened.
    message: String,

    // Where to re-direct the user when they click the notification.
    links_to: String,

    // If the user has "processed" this notification.
    seen: Boolean,
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("Notification", NotificationSchema);
