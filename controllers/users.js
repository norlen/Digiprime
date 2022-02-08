const User = require("../models/user");
const UserInformation = require("../models/userinformation");
const Joi = require("joi");

const mapboxGeocoding = require("@mapbox/mapbox-sdk/services/geocoding");
const mapboxToken = process.env.MAPBOX_TOKEN;
const geocoder = mapboxGeocoding({ accessToken: mapboxToken });
const axios = require("axios");
const NE_BASE_URL =
  process.env.NEGOTIATION_ENGINE_BASE_URL || "http://localhost:5000";

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
    const body = {
      email,
      username,
      password,
      sign: coordinates,
    };
    await axios.post(`${NE_BASE_URL}/signup`, body);
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
  const username = req.params.name;

  // Retrieves number of historic auctions and active auctions.
  const response = await axios.get(`${NE_BASE_URL}/rooms/stats/${username}`);
  const { historic, active } = response.data;

  let queryData = await UserInformation.findOne({ username });
  if (!queryData) {
    queryData = {
      username,
      email: req.user.email,
    };
  }

  res.render("users/profile", { queryData, historic, active });
};

module.exports.editPage = async (req, res) => {
  const { username } = req.user;
  let fields = (await UserInformation.findOne({ username })) || {};

  res.render("users/edit", { fields });
};

// Schema to validate inputs for `creating profile`.
const profileSchema = Joi.object({
  firstname: Joi.string().allow(""),
  surname: Joi.string().allow(""),
  phone: Joi.string().allow(""),
  address1: Joi.string().allow(""),
  address2: Joi.string().allow(""),
  postcode: Joi.string().allow(""),
  area: Joi.string().allow(""),
  country: Joi.string().allow(""),
  state: Joi.string().allow(""),
  description: Joi.string().allow(""),
  details: Joi.string().allow(""),
});

module.exports.createEditPage = async (req, res) => {
  const { id, username } = req.user;
  const info = await profileSchema.validateAsync(req.body);

  const data = {
    ...info,
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
