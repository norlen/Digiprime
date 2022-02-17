const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const UserInformationSchema = new Schema({
  username: {
    type: String,
    required: true,
    unique: true,
  },
  email: {
    type: String,
    required: true,
    unique: true,
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
  offers: { type: Number },
  wins: { type: Number },
});

module.exports = mongoose.model("UserInformation", UserInformationSchema);
