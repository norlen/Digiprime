const Joi = require("joi");
const Offer = require("../models/offer");
const User = require("../models/user");

/**
 * Validates a single offer auction. Checks that
 * - Offer exists
 * - The offer creator is the same as the auction creator.
 *
 * @param {string} creatorUsername
 * @param {string} offerId
 * @returns Offer from Digiprime and the auction type (Ascending, Descending)
 */
const validateCreateFromSingleOffer = async (creatorUsername, offerId) => {
  const offer = await Offer.findById(offerId).populate("author");
  if (!offer) {
    throw new Error("Offer not found");
  }
  const auctionType =
    offer.costumer.toLowerCase() === "supply" ? "Ascending" : "Descending";

  if (offer.author.username !== creatorUsername) {
    throw new Error("Cannot create auction from other user's offer");
  }

  return { offer, auctionType };
};

/**
 * Validates members in a owned-offer auction. Checks that
 * - Creator is not part of members.
 * - All members exist in the Digiprime database.
 *
 * @param {string} creatorUsername
 * @param {string | string[]} members
 * @returns {string[]} member usernames
 */
const validateMembers = async (creatorUsername, members) => {
  let usernames = Array.isArray(members) ? members : [members];
  usernames.forEach((username) => {
    if (username === creatorUsername) {
      throw new Error("Cannot add the creator as a member");
    }
  });

  const users = await User.find({ username: { $in: usernames } }).exec();
  if (users.length !== usernames.length) {
    throw new Error("Could not find all passed members in user collection");
  }
  return usernames;
};

/**
 * Validates auction parameters for an auction containing multiple offers. Checks that
 * - All passed offer IDs exist as offers.
 * - All offers have the same reference sector.
 * - All offers have the same reference type.
 * - All offer creators are distinct.
 * - The auction creator is not a creator of any of the offers.
 *
 * @param {string} creatorUsername
 * @param {string[]} offerIds
 * @returns information about auction and the offers contained.
 */
const validateCreateFromMultipleOffers = async (creatorUsername, offerIds) => {
  // Get all the relevant offers to perform additional checks.
  const offers = await Offer.find({ _id: { $in: offerIds } })
    .populate("author")
    .exec();

  // Ensure all passed IDs are valid offers.
  if (offers.length !== offerIds.length) {
    throw new Error("Some or all Offer IDs are invalid");
  }

  // Perform additional checks.
  // - Check all offers are of the same type.
  // - Ensure all members are distinct.
  // - Ensure auction creation is not a member.
  let sector = offers[0].referenceSector;
  let type = offers[0].referenceType;
  let supplyOrDemand = offers[0].costumer;
  let currentMembers = {};
  for (let offer of offers) {
    if (
      offer.referenceSector !== sector ||
      offer.referenceType !== type ||
      offer.costumer !== supplyOrDemand ||
      currentMembers[offer.author.username] ||
      offer.author.username === creatorUsername
    ) {
      throw new Error("invalid");
    }
  }
  const auctionType =
    supplyOrDemand.toLowerCase() === "supply" ? "Descending" : "Ascending";

  return { offers, sector, type, supplyOrDemand, auctionType };
};

const createQuerySchema = Joi.alternatives().try(
  Joi.object({
    from: Joi.string().valid("search").required(),
    offerIds: Joi.array()
      .min(2)
      .items(Joi.string().pattern(/^[0-9a-fA-F]{24}$/, "offerId"))
      .required(),
  }),
  Joi.object({
    from: Joi.string().valid("offer").required(),
    offerId: Joi.string()
      .pattern(/^[0-9a-fA-F]{24}$/, "offerId")
      .required(),
  })
);

module.exports.validateGetCreateAuction = async (req, res, next) => {
  const q = await createQuerySchema.validateAsync(req.query);
  const username = req.user.username;

  if (q.from === "search") {
    const { offers, sector, type, auctionType } =
      await validateCreateFromMultipleOffers(username, q.offerIds);

    req.body = {
      ...req.body,
      offers,
      sector,
      type,
      auctionType,
    };
  } else {
    // Otherwise it's from a single owned offer.
    const { offer, auctionType } = await validateCreateFromSingleOffer(
      username,
      q.offerId
    );
    const users = await User.find({ username: { $nin: [username] } }).exec();

    req.body = {
      ...req.body,
      offer,
      auctionType,
      users,
    };
  }

  next();
};

const CreateAuctionSchema = Joi.alternatives().try(
  Joi.object({
    auctionTitle: Joi.string().required(),
    closingTime: Joi.date().min(Date.now()).required(),
    quantity: Joi.number().required(),
    offerId: Joi.string()
      .pattern(/^[0-9a-fA-F]{24}$/, "offerId")
      .required(),
    members: [
      Joi.string().required(),
      Joi.array().items(Joi.string()).required(),
    ],
    privacy: Joi.string().valid("Private", "Public").required(),
  }),
  Joi.object({
    auctionTitle: Joi.string().required(),
    closingTime: Joi.date().min(Date.now()).required(),
    quantity: Joi.number().required(),
    offerIds: Joi.array()
      .min(2)
      .items(Joi.string().pattern(/^[0-9a-fA-F]{24}$/, "offerId"))
      .required(),
  })
);

module.exports.validatePostCreateAuction = async (req, res, next) => {
  const data = await CreateAuctionSchema.validateAsync(req.body);
  const username = req.user.username;
  const fromSearch = data.members === undefined;

  if (fromSearch) {
    const { offers, sector, type, auctionType } =
      await validateCreateFromMultipleOffers(username, data.offerIds);

    req.body = {
      ...req.body,
      offers,
      sector,
      type,
      auctionType,
      fromSearch,
    };
  } else {
    // Otherwise it's from a single owned offer.
    const { offer, auctionType } = await validateCreateFromSingleOffer(
      username,
      data.offerId
    );
    let members = await validateMembers(username, data.members);

    req.body = {
      ...req.body,
      offer,
      auctionType,
      members,
      fromSearch,
    };
  }

  next();
};
