const axios = require("axios");

const NE_BASE_URL =
  process.env.NEGOTIATION_ENGINE_BASE_URL || "http://localhost:5000";

const fixAuction = (auction) => {
  auction.closed = new Date(auction.payload.closing_time.val[0]) <= Date.now();
  auction.ended = auction.payload.buyersign.val[0] !== "";
  auction.closingTime = new Date(auction.payload.closing_time.val[0]);
  return auction;
};

module.exports.createAuction = async (username, data) => {
  const url = `${NE_BASE_URL}/create-room`;
  const params = new URLSearchParams(data);
  const auth = { username };
  const response = await axios.post(url, params, { auth });

  // Response data contains a message, which contains the auction name and id.
  // We are interested in the ID here.
  // Example response: "The room auction #1 has been created id: 61e7f7e20daf6671113c4941"
  const auctionId = response.data.message.split("id: ")[1];

  return auctionId;
};

module.exports.getAuction = async (username, auctionId) => {
  const url = `${NE_BASE_URL}/rooms/${auctionId}/info`;
  const auth = { username };
  const response = await axios.get(url, { auth });
  const auction = fixAuction(response.data);
  return auction;
};

module.exports.getActiveAuctions = async (username) => {
  const response = await axios.get(`${NE_BASE_URL}/rooms/all`, {
    auth: { username },
  });
  const auctions = response.data.map(fixAuction);

  // Sort descending closingTime order.
  auctions.sort((lhs, rhs) => rhs.closingTime - lhs.closingTime);

  // Filter out historical auctions.
  const filteredAuctions = auctions.filter((auction) => {
    const hasBids = auction.bids.length > 0;
    const hasWinner = auction.payload.buyersign.val[0] !== "";
    return !auction.closed || (!hasWinner && hasBids);
  });
  return filteredAuctions;
};

module.exports.getAuctionHistory = async (username) => {
  const response = await axios.get(`${NE_BASE_URL}/rooms/all`, {
    auth: { username },
  });
  const auctions = response.data.map(fixAuction);

  // Sort descending closingTime order.
  auctions.sort((lhs, rhs) => rhs.closingTime - lhs.closingTime);

  // Filter out active auctions.
  const filteredAuctions = auctions.filter((auction) => {
    const hasBids = auction.bids.length > 0;
    const hasWinner = auction.payload.buyersign.val[0] !== "";
    return !(!auction.closed || (!hasWinner && hasBids));
  });
  return filteredAuctions;
};

module.exports.placeBid = async (username, auctionId, bid) => {
  const params = new URLSearchParams({ message_input: bid });
  await axios.post(`${NE_BASE_URL}/rooms/${auctionId}`, params, {
    auth: { username },
  });
};

module.exports.selectWinner = async (username, auctionId, winner) => {
  const url = `${NE_BASE_URL}/rooms/${auctionId}/end`;
  const auth = { username };
  const params = new URLSearchParams({ winner });

  const response = await axios.post(url, params, { auth });

  // Success cases:
  // 1. Set winner.
  // 2. Winner has already been selected.
  // So, if the case is not (1) we should display an error.
  if (response.data.message !== "winner has been selected") {
    throw new Error(request.data.message);
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

module.exports.getWinner = async (username, auctionId, offerId, offerTitle) => {
  const url = `${NE_BASE_URL}/rooms/${auctionId}/end`;
  const auth = { username };

  const { data } = await axios.get(url, { auth });
  const contract = getContractDetails(data.contract, offerId, offerTitle);
  return contract;
};

module.exports.getBids = async (username, auctionId) => {
  const response = await axios.get(`${NE_BASE_URL}/rooms/${auctionId}`, {
    auth: { username },
  });
  return response.data.Bids;
};

module.exports.signup = async (username, email, password, coordinates) => {
  await axios.post(`${NE_BASE_URL}/signup`, {
    username,
    email,
    password,
    coordinates,
  });
};

/**
 * Starts a negotiation.
 *
 * ## Request
 *
 * Sends a POST request with the following as a multipart-form.
 * - room_name: {string} name of the negotiation.
 * - price: {number} initial negotiation price.
 * - seller: {string} the other party's username.
 * - reference_sector: {string}
 * - reference_type: {string}
 * - quantity: {number}
 * - articleno: {string} the relevant offer id (should be the seller's).
 * - templatetype: {string} contract.
 *
 * ### Authentication
 * - Basic auth
 *
 * ### Returns
 * ```json
 * {
 *   "message": "The negotiation with id {room_id} has been created"
 * }
 * ```
 *
 * @param {string} username who wants to initiate the negotiation.
 * @param {string} name name for the negotiation.
 * @param {number} price initial negotiation price.
 * @param {string} seller seller's username.
 * @param {string} sector reference sector.
 * @param {string} type reference type.
 * @param {number} quantity how much product to negotiate about.
 * @param {string} offerId relevant offer id (should be seller's).
 * @param {string} contract name of the contract.
 * @returns the negotiation id.
 */
module.exports.createNegotiation = async (
  username,
  name,
  price,
  seller,
  sector,
  type,
  quantity,
  offerId,
  contract
) => {
  const url = `${NE_BASE_URL}/negotiate`;

  const data = {
    room_name: name,
    price,
    seller,
    reference_sector: sector,
    reference_type: type,
    quantity,
    articleno: offerId,
    templatetype: contract,
  };
  const params = new URLSearchParams(data);
  const auth = { username };
  const response = await axios.post(url, params, { auth });
  const id = response.data.message.split(" ")[4];

  return id;
};

/**
 *
 * ## Request
 *
 * - bid: {number} the amount to bid.
 * -
 */

module.exports.dosomething = async (username, negotiationId) => {
  const url = `${NE_BASE_URL}/negotiate/${negotiationId}`;
};
