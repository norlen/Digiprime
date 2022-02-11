const Offer = require("../models/offer");
const User = require("../models/user");
const { getCreateAuctionSchema, createQuerySchema } = require("../schemas");

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

module.exports.validateGetCreateAuction = async (req, res, next) => {
  const { error } = createQuerySchema.validate(req.body);
  if (error) {
    const msg = error.details.map((el) => el.message).join(",");
    throw new ExpressError(msg, 400);
  }
  const username = req.user.username;

  if (req.body.from === "search") {
    const { offers, sector, type, auctionType } =
      await validateCreateFromMultipleOffers(username, req.body.offerIds);

    res.locals = {
      offers,
      sector,
      type,
      auctionType,
    };
  } else {
    // Otherwise it's from a single owned offer.
    const { offer, auctionType } = await validateCreateFromSingleOffer(
      username,
      req.body.offerId
    );
    const users = await User.find({ username: { $nin: [username] } }).exec();

    res.locals = {
      offer,
      auctionType,
      users,
    };
  }

  next();
};

module.exports.validatePostCreateAuction = async (req, res, next) => {
  const { error } = getCreateAuctionSchema.validate(req.body);
  if (error) {
    const msg = error.details.map((el) => el.message).join(",");
    throw new ExpressError(msg, 400);
  }
  const username = req.user.username;
  const fromSearch = req.body.members === undefined;

  if (fromSearch) {
    const { offers, sector, type, auctionType } =
      await validateCreateFromMultipleOffers(username, req.body.offerIds);

    res.locals = {
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
      req.body.offerId
    );
    let members = await validateMembers(username, req.body.members);

    res.locals = {
      offer,
      auctionType,
      members,
      fromSearch,
    };
  }

  next();
};
