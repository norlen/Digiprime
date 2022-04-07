const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const BrokerAgreementSchema = new Schema(
  {
    agent: {
      type: Schema.Types.ObjectId,
      ref: "User",
    },
    subject: {
      type: Schema.Types.ObjectId,
      ref: "User",
    },
    accepted: Boolean,
    canceled: Boolean,
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("BrokerAgreement", BrokerAgreementSchema);
