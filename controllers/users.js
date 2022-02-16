const User = require("../models/user");
const UserInformation = require("../models/userinformation");

const mapboxGeocoding = require("@mapbox/mapbox-sdk/services/geocoding");
const mapboxToken = process.env.MAPBOX_TOKEN;
const geocoder = mapboxGeocoding({ accessToken: mapboxToken });
const ne = require("../lib/ne");

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
  data = { ...data._doc, username };

  res.render("users/profile", {
    data,
    historic: 0,
    active: 0,
  });
};

module.exports.editPage = async (req, res) => {
  const { username } = req.user;

  let currentData = await UserInformation.findOne({ username });
  currentData = currentData === undefined ? {} : currentData;

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
