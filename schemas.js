const BaseJoi = require("joi");
const sanitizeHtml = require("sanitize-html");

const extension = (joi) => ({
  type: "string",
  base: joi.string(),
  messages: {
    "string.escapeHTML": "{{#label}} must not include HTML!",
  },
  rules: {
    escapeHTML: {
      validate(value, helpers) {
        const clean = sanitizeHtml(value, {
          allowedTags: [],
          allowedAttributes: {},
        });
        if (clean !== value)
          return helpers.error("string.escapeHTML", { value });
        return clean;
      },
    },
  },
});

const Joi = BaseJoi.extend(extension);

module.exports.offerSchema = Joi.object({
  offer: Joi.object({
    title: Joi.string().required().escapeHTML(),
    price: Joi.number().required().min(0),
    // image: Joi.string().required(),
    costumer: Joi.string().required().escapeHTML(),
    referenceSector: Joi.string().required().escapeHTML(),
    referenceType: Joi.string().required().escapeHTML(),
    description: Joi.string().required().escapeHTML(),
    location: Joi.string().required().escapeHTML(),
  }).required(),
  deleteImages: Joi.array(),
});

module.exports.reviewSchema = Joi.object({
  review: Joi.object({
    body: Joi.string().required().escapeHTML(),
    rating: Joi.number().required().min(1).max(5),
  }).required(),
});

module.exports.getCreateAuctionSchema = Joi.alternatives().try(
  Joi.object({
    from: Joi.string().valid("search").required().escapeHTML(),
    offerIds: Joi.array()
      .min(2)
      .items(Joi.string().pattern(/^[0-9a-fA-F]{24}$/, "offerId"))
      .required()
      .escapeHTML(),
  }),
  Joi.object({
    from: Joi.string().valid("offer").required().escapeHTML(),
    offerId: Joi.string()
      .pattern(/^[0-9a-fA-F]{24}$/, "offerId")
      .required()
      .escapeHTML(),
  })
);

module.exports.createAuctionSchema = Joi.alternatives().try(
  Joi.object({
    auctionTitle: Joi.string().required().escapeHTML(),
    closingTime: Joi.date().min(Date.now()).required().escapeHTML(),
    quantity: Joi.number().required().escapeHTML(),
    offerId: Joi.string()
      .pattern(/^[0-9a-fA-F]{24}$/, "offerId")
      .required()
      .escapeHTML(),
    members: [
      Joi.string().required().escapeHTML(),
      Joi.array().items(Joi.string()).required().escapeHTML(),
    ],
    privacy: Joi.string().valid("Private", "Public").required().escapeHTML(),
  }),
  Joi.object({
    auctionTitle: Joi.string().required().escapeHTML(),
    closingTime: Joi.date().min(Date.now()).required().escapeHTML(),
    quantity: Joi.number().required().escapeHTML(),
    offerIds: Joi.array()
      .min(2)
      .items(Joi.string().pattern(/^[0-9a-fA-F]{24}$/, "offerId"))
      .required()
      .escapeHTML(),
  })
);
