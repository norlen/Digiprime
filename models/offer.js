const mongoose = require("mongoose");
const Review = require("./review");
const Schema = mongoose.Schema;

const ImageSchema = new Schema({
  url: String,
  filename: String,
});

ImageSchema.virtual("thumbnail").get(function () {
  return this.url.replace("/upload", "/upload/w_200");
});

const opts = { toJSON: { virtuals: true } };

const OfferSchema = new Schema(
  {
    title: String,
    images: [ImageSchema],
    geometry: {
      type: {
        type: String,
        enum: ["Point"],
        require: true,
      },
      coordinates: {
        type: [Number],
        require: true,
      },
    },
    price: Number,
    description: String,
    costumer: {
      type: String,
      // lowercase: true,
      enum: ["Supply", "Demand"],
    },
    referenceSector: {
      type: String,
      // lowercase: true,
      enum: ["Composites", "Batteries"],
    },
    referenceType: {
      type: String,
      // lowercase: true,
      enum: ["Material", "Product"],
    },
    location: String,
    author: {
      type: Schema.Types.ObjectId,
      ref: "User",
    },
    reviews: [
      {
        type: Schema.Types.ObjectId,
        ref: "Review",
      },
    ],
  },
  opts
);

OfferSchema.virtual("properties.popUpMarkup").get(function () {
  return `<strong><a href="/offers/${this._id}">${this.title}</a></strong>
    <p>${this.description.substring(0, 20)}...</p>`;
});

OfferSchema.post("findOneAndDelete", async function (doc) {
  if (doc) {
    await Review.deleteMany({
      _id: {
        $in: doc.reviews,
      },
    });
  }
});

module.exports = mongoose.model("Offer", OfferSchema);
