const Joi = require("joi");
const axios = require("axios");
const Offer = require("../models/offer");
const formatDistanceToNow = require("date-fns/formatDistanceToNow");
const formatDate = require("date-fns/format");

const NE_BASE_URL =
  process.env.NEGOTIATION_ENGINE_BASE_URL || "http://localhost:5000";

// Converts from a Javascript date to a time format NegotationEngine accepts.
//
// The required date is similar to an ISO string, but not quite. An ISO string
// can be: '2022-01-19T15:42:25.373Z', and the required format is
// YYYY-MM-DDTHH:MM:SS, so we have to cut off after the seconds.
const createNeTimeString = (originalTime) => {
  return originalTime.toISOString().split(".")[0];
};

// Take a date string without a timezone and parses it as UTC and returns
// it as a date.
const parseAsUTCDate = (dateString) => {
  return new Date(dateString.split(".")[0] + " UTC");
};

const showDistanceToNow = (dateString) => {
  return formatDistanceToNow(parseAsUTCDate(dateString));
};

const displayDate = (dateString) => {
  return formatDate(parseAsUTCDate(dateString), "yyyy-MM-dd HH:mm");
};

/**
 * Renders the page to create auctions.
 *
 * @param {*} req
 * @param {*} res
 */
module.exports.create = async (_req, res) => {
  res.render("auctions/create", {});
};

// Schema to validate inputs to `createAuction`.
const createAuctionSchema = Joi.object({
  room_name: Joi.string().required(),
  auction_type: Joi.string().required(),
  closing_time: Joi.date().min(Date.now()).required(),
  reference_sector: Joi.string().required(),
  reference_type: Joi.string().required(),
  quantity: Joi.number().required(),
  members: Joi.string().required(),
  articleno: Joi.string()
    .pattern(/^[0-9a-fA-F]{24}$/, "offerId")
    .required(),
  template_type: Joi.string().required(),
});

/**
 * Calls NegotationEngine to actually create the auction.
 *
 * @param {*} req
 * @param {*} res
 */
module.exports.createAuction = async (req, res) => {
  // Validate inputs and convert closing time to the correct format.
  let data = await createAuctionSchema.validateAsync(req.body);
  data.closing_time = createNeTimeString(data.closing_time);

  // Check that the offer id is valid and that the offer exists.
  const offerId = data.articleno;
  const numMatchingOffers = await Offer.count({ _id: offerId });
  if (numMatchingOffers == 0) {
    req.flash("error", "Failed to create auction: Invalid offer ID");
    res.render("auctions/create");
    return;
  }

  try {
    const username = req.user.username;
    const params = new URLSearchParams(data);
    const response = await axios.post(`${NE_BASE_URL}/create-room`, params, {
      auth: { username },
    });

    // Response data contains a message, which contains the auction name and id.
    // We are interested in the ID here.
    // Example response: "The room auction #1 has been created id: 61e7f7e20daf6671113c4941"
    const auctionId = response.data.message.split("id: ")[1];

    req.flash("success", "Successfully created auction");
    res.redirect(`/auctions/${auctionId}`);
  } catch (error) {
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
  auction.canEnd =
    parseAsUTCDate(auction.payload.closing_time.val[0]) <= Date.now();
  auction.ended = auction.payload.buyersign.val[0] !== "";

  const offerId = auction.payload.articleno.val[0];
  const offer = await Offer.findById(offerId);

  res.render("auctions/show", {
    auction,
    offer,
    showDistanceToNow,
    displayDate,
  });
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

  const auctions = await Promise.all(
    response.data.map(async (auction) => {
      const offerId = auction.payload.articleno.val[0];
      const offer = await Offer.findById(offerId);
      return { auction, offer };
    })
  );

  res.render("auctions/index", { auctions });
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

  const auctions = await Promise.all(
    response.data.map(async (auction) => {
      const offerId = auction.payload.articleno.val[0];
      const offer = await Offer.findById(offerId);
      return { auction, offer };
    })
  );

  res.render("auctions/history", { auctions });
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
