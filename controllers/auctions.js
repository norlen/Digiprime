const Offer = require("../models/offer");
const User = require("../models/user");
const formatDistanceToNow = require("date-fns/formatDistanceToNow");
const ne = require("../lib/ne");
const {
  displayDate,
  validateCreateFromSingleOffer,
  validateCreateFromMultipleOffers,
  validateMembers,
} = require("../lib/auction");
const { paginate, createPagination, getPage } = require("../lib/paginate");

/**
 * Render auction creation page for a single offer.
 *
 * @param {*} req
 * @param {*} res
 */
const createAuctionSingle = async (req, res) => {
  const { offerId } = req.query;
  const { username } = req.user;

  // Otherwise it's from a single owned offer.
  const { offer, auctionType } = await validateCreateFromSingleOffer(
    username,
    offerId
  );
  const users = await User.find({ username: { $nin: [username] } }).exec();

  res.render("auctions/create-single", {
    offer,
    auctionType,
    users,
  });
};

/**
 * Render auction creation page for multiple offers.
 *
 * @param {*} req
 * @param {*} res
 */
const createAuctionMultiple = async (req, res) => {
  const { offerIds } = req.query;
  const { username } = req.user;

  // Check if we should render the template for that contains multiple non-owned offers.
  const { offers, ...rest } = await validateCreateFromMultipleOffers(
    username,
    offerIds
  );

  res.render("auctions/create-multiple-offers", {
    offers,
    info: { ...rest },
    offerIds: offerIds.join(","),
  });
};

/**
 * Renders the page to create auctions.
 *
 * @param {*} req
 * @param {*} res
 */
module.exports.create = async (req, res) => {
  if (req.query.from === "search") {
    // Check if we should render the template for that contains multiple non-owned offers.
    await createAuctionMultiple(req, res);
  } else {
    // Otherwise it's from a single owned offer.
    await createAuctionSingle(req, res);
  }
};

/**
 * Creates data required for NE call when creating auction for a single offer auction.
 *
 * @param {string} username
 * @param {object} data
 */
const postCreateAuctionSingle = async (username, data) => {
  // Auction created from a single owned offer.
  // Validate that all offers exists, and that all members exist.
  const { offer, auctionType } = await validateCreateFromSingleOffer(
    username,
    data.offerId
  );
  const members = await validateMembers(username, data.members);

  return {
    room_name: data.auctionTitle,
    quantity: data.quantity,
    closing_time: new Date(data.closingTime).toISOString(),
    templatetype: "article",
    articleno: data.offerId,
    reference_sector: offer.referenceSector,
    reference_type: offer.referenceType,
    auction_type: auctionType,
    members,
    privacy: data.privacy,
  };
};

/**
 * Creates data required for NE call when creating auction for a multiple offer auction.
 *
 * @param {string} username
 * @param {object} data
 */
const postCreateAuctionMultiple = async (username, data) => {
  const { offers, sector, type, auctionType } =
    await validateCreateFromMultipleOffers(username, data.offerIds);
  const members = offers.map((offer) => offer.author.username);

  return {
    room_name: data.auctionTitle,
    quantity: data.quantity,
    closing_time: new Date(data.closingTime).toISOString(),
    templatetype: "article",
    articleno: data.offerIds.join(","),
    reference_sector: sector,
    reference_type: type,
    auction_type: auctionType,
    members,
    privacy: "Private",
  };
};

/**
 * Calls NegotationEngine to actually create the auction.
 *
 * @param {*} req
 * @param {*} res
 */
module.exports.createAuction = async (req, res) => {
  const fromSearch = req.body.members === undefined;
  const { username } = req.user;

  try {
    let data;
    if (fromSearch) {
      data = await postCreateAuctionMultiple(username, req.body);
    } else {
      data = await postCreateAuctionSingle(username, req.body);
    }
    const auctionId = await ne.createAuction(username, data);

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

const showSingleAuction = async (req, res, auction, articleNumber) => {
  const offer = await Offer.findById(articleNumber);

  res.render("auctions/show", {
    auction,
    offer,
    formatDistanceToNow,
    displayDate,
  });
};

const showMultipleAuction = async (req, res, auction, articleNumbers) => {
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
};

const showAuctionEnded = async (
  req,
  res,
  username,
  auctionId,
  auction,
  offerIds
) => {
  // We want to display a winning offer here.
  // For the single-offer auction we displayed the auctioned offer.
  // For multiple-offer auction we display the winning offer.

  let offer;
  if (offerIds.length > 1) {
    const offers = await Offer.find({ _id: { $in: offerIds } })
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
    offer = await Offer.findById(offerIds[0]).populate("author");
  }

  const contract = await ne.getWinner(
    username,
    auctionId,
    offer.id,
    offer.title
  );

  res.render("auctions/auction-ended-auctioneer-view", {
    contract,
    auction,
    offer,
    displayDate,
  });
};

/**
 * Display a single auction.
 *
 * @param {*} req
 * @param {*} res
 */
module.exports.show = async (req, res) => {
  const { id: auctionId } = req.params;
  const { username } = req.user;

  // Fetch auction information.
  const auction = await ne.getAuction(username, auctionId);
  const articleNumbers = auction.payload.articleno.val[0].split(",");

  // Check if the user is a winner or creator of auction.
  let isWinnerOrCreator = false;
  if (auction.ended) {
    if (username === auction.payload.created_by.val[0]) {
      isWinnerOrCreator = true;
    }
    if (username === auction.payload.highest_bidder.val[0]) {
      isWinnerOrCreator = true;
    }
  }

  // Render relevant page.
  if (auction.ended && isWinnerOrCreator && auction.highest_bidder !== "") {
    await showAuctionEnded(
      req,
      res,
      username,
      auctionId,
      auction,
      articleNumbers
    );
  } else if (articleNumbers.length > 1) {
    await showMultipleAuction(req, res, auction, articleNumbers);
  } else {
    await showSingleAuction(req, res, auction, articleNumbers[0]);
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
  const { username } = req.user;

  const auctions = await ne.getActiveAuctions(username);
  res.render("auctions/index", {
    page: paginate(auctions, req.query.page, 5),
    formatDistanceToNow,
  });
};

/**
 * Fetch list of all completed auctions and render template.
 *
 * @param {*} req
 * @param {*} res
 */
module.exports.history = async (req, res) => {
  const { username } = req.user;
  const { wins } = req.query;

  let auctions = await ne.getAuctionHistory(username);
  if (wins == "true") {
    auctions = auctions.filter(
      (auction) => auction.payload.highest_bidder.val[0] === username
    );
  }

  res.render("auctions/history", {
    page: paginate(auctions, req.query.page, 10, { wins }),
    displayDate,
  });
};

module.exports.temp = async (req, res) => {
	res.render("messages/messageOverview", {});
};

/**
 * Place a single bid to Negotiation Engine and refresh the page to display.
 *
 * @param {*} req
 * @param {*} res
 */
module.exports.placeBid = async (req, res) => {
  const { id: auctionId } = req.params;
  const { bid } = req.body;
  const { username } = req.user;

  try {
    await ne.placeBid(username, auctionId, bid);

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

/**
 * Takes a winner and marks that user as the winner of the auction.
 *
 * @param {*} req
 * @param {*} res
 */
module.exports.selectWinner = async (req, res) => {
  const { id: auctionId } = req.params;
  const { winner } = req.body;
  const { username } = req.user;

  try {
    await ne.selectWinner(username, auctionId, winner);

    req.flash("success", `${winner} has been selected as the winner`);
    res.redirect(`/auctions/${auctionId}`);
  } catch (error) {
    // Failure cases:
    // 1. Selected winner does not participate in auction.
    // 2. Not room admin.
    // 3. Winner has already been selected.
    if (
      error.isAxiosError &&
      (error.response.status === 400 || error.response.status === 403)
    ) {
      req.flash("error", error.response.data.message);
    } else {
      req.flash("error", error.message);
    }

    res.redirect(`/auctions/${auctionId}`);
  }
};

module.exports.getBids = async (req, res) => {
  const { id: auctionId } = req.params;
  const { username } = req.user;

  try {
    const bids = await ne.getBids(username, auctionId);

    res.render("auctions/show-bids", {
      auctionId,
      page: paginate(bids, req.query.page, 10),
      displayDate,
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

module.exports.listPublic = async (req, res) => {
  const { username } = req.user;
  const page = getPage(req.query.page);
  const perPage = 20;

  const [auctions, count] = await ne.listPublic(username, page, perPage);
  console.log("auctions", auctions);
  console.log("count", count);

  res.render("auctions/list-public", {
    page: createPagination(auctions, count, page, perPage),
    displayDate,
  });
};

module.exports.pub2 = async (req, res) => {
  res.render("auctions/viewSelectedPublic");
};
