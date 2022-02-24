const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const ProfileSchema = new Schema({
  user: {
    type: Schema.Types.ObjectId,
    ref: "User",
  },
  firstname: { type: String },
  surname: { type: String },
  phone: { type: String },
  address1: { type: String },
  address2: { type: String },
  postcode: { type: String },
  area: { type: String },
  country: { type: String },
  state: { type: String },
  description: { type: String },
  details: { type: String },
});

module.exports = mongoose.model("Profile", ProfileSchema);
