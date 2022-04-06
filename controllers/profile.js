const User = require("../models/user");
const Offer = require("../models/offer");
const Profile = require("../models/profile");
const ExpressError = require("../utils/ExpressError");
const { getPage, createPagination } = require("../lib/paginate");
const ne = require("../lib/ne");

const BrokerAgreement = require("../models/brokerAgreement");

/**
 * Shows a user's profile page.
 *
 * Throws a 404 if the username cannot be found.
 *
 * @param {*} req
 * @param {*} res
 */
module.exports.show = async (req, res) => {
  const { username } = req.params;

  const user = await User.findOne({ username });
  if (!user) {
    throw new ExpressError("User not found", 404);
  }

  let [profile, offers, agreement] = await Promise.all([
    Profile.findOne({ user: user._id }),
    Offer.find({ author: user._id }).populate("author").countDocuments(),
    BrokerAgreement.find({ subject: user._id }).exec(),
  ]);

  // Profiles are lazily created, so if it cannot be found for a valid user,
  // pass along an empty object.
  if (!profile) {
    profile = {};
  }

  const auctions = await ne.getAuctionHistory(username);
  const wins = auctions.reduce((acc, auction) => {
    if (auction.payload.highest_bidder.val[0] === username) {
      return acc + 1;
    } else {
      return acc;
    }
  }, 0);

  res.render("profile/show", {
    user,
    profile,
    wins,
    active: auctions.length,
    offers,
    agreement,
  });
};

/**
 * Shows the edit profile page.
 *
 * @param {*} req
 * @param {*} res
 */
module.exports.edit = async (req, res) => {
  const { _id } = req.user;

  let profile = await Profile.findOne({ user: _id });
  if (!profile) {
    profile = {};
  }

  res.render("profile/edit", {
    profile,
  });
};

/**
 * Handles updating a user's profile.
 *
 * @param {*} req
 * @param {*} res
 */
module.exports.update = async (req, res) => {
  const { _id, username } = req.user;

  await Profile.findOneAndUpdate({ user: _id }, req.body, { upsert: true });

  req.flash("success", "Successfully updated profile");
  res.redirect(`/profile/${username}`);
};

/**
 * View all of a user's offers.
 *
 * @param {*} req
 * @param {*} res
 */
module.exports.offers = async (req, res) => {
  const { username } = req.params;
  const page = getPage(req.query.page);
  const perPage = 18;

  const user = await User.findOne({ username });
  const [offers, count] = await Promise.all([
    Offer.find({ author: user._id })
      .populate("author")
      .sort({ _id: 1 })
      .skip(perPage * (page - 1))
      .limit(perPage),
    Offer.countDocuments({ author: user._id }),
  ]);

  res.render("profile/offers", {
    username,
    page: createPagination(offers, count, page, perPage),
  });
};

/**
 * Display the page for a broker to create a representation agreement with a user.
 *
 * TODO: Should maybe support the other way around as well, a user requesting a broker
 * to represent them.
 *
 * @param {*} req
 * @param {*} res
 */
module.exports.represent = async (req, res) => {
  const { username } = req.params;

  res.render("profile/represent", { username });
};

/**
 * Handler to request to a broker for a certain user.
 *
 * The logged in user requests to be a broker of the user of the username in the
 * passed url.
 *
 * @param {*} req
 * @param {*} res
 */
module.exports.requestRepresentation = async (req, res) => {
  const { username } = req.params;
  const { _id } = req.user;

  // Check that an agreement does not already exist.
  const agreementCount = await BrokerAgreement.countDocuments({
    $or: [{ agent: _id }, { subject: _id }],
  });
  if (agreementCount > 0) {
    throw new ExpressError("agreement already exists", 400);
  }

  const subject = await User.findOne({ username });
  const request = new BrokerAgreement({
    agent: _id,
    subject: subject._id,
    accepted: false,
  });
  await request.save();

  req.flash("success", "Successfully requested broker agreement");
  res.redirect(`/profile/${username}`);
};

/**
 * Handler to show all the pending agreements.
 *
 * This displays both sent and received agreements. However, the sent agreements
 * should only be valid if the user is a broker.
 *
 * @param {*} req
 * @param {*} res
 */
module.exports.representationPendingAgreements = async (req, res) => {
  const { _id } = req.user;

  const [agreementsSent, agreements] = await Promise.all([
    BrokerAgreement.find({ agent: _id, accepted: false })
      .populate("subject")
      .exec(),
    BrokerAgreement.find({ subject: _id, accepted: false })
      .populate("agent")
      .exec(),
  ]);
  console.log("agreements sent: ", agreementsSent);
  console.log("agreements recv: ", agreements);

  res.render("profile/representation/pending", { agreementsSent, agreements });
};

/**
 * Handler to display all the current agreements in place.
 *
 * @param {*} req
 * @param {*} res
 */
module.exports.representationAllAgreements = async (req, res) => {
  const { _id } = req.user;

  const [agreementsCreated, agreements] = await Promise.all([
    BrokerAgreement.find({ agent: _id, accepted: true })
      .populate("subject")
      .exec(),
    BrokerAgreement.find({ subject: _id, accepted: true })
      .populate("agent")
      .exec(),
  ]);
  console.log("agreements created: ", agreementsCreated);
  console.log("agreements recv: ", agreements);

  res.render("profile/representation/list", {
    agreementsCreated,
    agreements,
  });
};

module.exports.acceptAgreement = async (req, res) => {
  const { agreementId } = req.params;
  const { _id, username } = req.user;
  console.log("Accept agreement handler");

  const agreement = await BrokerAgreement.findById(agreementId);
  if (agreement.subject != _id || agreement.accepted) {
    throw new ExpressError("cannot accept this", 403);
  }

  agreement.accepted = true;
  await agreement.save();

  req.flash("success", "Successfully accepted agreement");
  res.redirect(`/profile/${username}`);
};

module.exports.fetchPendingAgreementsCount = async (userId) => {
  const count = await BrokerAgreement.countDocuments({
    subject: userId,
    accepted: false,
  });
  console.log("count", count);
  return count;
};
