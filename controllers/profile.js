const User = require("../models/user");
const Offer = require("../models/offer");
const Profile = require("../models/profile");
const ExpressError = require("../utils/ExpressError");
const { getPage, createPagination } = require("../lib/paginate");
const ne = require("../lib/ne");

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

  let [profile, offers] = await Promise.all([
    Profile.findOne({ user: user._id }),
    Offer.find({ author: user._id }).populate("author").countDocuments(),
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
  });
};

/**
 * Shows the edit profile page.
 *
 * @param {*} req
 * @param {*} res
 */
module.exports.edit = async (req, res) => {
  const { id } = req.user;

  let profile = await Profile.findOne({ user: id });
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
  const { id, username } = req.user;

  await Profile.findOneAndUpdate({ user: id }, req.body, { upsert: true });

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
