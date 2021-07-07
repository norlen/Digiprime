const Offer = require('../models/offer');
const mapboxGeocoding = require('@mapbox/mapbox-sdk/services/geocoding');
const mapboxToken = process.env.MAPBOX_TOKEN;
const geocoder = mapboxGeocoding({ accessToken: mapboxToken });
const { cloudinary } = require('../cloudinary');

const costumers = [ 'Supply', 'Demand' ];
const referenceSectors = [ 'Composites', 'Batteries' ];
const referenceTypes = [ 'Material', 'Product' ];

module.exports.index = async (req, res) => {
	const offers = await Offer.find({});
	res.render('offers/index', { offers });
};

module.exports.directory = async (req, res) => {
	const offers = await Offer.find({});
	res.render('offers/directory', { offers, costumers, referenceSectors, referenceTypes });
};

module.exports.newForm = (req, res) => {
	res.render('offers/new', { costumers, referenceSectors, referenceTypes });
};

module.exports.create = async (req, res, next) => {
	const geoData = await geocoder
		.forwardGeocode({
			query: req.body.offer.location,
			limit: 1
		})
		.send();
	const offer = new Offer(req.body.offer);
	offer.geometry = geoData.body.features[0].geometry;
	offer.images = req.files.map((f) => ({ url: f.path, filename: f.filename }));
	offer.author = req.user._id;
	await offer.save();
	req.flash('success', 'Successfully made a new offer!');
	res.redirect(`/offers/${offer._id}`);
};

module.exports.show = async (req, res) => {
	const offer = await Offer.findById(req.params.id)
		.populate({
			path: 'reviews',
			populate: {
				path: 'author'
			}
		})
		.populate('author');
	if (!offer) {
		req.flash('error', 'Cannot find that offer!');
		return res.redirect('/offers');
	}
	res.render('offers/show', { offer });
};

module.exports.editForm = async (req, res) => {
	const { id } = req.params;
	const offer = await Offer.findById(id);
	if (!offer) {
		req.flash('error', 'Cannot find that offer!');
		return res.redirect('/offers');
	}
	res.render('offers/edit', { offer, costumers, referenceSectors, referenceTypes });
};

module.exports.updateForm = async (req, res) => {
	const { id } = req.params;
	// console.log(req.body)
	const offer = await Offer.findByIdAndUpdate(id, { ...req.body.offer });
	const imgs = req.files.map((f) => ({ url: f.path, filename: f.filename }));
	offer.images.push(...imgs);
	await offer.save();
	if (req.body.deleteImages) {
		for (let filename of req.body.deleteImages) {
			await cloudinary.uploader.destroy(filename);
		}
		await offer.updateOne({ $pull: { images: { filename: { $in: req.body.deleteImages } } } });
	}
	req.flash('success', 'Successfully updated offer!');
	res.redirect(`/offers/${offer._id}`);
};

module.exports.delete = async (req, res) => {
	const { id } = req.params;
	await Offer.findByIdAndDelete(id);
	req.flash('success', 'Successfully deleted offer!');
	res.redirect('/offers');
};
