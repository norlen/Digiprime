const axios = require("axios");
const ExpressError = require("../utils/ExpressError");

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
    sign: coordinates,
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
 * @param {string} username who wants to initiate the negotiation.
 * @param {string} name name for the negotiation.
 * @param {number} price initial negotiation price.
 * @param {string} seller seller's username.
 * @param {string} sector reference sector.
 * @param {string} type reference type.
 * @param {number} quantity how much product to negotiate about.
 * @param {string} offerId relevant offer id (should be seller's).
 * @param {string} contract name of the contract.
 * @returns {Promise<string>} the negotiation id.
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
  const auth = { username };

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
  const response = await axios.post(url, params, { auth });
  const id = response.data.message.split(" ")[4];

  return id;
};

/**
 * Retreives a list of all the negotations the user is part of.
 *
 * ## Returns
 *
 * Returns a list of negotiations. See `getNegotiation` for more details.
 *
 * ```json
 * [
 *   {
 *     "_id": "",
 *     "name": "",
 *     "created_by": "",
 *     "seller": "",
 *     "created_at": "",
 *     "end_date": null,
 *     "current_offer": "",
 *     "offer_user": "",
 *     "status": ""
 *   }
 * ]
 *```
 *
 * @param {string} username user to authorize as.
 * @returns list of all negotations the user is part of.
 */
module.exports.listNegotiations = async (username) => {
  const url = `${NE_BASE_URL}/negotiate/list`;
  const auth = { username };
  const { data } = await axios.get(url, { auth });
  return data;
};

/**
 * Retrieves information about the negotiation.
 *
 * ## Errors
 * - `404` if the negotiation cannot be found.
 *
 * ## Status
 * Status can be either
 * - `submitted`: no bids have been placed
 * - `offer`: the creator placed the last bid.
 * - `counter-offer`: the other party placed the last bid.
 * - `accepted`: if the negotiation has been accepted.
 * - `rejected`: if the negotiation has been rejected.
 *
 * ## Returns
 *
 * ### Example response for a newly created negotiation
 *
 * ```json
 * {
 *   "type": "negotiation",
 *   "_id": "",
 *   "name": "",
 *   "created_by": "",
 *   "seller": "",
 *   "created_at": "",
 *   "end_date": null,
 *   "current_offer": "",
 *   "offer_user": "",
 *   "status": "submitted",
 *   "reference_sector": "",
 *   "reference_type": "",
 *   "quantity": "",
 *   "articleno": ""
 * }
 * ```
 *
 * ## Example response when negotiation has been completed
 *
 * ```json
 * {
 *   "type": "contract",
 *   "contract": "",
 * }
 * ```
 *
 * @param {string} username user to authorize as.
 * @param {string} negotiationId Id of the negotiation.
 * @returns either a contract or negotiation info.
 */
module.exports.getNegotiation = async (username, negotiationId) => {
  const url = `${NE_BASE_URL}/negotiate/${negotiationId}/full`;
  const auth = { username };

  // This return either
  // - a contract if the negotiation is done
  // - information about the negotiation
  try {
    const { data } = await axios.get(url, { auth });

    if (data.Contract) {
      return {
        type: "contract",
        contract: data.Contract,
      };
    } else {
      // For the data, it's returned as a list. So grab the element from the list
      return {
        type: "negotiation",
        ...data,
      };
    }
  } catch (error) {
    if (error.isAxiosError && error.response.status === 500) {
      // We get a 500 if the negotation cannot be found.
      throw new ExpressError("Could not find negotiation", 404);
    } else {
      throw error;
    }
  }
};

/**
 * Places a bid in the negotiation.
 *
 * ## Errors
 * - If the user is not part of the negotation a 403 is returned.
 * - If the negotation has finished a 403 is returned.
 *
 * @param {string} username user to authorize as.
 * @param {string} negotiationId Id of the negotiation.
 * @param {number} bid the amount to bid.
 */
module.exports.negotiationBid = async (username, negotiationId, bid) => {
  const url = `${NE_BASE_URL}/negotiate/${negotiationId}`;
  const auth = { username };

  const params = new URLSearchParams({ bid });
  await axios.post(url, params, { auth });
};

/**
 * Accepts the last bid. This is only a valid if the `username` is not the one
 * who has placed the latest bid.
 *
 * ## Errors
 * - If the `username` placed the last bid a `403` is returned.
 * - If `username` is not part of the negotiation a `403` is returned.
 * - If the negotiation is over, or rejected a `403` is returned.
 *
 * @param {string} username user to authorize as.
 * @param {string} negotiationId Id the the negotiation.
 */
module.exports.negotiationAccept = async (username, negotiationId) => {
  const url = `${NE_BASE_URL}/negotiate/${negotiationId}/accept`;
  const auth = { username };

  // This is correct, for some reason this is a GET request.
  await axios.get(url, { auth });
};

/**
 * Cancels the negotation. This is only valid if the `username` did not place the
 * last bid.
 *
 * ## Errors
 * - If the `username` placed the last bid a `403` is returned.
 * - If `username` is not part of the negotiation a `403` is returned.
 * - If the negotiation is over, or rejected a `403` is returned.
 *
 * @param {string} username user to authorize as.
 * @param {string} negotiationId Id the the negotiation.
 */
module.exports.negotiationCancel = async (username, negotiationId) => {
  const url = `${NE_BASE_URL}/negotiate/${negotiationId}/cancel`;
  const auth = { username };

  // This is correct, for some reason this is a GET request.
  await axios.get(url, { auth });
};

/**
 * Creates a new contract in NE.
 *
 * In the contract certain template parameters (`$key`) kan be used. We have
 * to settle on which ones to support.
 *
 * @param {string} title the title of the contract.
 * @param {string} body the body of the contract.
 * @returns {Promise<string>} the created negotiation's id.
 */
module.exports.contractCreate = async (title, body) => {
  const url = `${NE_BASE_URL}/contracts/create`;
  const { data } = await axios.post(url, { title, body });

  return data.id;
};

/**
 * Fetches information about a single contract.
 *
 * ## Errors
 * - `404` if the given contract id is not a valid id.
 *
 * ## Returns
 * ```json
 * {
 *   "_id": "",
 *   "title": "",
 *   "body": ""
 * }
 * ```
 * @param {string} id
 * @returns {Promise<object>} the requested contract.
 */
module.exports.contractGet = async (id) => {
  const url = `${NE_BASE_URL}/contracts/${id}`;
  const { data } = await axios.get(url);

  return data;
};

/**
 * Returns a list of all available contracts. Contains only the `id` and `title`
 *
 * ## Returns
 * ```json
 * [
 *   {
 *     "_id": "",
 *     "title": "",
 *     "body": ""
 *   },
 *   {
 *     "_id": "",
 *     "title": "",
 *     "body": ""
 *   },
 * ]
 * ```
 * @returns {Promise<object[]>} list of all available contracts.
 */
module.exports.contractList = async () => {
  const url = `${NE_BASE_URL}/contracts/list`;
  const { data } = await axios.get(url);
  return data;
};
