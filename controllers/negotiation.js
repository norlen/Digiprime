const Offer = require("../models/offer");
const ne = require("../lib/ne");
const { paginate } = require("../lib/paginate");
const ExpressError = require("../utils/ExpressError");

/**
 * Shows the page for creating a negotiation.
 *
 * @param {*} req
 * @param {*} res
 */
module.exports.showCreate = async (req, res) => {
  const { id: offerId } = req.params;
  const { username } = req.user;

  const [offer, contracts] = await Promise.all([
    Offer.findById(offerId).populate("author"),
    ne.contractList(),
  ]);

  if (!offer) {
    throw new ExpressError("Offer not found", 404);
  }

  // Ensure the other party in the negotiation is another user.
  if (username === offer.author.username) {
    throw new ExpressError("Cannot create a negotiation with yourself", 400);
  }

  res.render("negotiations/create", { offer, contracts });
};

/**
 * Shows the page for displaying a single negotiation.
 *
 * This includes both pages for then it's active and when it's already completed.
 *
 * @param {*} req
 * @param {*} res
 */
module.exports.show = async (req, res) => {
  const { id: negotiationId } = req.params;
  const { username } = req.user;

  const negotiation = await ne.getNegotiation(username, negotiationId);

  res.render("negotiations/show", { negotiation });
};

/**
 * List all of the user's negotiations.
 *
 * @param {*} req
 * @param {*} res
 */
module.exports.list = async (req, res) => {
  const { username } = req.user;

  const negotiations = await ne.listNegotiations(username);

  res.render("negotiations/list", {
    page: paginate(negotiations, req.query.page, 10),
  });
};

/**
 * Create the negotiation and redirect to the newly created negotiation's page.
 *
 * @param {*} req
 * @param {*} res
 */
module.exports.create = async (req, res) => {
  const { username } = req.user;

  const data = {
    offerId: req.params.id,
    title: req.body.negName,
    contract: req.body.contract,
    quantity: req.body.quantity,
    initialPrice: req.body.price,
  };

  const offer = await Offer.findById(offerId).populate("author");
  if (!offer) {
    throw new ExpressError("Offer not found", 404);
  }

  // Ensure the other party in the negotiation is another user.
  if (username === offer.author.username) {
    throw new ExpressError("Cannot create a negotiation with yourself", 400);
  }

  const id = await ne.createNegotiation(
    username,
    data.title,
    data.initialPrice,
    offer.author.username,
    offer.referenceSector,
    offer.referenceType,
    data.quantity,
    data.offerId,
    data.contract
  );

  req.flash("success", `Successfully created negotiation ${data.title}`);
  res.redirect(`/negotiations/${id}`);
};

/**
 * Place a bid on a specific negotiation. Redirects to the negotiation's page.
 *
 * @param {*} req
 * @param {*} res
 */
module.exports.placeBid = async (req, res) => {
  const { username } = req.user;
  const { id } = req.params;
  const { bid } = req.body;

  await ne.negotiationBid(username, id, bid);

  req.flash("success", `Successfully placed bid ${bid}`);
  res.redirect(`/negotiations/${id}`);
};

/**
 * Accept a bid on a negotiation. Redirects to the negotiation's page.
 *
 * @param {*} req
 * @param {*} res
 */
module.exports.accept = async (req, res) => {
  const { username } = req.user;
  const { id } = req.params;

  await ne.negotiationAccept(username, id);

  req.flash("success", "Successfully accepted negotiation");
  res.redirect(`/negotiations/${id}`);
};

/**
 * Cancel the negotiation. Redirects to the negotiation's page.
 *
 * @param {*} req
 * @param {*} res
 */
module.exports.cancel = async (req, res) => {
  const { username } = req.user;
  const { id } = req.params;

  await ne.negotiationCancel(username, id);

  req.flash("success", "Successfully cancelled negotiation");
  res.redirect(`/negotiations/${id}`);
};
