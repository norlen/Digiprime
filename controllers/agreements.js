const BrokerAgreement = require("../models/brokerAgreement");
const User = require("../models/user");
const ExpressError = require("../utils/ExpressError");

/**
 * Display the page for a broker to create a representation agreement with a user.
 *
 * Requires the user to be logged in and that the user is a broker.
 *
 * TODO: Should maybe support the other way around as well, a user requesting a broker
 * to represent them.
 *
 * ## Parameters
 * - `username`: expects the other party's username as a parameter.
 *
 * ## Success
 * Shows the page to create an agreement between the two parties.
 *
 * @param {*} req
 * @param {*} res
 */
module.exports.createPage = async (req, res) => {
  const { username } = req.params;
  res.render("agreements/create", { username });
};

/**
 * Handler to request to a broker for a certain user.
 *
 * The logged in user requests to be a broker of the user of the username in the
 * passed url.
 *
 * ## Parameters
 * - `username`: Requires the other party's username to be present.
 *
 * ## Success
 * Redirects back to the other party's profile page.
 *
 * ## Errors
 * - 400 Bad Request if an agreement between the two parties already exist.
 * - 400 Bad Request if the user tries to enter into an agreement with another
 *   broker.
 *
 * @param {*} req
 * @param {*} res
 */
module.exports.create = async (req, res) => {
  const { username } = req.params;
  const { _id } = req.user;

  const subject = await User.findOne({ username });
  if (subject.role === "broker") {
    throw new ExpressError("Cannot create agreement with a broker", 400);
  }

  // Check that an agreement does not already exist.
  const agreementCount = await BrokerAgreement.countDocuments({
    subject: subject._id,
    canceled: false,
  });
  if (agreementCount > 0) {
    throw new ExpressError("Agreement already exists", 400);
  }

  // Create agreement request.
  const request = new BrokerAgreement({
    agent: _id,
    subject: subject._id,
    accepted: false,
    canceled: false,
  });
  await request.save();

  req.flash("success", "Successfully requested broker agreement");
  res.redirect(`/profile/${username}`);
};

/**
 * Cancels either a pending or active agreement.
 *
 * ## Parameters
 * - `agreementId`: ID of the agreement.
 *
 * ## Success
 * Cancels the agreement and redirects to the current user's profile.
 *
 * ## Errors
 * - 404 Not Found if the `agreementId` cannot be found.
 * - 403 Unauthorized if the current user is not an agent or subject of the
 *   agreement.
 *
 * @param {*} req
 * @param {*} res
 */
module.exports.cancel = async (req, res) => {
  const { _id, username } = req.user;
  const { agreementId } = req.params;

  const agreement = await BrokerAgreement.findById(agreementId);
  if (!agreement) {
    throw new ExpressError("Agreement not found", 404);
  }
  if (!(agreement.agent != _id || agreement.subject != _id)) {
    throw new ExpressError("Cannot cancel this agreement", 403);
  }

  agreement.canceled = true;
  await agreement.save();

  req.flash("success", "Successfully cancelled agreement");
  res.redirect(`/profile/${username}`);
};

/**
 * Display the full information about a single agreement.
 *
 * ## Parameters
 * - `agreementId`: The agreement id to show.
 *
 * ## Success
 * Shows the current agreements page.
 *
 * ## Errors
 * - 404 Not Found if the agreement cannot be found.
 * - 403 Unauthorized if the current user is not the agent or subject of the
 *   agreement
 *
 * The 403 may change to a 404, if we decide that we this leaks information
 * about current agreements.
 *
 * @param {*} req
 * @param {*} res
 */
module.exports.show = async (req, res) => {
  const { agreementId } = req.params;
  const { _id } = req.user;

  const agreement = await BrokerAgreement.findById(agreementId);
  if (!agreement) {
    throw new ExpressError("Agreement not found", 404);
  }
  if (!(agreement.subject._id == _id || agreement.agent._id == _id)) {
    throw new ExpressError("Cannot view this agreement", 403);
  }

  res.render("agreements/show", {
    agreement,
  });
};

/**
 * Handler to list all pending agreements.
 *
 * This displays both sent and received agreements. However, the sent agreements
 * should only be valid if the user is a broker.
 *
 * ## Success
 * Render page containing all pending agreements.
 *
 * @param {*} req
 * @param {*} res
 */
module.exports.listPending = async (req, res) => {
  const { _id, role } = req.user;

  let agreements;
  if (role === "broker") {
    agreements = await BrokerAgreement.find({
      agent: _id,
      accepted: false,
      canceled: false,
    })
      .populate("subject")
      .exec();
  } else {
    agreements = await BrokerAgreement.find({
      subject: _id,
      accepted: false,
      canceled: false,
    })
      .populate("agent")
      .exec();
  }

  res.render("agreements/pending", { agreements });
};

/**
 * Handler to display all the current agreements in place.
 *
 * ## Success
 * Render page containing all active agreements.
 *
 * @param {*} req
 * @param {*} res
 */
module.exports.list = async (req, res) => {
  const { _id, role } = req.user;

  let agreements;
  if (role === "broker") {
    agreements = await BrokerAgreement.find({
      agent: _id,
      accepted: true,
      canceled: false,
    })
      .populate("subject")
      .exec();
  } else {
    agreements = await BrokerAgreement.find({
      subject: _id,
      accepted: true,
      canceled: false,
    })
      .populate("agent")
      .exec();
  }

  res.render("agreements/list", { agreements });
};

/**
 * Handler to accept a specific agreement.
 *
 * This takes a pending agreement and accepts it.
 *
 * ## Parameters
 * - `agreementId`: The agreement to accept.
 *
 * ## Success
 * Redirects to the current user's profile page.
 *
 * ## Errors
 * - 404 Not Found if the `agreementId` does not exist.
 * - 403 Unauthorized if the current user is not the subject of the agreement.
 *
 * @param {*} req
 * @param {*} res
 */
module.exports.acceptAgreement = async (req, res) => {
  const { agreementId } = req.params;
  const { _id, username } = req.user;

  const agreement = await BrokerAgreement.findById(agreementId);
  if (!agreement) {
    throw new ExpressError("Agreement not found", 404);
  }
  if (agreement.canceled || agreement.subject != _id) {
    throw new ExpressError("Not authorized to accept this agreement", 403);
  }

  agreement.accepted = true;
  await agreement.save();

  req.flash("success", "Successfully accepted agreement");
  res.redirect(`/profile/${username}`);
};

/**
 * Helper to fetch the current agreement count for the given user.
 *
 * @param {string} userId
 * @returns number of pending agreements.
 */
module.exports.fetchPendingAgreementsCount = async (userId) => {
  const count = await BrokerAgreement.countDocuments({
    accepted: false,
    canceled: false,
    $or: [{ agent: userId }, { subject: userId }],
  });
  return count;
};
