const Offer = require("../models/offer");
const User = require("../models/user");

const mapboxGeocoding = require("@mapbox/mapbox-sdk/services/geocoding");
const mapboxToken = process.env.MAPBOX_TOKEN;
const geocoder = mapboxGeocoding({ accessToken: mapboxToken });
const { cloudinary } = require("../cloudinary");
const formatDistanceToNow = require("date-fns/formatDistanceToNow");

const { getPage, createPagination } = require("../lib/paginate");
const {
  interests: costumers,
  referenceSectors,
  referenceTypes,
} = require("../utils/constants");
const { getBrokerAgreement } = require("../lib/broker");
const ne = require("../lib/ne");
const ExpressError = require("../utils/ExpressError");

const removeFalsyValues = (object) => {
  Object.keys(object).forEach((key) => {
    if (!object[key]) {
      delete object[key];
    } else {
      object[key] =
        object[key].charAt(0).toUpperCase() +
        object[key].slice(1).toLowerCase();
    }
  });
  return object;
};

module.exports.index = async (req, res) => {
  const page = getPage(req.query.page);
  const perPage = 18;

  const [offers, count] = await Promise.all([
    Offer.find({ deleted: false })
      .populate("author")
      .sort({ _id: 1 })
      .skip(perPage * (page - 1))
      .limit(perPage),
    Offer.estimatedDocumentCount(),
  ]);

  res.render("offers/index", {
    page: createPagination(offers, count, page, perPage),
  });
};

module.exports.directory = async (req, res) => {
  const { costumer, referenceSector, referenceType } = req.query;
  const page = getPage(req.query.page);
  const perPage = 18;

  const filter = removeFalsyValues({
    costumer,
    referenceSector,
    referenceType,
  });

  const [offers, count] = await Promise.all([
    Offer.find({ ...filter, deleted: false })
      .populate("author")
      .sort({ _id: 1 })
      .skip(perPage * (page - 1))
      .limit(perPage),
    Offer.countDocuments(filter),
  ]);

  res.render("offers/directory", {
    page: createPagination(offers, count, page, perPage, filter),
    costumers,
    referenceSectors,
    referenceTypes,
  });
};

module.exports.newForm = async (req, res) => {
  const { username, role } = req.user;

  let agreements = [];
  if (role === "broker") {
    agreements = await ne.getRepresenting(username);
  }

  res.render("offers/new", {
    costumers,
    referenceSectors,
    referenceTypes,
    agreements,
  });
};

module.exports.create = async (req, res) => {
  const { username, role } = req.user;
  const { actAs, offer } = req.body;

  const geoData = await geocoder
    .forwardGeocode({
      query: req.body.offer.location,
      limit: 1,
    })
    .send();

  let author = req.user._id;
  if (role == "broker") {
    const agreements = await ne.getRepresenting(username);
    let found = false;
    for (const agreement of agreements) {
      if (agreement.represented == actAs) {
        found = true;
        break;
      }
    }
    if (!found) {
      throw ExpressError("Invalid agreement with user", 400);
    }
    const user = await User.findOne({ username: actAs });
    author = user._id;
  }

  const newOffer = new Offer(offer);
  newOffer.geometry = geoData.body.features[0].geometry;
  newOffer.images = req.files.map((f) => ({
    url: f.path,
    filename: f.filename,
  }));
  newOffer.author = author;
  newOffer.deleted = false;
  await newOffer.save();

  req.flash("success", "Successfully made a new offer!");
  res.redirect(`${req.app.locals.baseUrl}/offers/${newOffer._id}`);
};

module.exports.show = async (req, res) => {
  const offer = await Offer.findById(req.params.id)
    .populate({
      path: "reviews",
      populate: {
        path: "author",
      },
    })
    .populate("author");

  if (!offer) {
    req.flash("error", "Cannot find that offer!");
    return res.redirect(`${req.app.locals.baseUrl}/offers`);
  }

  const hasBrokerAgreement = await getBrokerAgreement(
    req.user,
    offer.author.username
  );
  res.render("offers/show", {
    offer,
    formatDistanceToNow,
    hasBrokerAgreement,
  });
};

module.exports.editForm = async (req, res) => {
  const { id } = req.params;
  const offer = await Offer.findById(id);
  if (!offer) {
    req.flash("error", "Cannot find that offer!");
    return res.redirect(`${req.app.locals.baseUrl}/offers`);
  }
  if (offer.deleted) {
    req.flash("error", "Offer has been remoeved");
    return res.redirect(`${req.app.locals.baseUrl}/offers`);
  }
  res.render("offers/edit", {
    offer,
    costumers,
    referenceSectors,
    referenceTypes,
  });
};

module.exports.updateForm = async (req, res) => {
  const { id } = req.params;
  const offer = await Offer.findByIdAndUpdate(id, { ...req.body.offer });
  const imgs = req.files.map((f) => ({ url: f.path, filename: f.filename }));
  offer.images.push(...imgs);
  await offer.save();
  if (req.body.deleteImages) {
    for (let filename of req.body.deleteImages) {
      await cloudinary.uploader.destroy(filename);
    }
    await offer.updateOne({
      $pull: { images: { filename: { $in: req.body.deleteImages } } },
    });
  }
  req.flash("success", "Successfully updated offer!");
  res.redirect(`${req.app.locals.baseUrl}/offers/${offer._id}`);
};

module.exports.delete = async (req, res) => {
  const { id } = req.params;
  await Offer.findByIdAndUpdate(id, { deleted: true });
  req.flash("success", "Successfully deleted offer!");
  res.redirect(`${req.app.locals.baseUrl}/offers`);
};
