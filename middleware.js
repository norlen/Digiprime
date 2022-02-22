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
  validateCreateNegotiation,
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
 * Validates the body against a Joi schema.
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
 * Validates the query against a Joi schema.
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
 * Validates the parameters against a Joi schema.
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

/**
 * Checks if `id` in parameters is a valid offer id. Throws a 404 error if not.
 *
 * @param {*} req
 * @param {*} res
 * @param {*} next
 */
module.exports.isValidOffer = (req, res, next) => {
  const { id } = req.params;

  const exists = await Offer.exists({ _id: id });
  if (exists) {
    next();
  } else {
    throw new ExpressError("Offer not found", 404);
  }
};

/**
 * Checks if the parameters contains an `id` field with a valid mongo id.
 */
module.exports.validIdQuery = validateParams(IdSchema, 404);

/**
 * Validate fields when placing a bid.
 */
module.exports.validatePlaceBid = validateBody(placeBidSchema);

/**
 * Validate query against expected fields for creating auction.
 */
module.exports.validateGetCreateAuction = validateQuery(getCreateAuctionSchema);

/**
 * Validate fields when creating an auction.
 */
module.exports.validatePostCreateAuction = validateBody(createAuctionSchema);

/**
 * Validate fields when selecting a winner in an auction.
 */
module.exports.validateSelectWinner = validateBody(selectWinnerSchema);

/**
 * Validate the the parameter contains a valid username.
 */
module.exports.validateUsername = validateParams(usernameSchema, 404);

/**
 * Validate fields when editing user profile.
 */
module.exports.validateEditProfile = validateBody(profileSchema);

/**
 * Valide fields on signup.
 */
module.exports.validateRegister = validateBody(registerSchema);

/**
 * Validate fields when creating a negotiation.
 */
module.exports.validateNegotiation = validateBody(validateCreateNegotiation);
