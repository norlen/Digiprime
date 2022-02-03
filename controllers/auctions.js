const Joi = require("joi");
const axios = require("axios");
const Offer = require("../models/offer");
const User = require("../models/user");
const {
  createNeTimeString,
  parseAsUTCDate,
  showDistanceToNow,
  displayDate,
} = require("../utils/time");

const NE_BASE_URL =
  process.env.NEGOTIATION_ENGINE_BASE_URL || "http://localhost:5000";

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

/**
 * Renders the page to create auctions.
 *
 * @param {*} req
 * @param {*} res
 */
module.exports.create = async (req, res) => {
  const q = await createQuerySchema.validateAsync(req.query);
  const username = req.user.username;

  if (q.from === "search") {
    // Check if we should render the template for that contains multiple non-owned offers.
    const { offers, sector, type, auctionType } =
      await validateCreateFromMultipleOffers(username, q.offerIds);

    const combinedOfferIds = q.offerIds.join(",");
    res.render("auctions/create-multiple-offers", {
      offers,
      info: { sector, type, auctionType },
      offerIds: combinedOfferIds,
    });
  } else {
    // Otherwise it's from a single owned offer.
    const { offer, auctionType } = await validateCreateFromSingleOffer(
      username,
      q.offerId
    );
    const users = await User.find({ username: { $nin: [username] } }).exec();

    res.render("auctions/create-single", {
      offer,
      auctionType,
      users,
    });
  }
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

/**
 * Calls NegotationEngine to actually create the auction.
 *
 * @param {*} req
 * @param {*} res
 */
module.exports.createAuction = async (req, res) => {
  const data = await CreateAuctionSchema.validateAsync(req.body);
  const username = req.user.username;
  const fromSearch = data.members === undefined;

  let params = {};
  if (fromSearch) {
    // Auction created from an offer search.
    const { offers, sector, type, auctionType } =
      await validateCreateFromMultipleOffers(username, data.offerIds);
    const members = offers.map((offer) => offer.author.username);

    params = {
      articleno: data.offerIds.join(","),
      reference_sector: sector,
      reference_type: type,
      auction_type: auctionType,
      members,
      privacy: "Private",
    };
  } else {
    // Auction created from a single owned offer.
    // Validate that all offers exists, and that all members exist.
    const { offer, auctionType } = await validateCreateFromSingleOffer(
      username,
      data.offerId
    );
    let members = await validateMembers(username, data.members);

    params = {
      articleno: data.offerId,
      reference_sector: offer.referenceSector,
      reference_type: offer.referenceType,
      auction_type: auctionType,
      members: members,
      privacy: data.privacy,
    };
  }

  // Create auction in NE
  try {
    params = {
      ...params,
      room_name: data.auctionTitle,
      quantity: data.quantity,
      closing_time: createNeTimeString(data.closingTime),
      template_type: "article",
    };

    const urlParams = new URLSearchParams(params);
    const response = await axios.post(`${NE_BASE_URL}/create-room`, urlParams, {
      auth: { username },
    });
    // Response data contains a message, which contains the auction name and id.
    // We are interested in the ID here.
    // Example response: "The room auction #1 has been created id: 61e7f7e20daf6671113c4941"
    const auctionId = response.data.message.split("id: ")[1];

    req.flash("success", "Successfully created auction");
    res.redirect(`/auctions/${auctionId}`);
  } catch (error) {
    console.error(error.response.data);

    req.flash("error", "Failed to create auction");
    res.render("auctions/create");
  }
};

/**
 * Display a single auction.
 *
 * @param {*} req
 * @param {*} res
 */
module.exports.show = async (req, res) => {
  const username = req.user.username;
  const auctionId = req.params.id;

  const response = await axios.get(`${NE_BASE_URL}/rooms/${auctionId}/info`, {
    auth: { username },
  });

  let auction = response.data;
  auction.closed =
    parseAsUTCDate(auction.payload.closing_time.val[0]) <= Date.now();
  auction.ended = auction.payload.buyersign.val[0] !== "";
  auction.closingTime = parseAsUTCDate(auction.payload.closing_time.val[0]);

  const articleNumbers = auction.payload.articleno.val[0].split(",");
  if (articleNumbers.length > 1) {
    // New auction.
    let offers = await Offer.find({ _id: { $in: articleNumbers } })
      .populate("author")
      .exec();

    // Map bids to offers.
    let member_to_bid = {};
    for (let bid of auction.bids) {
      member_to_bid[bid.sender] = bid;
    }

    const offersWithBids = offers.map((offer) => ({
      ...offer._doc,
      bid: member_to_bid[offer.author.username],
    }));

    res.render("auctions/show-multiple-offers", {
      auction,
      offers: offersWithBids,
      showDistanceToNow,
      displayDate,
    });
  } else {
    const offer = await Offer.findById(articleNumbers[0]);

    res.render("auctions/show", {
      auction,
      offer,
      showDistanceToNow,
      displayDate,
    });
  }
};

/**
 * Fetch auctions that are active, that you created or participate in
 * indexpage.
 *
 * @param {*} req
 * @param {*} res
 */
module.exports.index = async (req, res) => {
  const username = req.user.username;

  const response = await axios.get(`${NE_BASE_URL}/rooms/active`, {
    auth: { username },
  });
  const sortedAuctions = response.data.map((auction) => {
    auction.closingTime = parseAsUTCDate(auction.payload.closing_time.val[0]);
    auction.closed = auction.closingTime <= Date.now();
    return auction;
  });
  sortedAuctions.sort((lhs, rhs) => rhs.closingTime - lhs.closingTime);

  const perPage = 5;
  const {
    data: auctions,
    currentPage,
    totalPages,
  } = pagination(sortedAuctions, req.query.page, perPage);

  res.render("auctions/index", {
    auctions,
    showDistanceToNow,
    currentPage,
    totalPages,
  });
};

/**
 * Fetch list of all completed auctions and render template.
 *
 * @param {*} req
 * @param {*} res
 */
module.exports.history = async (req, res) => {
  const username = req.user.username;

  const response = await axios.get(`${NE_BASE_URL}/rooms/history`, {
    auth: { username },
  });

  const perPage = 10;
  const {
    data: auctions,
    currentPage,
    totalPages,
  } = pagination(response.data, req.query.page, perPage);

  res.render("auctions/history", {
    auctions,
    currentPage,
    totalPages,
  });
};

// Schema to validate inputs when placing a bid at an auction.
const placeBidSchema = Joi.object({
  id: Joi.string()
    .pattern(/^[0-9a-fA-F]{24}$/, "auctionId")
    .required(),
  bid: Joi.number().min(1).required(),
});

/**
 * Place a single bid to Negotiation Engine and refresh the page to display.
 *
 * @param {*} req
 * @param {*} res
 */
module.exports.placeBid = async (req, res) => {
  const username = req.user.username;
  const { id: auctionId, bid } = await placeBidSchema.validateAsync({
    ...req.params,
    ...req.body,
  });

  try {
    const params = new URLSearchParams({ message_input: bid });
    await axios.post(`${NE_BASE_URL}/rooms/${auctionId}`, params, {
      auth: { username },
    });
    req.flash("success", `Successfully placed bid: ${bid}`);
    res.redirect(`/auctions/${auctionId}`);
  } catch (error) {
    if (error.isAxiosError) {
      req.flash("error", error.response.data.message);
    } else {
      req.flash("error", "Failed to place bid.");
    }
    res.redirect(`/auctions/${auctionId}`);
  }
};

// Validate inputs to `selectWinner`.
const selectWinnerSchema = Joi.object({
  id: Joi.string()
    .pattern(/^[0-9a-fA-F]{24}$/)
    .required(),
  winner: Joi.string().required(),
});

/**
 * Takes a winner and marks that user as the winner of the auction.
 *
 * @param {*} req
 * @param {*} res
 */
module.exports.selectWinner = async (req, res) => {
  const username = req.user.username;
  const { id: auctionId, winner } = await selectWinnerSchema.validateAsync({
    ...req.params,
    ...req.body,
  });

  try {
    const params = new URLSearchParams({ winner });
    const response = await axios.post(
      `${NE_BASE_URL}/rooms/${auctionId}/end`,
      params,
      { auth: { username } }
    );

    // Success cases:
    // 1. Set winner.
    // 2. Winner has already been selected.
    // So, if the case is not (1) we should display an error.
    if (response.data.message === "winner has been selected") {
      req.flash("success", `${winner} has been selected as the winner`);
      res.redirect(`/auctions/${auctionId}`);
    } else {
      req.flash("error", request.data.message);
      res.redirect(`/auctions/${auctionId}`);
    }
  } catch (error) {
    // Failure cases:
    // 1. Selected winner does not participate in auction.
    // 2. Not room admin.
    if (
      error.isAxiosError &&
      (error.response.status === 400 || error.response.status === 403)
    ) {
      req.flash("error", error.response.data.message);
      res.redirect(`/auctions/${auctionId}`);
    }

    // For other errors, we display the regular error.
    throw error;
  }
};

module.exports.getBids = async (req, res) => {
  const username = req.user.username;
  const auctionId = req.params.id;

  try {
    const response = await axios.get(`${NE_BASE_URL}/rooms/${auctionId}`, {
      auth: { username },
    });

    const perPage = 10;
    const {
      data: allBids,
      currentPage,
      totalPages,
    } = pagination(response.data.Bids, req.query.page, perPage);

    res.render("auctions/showBids", { allBids, displayDate, currentPage, totalPages, auctionId, perPage });
  } catch (error) {
    if (error.isAxiosError && error.response.status === 404) {
      req.flash("error", error.response.data);
      res.redirect("/auctions");
    } else {
      throw error;
    }
  }
};

/**
 * Returns elementPerPage number of elements from the array passed. The array should be sorted
 * before passed here.
 *
 * @param {any[]} array
 * @param {number} page
 * @param {number} elementsPerPage
 * @returns array with elements from the current page.
 */
const pagination = (array, currentPage, elementsPerPage) => {
  const totalPages = Math.floor(array.length / elementsPerPage) + 1;
  let currPage = 1;

  try {
    if (typeof currentPage === "number") {
      currPage = Math.max(1, currentPage);
    }
    if (typeof currentPage === "string") {
      const parsed = parseInt(currentPage);
      if (!isNaN(parsed)) {
        currPage = Math.max(1, parsed);
      }
    }
  } catch (err) {}

  // Pages are 1-indexed, so convert to zero index.
  const startIdx = (currPage - 1) * elementsPerPage;
  const data = array.splice(startIdx, elementsPerPage);

  return {
    data,
    currentPage: currPage,
    totalPages,
  };
};
