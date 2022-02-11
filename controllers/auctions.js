const Joi = require("joi");
const axios = require("axios");
const Offer = require("../models/offer");
const formatDistanceToNow = require("date-fns/formatDistanceToNow");
const formatDate = require("date-fns/format");
const { createAuction } = require("../lib/ne");

const displayDate = (dateString) => {
  return formatDate(new Date(dateString), "yyyy-MM-dd HH:mm");
};

const NE_BASE_URL =
  process.env.NEGOTIATION_ENGINE_BASE_URL || "http://localhost:5000";

/**
 * Renders the page to create auctions.
 *
 * @param {*} req
 * @param {*} res
 */
module.exports.create = async (req, res) => {
  if (req.query.from === "search") {
    // Check if we should render the template for that contains multiple non-owned offers.
    const { offers, sector, type, auctionType } = req.body;

    const combinedOfferIds = req.query.offerIds.join(",");
    res.render("auctions/create-multiple-offers", {
      offers,
      info: { sector, type, auctionType },
      offerIds: combinedOfferIds,
    });
  } else {
    // Otherwise it's from a single owned offer.
    const { offer, auctionType, users } = req.body;

    res.render("auctions/create-single", {
      offer,
      auctionType,
      users,
    });
  }
};

/**
 * Calls NegotationEngine to actually create the auction.
 *
 * @param {*} req
 * @param {*} res
 */
module.exports.createAuction = async (req, res) => {
  const username = req.user.username;
  const { auctionTitle, quantity, closingTime } = req.body;

  let data = {
    room_name: auctionTitle,
    quantity: quantity,
    closing_time: new Date(closingTime).toISOString(),
    templatetype: "article",
  };

  if (req.body.fromSearch) {
    // Auction created from an offer search.
    const { offerIds, offers, sector, type, auctionType } = req.body;
    const members = offers.map((offer) => offer.author.username);

    data = {
      ...data,
      articleno: offerIds.join(","),
      reference_sector: sector,
      reference_type: type,
      auction_type: auctionType,
      members,
      privacy: "Private",
    };
  } else {
    // Auction created from a single owned offer.
    // Validate that all offers exists, and that all members exist.
    const { offer, auctionType, members, offerId, privacy } = req.body;

    data = {
      ...data,
      articleno: offerId,
      reference_sector: offer.referenceSector,
      reference_type: offer.referenceType,
      auction_type: auctionType,
      members: members,
      privacy: privacy,
    };
  }

  try {
    const auctionId = await createAuction(username, data);

    req.flash("success", "Successfully created auction");
    res.redirect(`/auctions/${auctionId}`);
  } catch (error) {
    if (error.isAxiosError) {
      console.error(error.response.data);
    } else {
      console.error(error);
    }

    req.flash("error", "Failed to create auction");
    res.redirect("/auctions");
  }
};

const getContractDetails = (contract, offerId, offerTitle) => {
  const text = contract.split("Buyer signature")[0];
  const [textPreOfferId, textPostOfferId] = text.split(offerId);
  const buyerSig = contract
    .split("Seller signature")[0]
    .split("Buyer signature")[1];
  const sellerSig = contract.split("Seller signature")[1];
  const offerText = `${offerTitle} (${offerId})`;

  return {
    text: `${textPreOfferId}${offerText}${textPostOfferId}`,
    sellerSignature: sellerSig,
    buyerSignature: buyerSig,
  };
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
  auction.closed = new Date(auction.payload.closing_time.val[0]) <= Date.now();
  auction.ended = auction.payload.buyersign.val[0] !== "";
  auction.closingTime = new Date(auction.payload.closing_time.val[0]);

  let isWinnerOrCreator = false;
  if (auction.ended) {
    if (username === auction.payload.created_by.val[0]) {
      isWinnerOrCreator = true;
    }
    if (username === auction.payload.highest_bidder.val[0]) {
      isWinnerOrCreator = true;
    }
  }

  const articleNumbers = auction.payload.articleno.val[0].split(",");
  if (auction.ended && isWinnerOrCreator) {
    // We want to display a winning offer here.
    // For the single-offer auction we displayed the auctioned offer.
    // For multiple-offer auction we display the winning offer.

    let offer;
    if (articleNumbers.length > 1) {
      const offers = await Offer.find({ _id: { $in: articleNumbers } })
        .populate("author")
        .exec();

      // Get the offer of the highest bidder.
      const highestBidder = auction.payload.highest_bidder.val[0];
      for (let potentialOffer of offers) {
        if (potentialOffer.author.username === highestBidder) {
          offer = potentialOffer;
          break;
        }
      }
    } else {
      offer = await Offer.findById(articleNumbers[0]).populate("author");
    }

    // Get the winning contract from NE.
    const { data: contractData } = await axios.get(
      `${NE_BASE_URL}/rooms/${auctionId}/end`,
      {
        auth: { username },
      }
    );
    const contract = getContractDetails(
      contractData.contract,
      offer._id,
      offer.title
    );

    res.render("auctions/auction-ended-auctioneer-view", {
      contract,
      auction,
      offer,
      displayDate,
    });
  } else {
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
        formatDistanceToNow,
        displayDate,
      });
    } else {
      const offer = await Offer.findById(articleNumbers[0]);

      res.render("auctions/show", {
        auction,
        offer,
        formatDistanceToNow,
        displayDate,
      });
    }
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

  const response = await axios.get(`${NE_BASE_URL}/rooms/all`, {
    auth: { username },
  });
  const sortedAuctions = response.data.map((auction) => {
    auction.closingTime = new Date(auction.payload.closing_time.val[0]);
    auction.closed = auction.closingTime <= Date.now();
    return auction;
  });
  sortedAuctions.sort((lhs, rhs) => rhs.closingTime - lhs.closingTime);

  const filteredAuctions = sortedAuctions.filter((auction) => {
    const hasBids = auction.bids.length > 0;
    const hasWinner = auction.payload.buyersign.val[0] !== "";
    return !auction.closed || (!hasWinner && hasBids);
  });

  const perPage = 5;
  const {
    data: auctions,
    currentPage,
    totalPages,
  } = pagination(filteredAuctions, req.query.page, perPage);

  res.render("auctions/index", {
    auctions,
    formatDistanceToNow,
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

  const response = await axios.get(`${NE_BASE_URL}/rooms/all`, {
    auth: { username },
  });
  const fixedAuctions = response.data.map((auction) => {
    auction.closingTime = new Date(auction.payload.closing_time.val[0]);
    auction.closed = auction.closingTime <= Date.now();
    return auction;
  });
  const filteredAuctions = fixedAuctions.filter((auction) => {
    const hasBids = auction.bids.length > 0;
    const hasWinner = auction.payload.buyersign.val[0] !== "";
    return !(!auction.closed || (!hasWinner && hasBids));
  });

  const perPage = 10;
  const {
    data: auctions,
    currentPage,
    totalPages,
  } = pagination(filteredAuctions, req.query.page, perPage);

  res.render("auctions/history", {
    auctions,
    currentPage,
    totalPages,
    displayDate,
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

    res.render("auctions/showBids", {
      allBids,
      displayDate,
      currentPage,
      totalPages,
      auctionId,
      perPage,
    });
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
