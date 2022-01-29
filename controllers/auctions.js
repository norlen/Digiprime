const Joi = require("joi");
const axios = require("axios");
const Offer = require("../models/offer");
const {
  createNeTimeString,
  parseAsUTCDate,
  showDistanceToNow,
  displayDate,
} = require("../utils/time");

const NE_BASE_URL =
  process.env.NEGOTIATION_ENGINE_BASE_URL || "http://localhost:5000";

/**
 * Renders the page to create auctions.
 *
 * @param {*} req
 * @param {*} res
 */
module.exports.create = async (req, res) => {
  const { from, offerId } = req.query;
  if (from === "search") {
    if (!offerId || !Array.isArray(offerId) || offerId.length < 2) {
      throw new Error("Invalid offer id");
    }

    const offers = await Offer.find({ _id: { $in: offerId } }).exec();
    if (offers.length !== offerId.length) {
      throw new Error("Invalid offer ids");
    }

    let sector = offers[0].referenceSector;
    let type = offers[0].referenceType;
    let costumer = offers[0].costumer;
    for (let i = 1; i < offers.length; ++i) {
      if (
        offers[i].referenceSector !== sector ||
        offers[i].referenceType !== type ||
        offers[i].costumer !== costumer
      ) {
        throw new Error("Offers do not match");
      }
    }
    console.log(offers);
    let auctionCustomer =
      costumer.toLowerCase() === "supply" ? "Demand" : "Supply";

    const combinedOfferIds = offerId.join(",");
    res.render("auctions/create-multiple-offers", {
      offers,
      info: { sector, type, costumer, auctionCustomer },
      offerIds: combinedOfferIds,
    });
  } else {
    res.render("auctions/create", {});
  }
};

// Schema to validate inputs to `createAuction`.
const createAuctionSchema = Joi.object({
  room_name: Joi.string().required(),
  auction_type: Joi.string().required(),
  closing_time: Joi.date().min(Date.now()).required(),
  reference_sector: Joi.string().required(),
  reference_type: Joi.string().required(),
  quantity: Joi.number().required(),
  // members: Joi.string().required(),
  // articleno: Joi.string()
  //   .pattern(/^[0-9a-fA-F]{24}$/, "offerId")
  //   .required(),
  template_type: Joi.string().required(),
  articleno: Joi.array(),
  members: Joi.string(),
});

/**
 * Calls NegotationEngine to actually create the auction.
 *
 * @param {*} req
 * @param {*} res
 */
module.exports.createAuction = async (req, res) => {
  const username = req.user.username;
  req.body.template_type = "article";

  // Validate inputs and convert closing time to the correct format.
  let data = await createAuctionSchema.validateAsync(req.body);
  data.closing_time = createNeTimeString(data.closing_time);

  if (Array.isArray(req.body.articleno)) {
    // New style auction.
    const matchingOffers = await Offer.find({
      _id: { $in: data.articleno },
    })
      .populate("author")
      .exec();

    if (matchingOffers.length !== req.body.articleno.length) {
      req.flash("error", "Failed to create auction: Invalid offer ID");
      res.render("auctions/create");
      return;
    }

    currentMembers = {};
    data.articleno = data.articleno.join(",");
    data.members = matchingOffers
      .map((offer) => {
        const member = offer.author.username;
        if (currentMembers[member]) {
          throw new Error("Cannot add multiple offers from the same company");
        }
        currentMembers[member] = true;
        if (member === username) {
          throw new Error(
            "Cannot create an auction where you are a participant"
          );
        }
        return offer.author.username;
      })
      .join(",");
  } else {
    // Old style auction.
    if (req.body.members === "") {
      throw new Error("Members must be specified");
    }

    // Check that the offer id is valid and that the offer exists.
    const offerId = data.articleno;
    const numMatchingOffers = await Offer.count({ _id: offerId });
    if (numMatchingOffers == 0) {
      req.flash("error", "Failed to create auction: Invalid offer ID");
      res.render("auctions/create");
      return;
    }
  }

  try {
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
  const auctions = response.data;

  // console.log(response.data);

  // const auctions = await Promise.all(
  //   response.data.map(async (auction) => {
  //     const offerId = auction.payload.articleno.val[0];
  //     const offer = await Offer.findById(offerId);
  //     return { auction, offer };
  //   })
  // );

  res.render("auctions/index", { auctions, showDistanceToNow });
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

module.exports.getBids = async (req, res) => {
  const username = req.user.username;
  const auctionId = req.params.id;

  try {
    const response = await axios.get(`${NE_BASE_URL}/rooms/${auctionId}`, {
      auth: { username },
    });

    const allBids = response.data.Bids;
    res.render("/auctions/showBids", { allBids });
  } catch (error) {
    if (error.isAxiosError && error.response.status === 404) {
      req.flash("error", error.response.data);
      res.redirect("/auctions");
    } else {
      throw error;
    }
  }
};
