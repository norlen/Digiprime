const ExpressError = require("./utils/ExpressError");
const Offer = require("./models/offer");
const Review = require("./models/review");
const {
  offerSchema,
  reviewSchema,
  profileSchema,
  usernameSchema,
  getCreateAuctionSchema,
  createAuctionSchema,
  placeBidSchema,
  selectWinnerSchema,
  IdSchema,
  registerSchema,
} = require("./schemas.js");

module.exports.isLoggedIn = (req, res, next) => {
  if (!req.isAuthenticated()) {
    req.session.returnTo = req.originalUrl;
    req.flash("error", "You must be signed in first");
    return res.redirect("/login");
  }
  next();
};

module.exports.validateOffer = (req, res, next) => {
  const { error } = offerSchema.validate(req.body);
  if (error) {
    const msg = error.details.map((el) => el.message).join(",");
    throw new ExpressError(msg, 400);
  } else {
    next();
  }
};

module.exports.isAuthor = async (req, res, next) => {
  const { id } = req.params;
  const offer = await Offer.findById(id);
  if (!offer.author.equals(req.user._id)) {
    req.flash("error", "You do not have permission to do that!");
    return res.redirect(`/offers/${id}`);
  }
  next();
};

module.exports.validateReview = (req, res, next) => {
  const { error } = reviewSchema.validate(req.body);
  if (error) {
    const msg = error.details.map((el) => el.message).join(",");
    throw new ExpressError(msg, 400);
  } else {
    next();
  }
};

module.exports.isReviewAuthor = async (req, res, next) => {
  const { id, reviewId } = req.params;
  const review = await Review.findById(reviewId);
  if (!review.author.equals(req.user._id)) {
    req.flash("error", "You do not have permission to do that!");
    return res.redirect(`/offers/${id}`);
  }
  next();
};

/**
 * Validates against a Joi schema.
 *
 * @param {object} schema Joi schema to validate against.
 * @param {number} statusCode status code to return on failure, defaults to 400.
 * @returns
 */
// prettier-ignore
const validateBody = (schema, statusCode = 400) => (req, res, next) => {
  const { error } = schema.validate(req.body);
  if (error) {
    const msg = error.details.map((el) => el.message).join(",");
    throw new ExpressError(msg, statusCode);
  }
  next();
};

/**
 * Validates against a Joi schema.
 *
 * @param {object} schema Joi schema to validate against.
 * @param {number} statusCode status code to return on failure, defaults to 400.
 * @returns
 */
// prettier-ignore
const validateQuery = (schema, statusCode = 400) => (req, res, next) => {
  const { error } = schema.validate(req.query);
  if (error) {
    const msg = error.details.map((el) => el.message).join(",");
    throw new ExpressError(msg, statusCode);
  }
  next();
};

/**
 * Validates against a Joi schema.
 *
 * @param {object} schema Joi schema to validate against.
 * @param {number} statusCode status code to return on failure, defaults to 400.
 * @returns
 */
// prettier-ignore
const validateParams = (schema, statusCode = 400) => (req, res, next) => {
  const { error } = schema.validate(req.params);
  if (error) {
    const msg = error.details.map((el) => el.message).join(",");
    throw new ExpressError(msg, statusCode);
  }
  next();
};

// Auctions.
module.exports.validIdQuery = validateParams(IdSchema, 404);

module.exports.validateGetCreateAuction = validateQuery(getCreateAuctionSchema);
module.exports.validatePostCreateAuction = validateBody(createAuctionSchema);
module.exports.validatePlaceBid = validateBody(placeBidSchema);
module.exports.validateSelectWinner = validateBody(selectWinnerSchema);

// Users.
module.exports.validateUsername = validateParams(usernameSchema, 404);
module.exports.validateEditProfile = validateBody(profileSchema);
module.exports.validateRegister = validateBody(registerSchema);
