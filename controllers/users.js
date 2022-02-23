const User = require("../models/user");
const Offer = require("../models/offer");
const UserInformation = require("../models/userinformation");

const mapboxGeocoding = require("@mapbox/mapbox-sdk/services/geocoding");
const mapboxToken = process.env.MAPBOX_TOKEN;
const geocoder = mapboxGeocoding({ accessToken: mapboxToken });
const ne = require("../lib/ne");
const { profileSchema } = require("../schemas");

module.exports.register = (req, res) => {
  res.render("users/register");
};

module.exports.createRegister = async (req, res, next) => {
  try {
    const { email, username, password, location } = req.body;

    // TEMPORARY START: Create a user on Negotation Engine as well.
    const geoData = await geocoder
      .forwardGeocode({
        query: location,
        limit: 1,
      })
      .send();
    if (geoData.body.features.length == 0) {
      throw new Error("Invalid location");
    }
    const coordinates = geoData.body.features[0].geometry.coordinates
      .map((v) => v.toString())
      .join(",");
    await ne.signup(username, email, password, coordinates);
    // TEMPORARY END.

    const user = new User({ email, username });
    const registeredUser = await User.register(user, password);
    req.login(registeredUser, (err) => {
      if (err) return next(err);
      req.flash("success", "Welcome to Digiprime!");
      res.redirect("/offers");
    });
  } catch (e) {
    req.flash("error", e.message);
    res.redirect("/register");
  }
};

module.exports.login = (req, res) => {
  res.render("users/login");
};

module.exports.createLogin = (req, res) => {
  req.flash("success", "Welcome back!");
  const redirectUrl = req.session.returnTo || "/offers";
  delete req.session.returnTo;
  res.redirect(redirectUrl);
};

module.exports.logout = (req, res) => {
  req.logout();
  req.flash("success", "Success logout!");
  res.redirect("/offers");
};

module.exports.profilePage = async (req, res) => {
  const { username } = req.params;

  // Retrieves number of historic auctions and active auctions.
  // const { historic, active } = await ne.getStats(username);

  let data = await UserInformation.findOne({ username });

  var author = data === null ? await User.findOne({username}) : data._id;
  const offers = await Offer.find({ author: author }).populate("author").countDocuments();

  data = data ? { ...data._doc, username } : { username };

  res.render("users/profile", {
    data,
    historic: 0,
    active: 0,
    offers,
  });
};

module.exports.editPage = async (req, res) => {
  const { username } = req.user;

  let currentData = await UserInformation.findOne({ username });
  currentData = currentData === null ? profileSchema : currentData;

  res.render("users/edit", {
    data: currentData,
  });
};

module.exports.createEditPage = async (req, res) => {
  const { id, username } = req.user;

  const data = {
    ...req.body,
    username,
    email: req.user.email,
  };
  const options = {
    new: true,
    upsert: true,
  };
  await UserInformation.findOneAndUpdate({ _id: id }, data, options);

  res.redirect(`/profile/${username}`);
};

module.exports.viewOffers = async (req, res) => {
  const { username } = req.params;
  let data = await User.findOne({username});
  const offers = await Offer.find({ author: data._id }).populate("author");
  res.render("users/offers", { offers });
};