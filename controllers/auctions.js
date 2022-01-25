const Joi = require("joi");
const axios = require("axios");
const Offer = require("../models/offer");

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
  articleno: Joi.string().required(),
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
  const validId = offerId.match(/^[0-9a-fA-F]{24}$/);
  if (!validId || (await Offer.count({ _id: offerId })) == 0) {
    req.flash("error", "Failed to create auction: Invalid offer ID");
    res.render("auctions/create");
    return;
  }

  const username = req.user.username;
  const params = new URLSearchParams(data);
  const response = await axios.post(`${NE_BASE_URL}/create-room`, params, {
    auth: { username },
  });

  if (response.status === 200) {
    // Response data contains a message, which contains the auction name and id.
    // We are interested in the ID here.
    // Example response: "The room auction #1 has been created id: 61e7f7e20daf6671113c4941"
    const auctionId = response.data.message.split("id: ")[1];

    req.flash("success", "Successfully created auction");
    res.redirect(`/auctions/${auctionId}`);
  } else {
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
  const auction = response.data;

  const offerId = auction.payload.articleno.val[0];
  const offer = await Offer.findById(offerId);

  res.render("auctions/show", { auction, offer });
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
 * Display current auctions for user
 * 
 * @param {*} req 
 * @param {*} res 
 */
module.exports.currentAuctions = async (req, res) => {
	res.render('auctions/currentAuctions', {  });
};

// Display av singel auktion utan ne, måste kunna skapa en auktion först
module.exports.auction = (req, res) => {
	res.render('auctions/auction', {  });
};

module.exports.history = (req, res) => {
	res.render('auctions/history', { });
};




