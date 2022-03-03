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
  directorySchema,
} = require("./schemas.js");

module.exports.isLoggedIn = (req, res, next) => {
  if (!req.isAuthenticated()) {
    req.session.returnTo = req.originalUrl;
    req.flash("error", "You must be signed in first");
    return res.redirect("/login");
  }
  next();
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

module.exports.isReviewAuthor = async (req, res, next) => {
  const { id, reviewId } = req.params;
  const review = await Review.findById(reviewId);
  if (!review.author.equals(req.user._id)) {
    req.flash("error", "You do not have permission to do that!");
    return res.redirect(`/offers/${id}`);
  }
  next();
};

module.exports.sanitizeDirectoryQuery = (req, res, next) => {
  const { error } = directorySchema.validate(req.query);
  if (error) {
    req.flash("error", "Invalid search query");
    res.redirect("/offers/directory");
  } else {
    next();
  }
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
 * Validate body when creating a new offer.
 */
module.exports.validateOffer = validateBody(offerSchema);

/**
 * Validate body when creating a new review.
 */
module.exports.validateReview = validateBody(reviewSchema);

/**
 * Checks if the parameters contains an `id` field with a valid mongo id.
 */
module.exports.isValidId = validateParams(IdSchema, 404);

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
