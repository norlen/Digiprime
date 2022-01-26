const User = require('../models/user');

const mapboxGeocoding = require('@mapbox/mapbox-sdk/services/geocoding');
const mapboxToken = process.env.MAPBOX_TOKEN;
const geocoder = mapboxGeocoding({ accessToken: mapboxToken });
const axios = require('axios');
const NE_BASE_URL = process.env.NEGOTIATION_ENGINE_BASE_URL || "http://localhost:5000";

module.exports.register = (req, res) => {
	res.render('users/register');
};

module.exports.createRegister = async (req, res, next) => {
	try {
		const { email, username, password, location } = req.body;

		// TEMPORARY START: Create a user on Negotation Engine as well.
		const geoData = await geocoder
			.forwardGeocode({
				query: location,
				limit: 1
			})
			.send();
		if (geoData.body.features.length == 0) {
			throw new Error("Invalid location");
		}
		const coordinates = geoData.body.features[0].geometry.coordinates.map(v => v.toString()).join(",");
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
			req.flash('success', 'Welcome to Digiprime!');
			res.redirect('/offers');
		});
	} catch (e) {
		req.flash('error', e.message);
		res.redirect('/register');
	}
};

module.exports.login = (req, res) => {
	res.render('users/login');
};

module.exports.createLogin = (req, res) => {
	req.flash('success', 'Welcome back!');
	const redirectUrl = req.session.returnTo || '/offers';
	delete req.session.returnTo;
	res.redirect(redirectUrl);
};

module.exports.logout = (req, res) => {
	req.logout();
	req.flash('success', 'Success logout!');
	res.redirect('/offers');
};
