const User = require('../models/user');
const UserInformation = require('../models/userinformation');
const Joi = require("joi");

const mapboxGeocoding = require('@mapbox/mapbox-sdk/services/geocoding');
const mapboxToken = process.env.MAPBOX_TOKEN;
const geocoder = mapboxGeocoding({ accessToken: mapboxToken });
const axios = require('axios');
const NE_BASE_URL = process.env.NEGOTIATION_ENGINE_BASE_URL || "http://localhost:5000";

// Schema to validate inputs for `creating profile` - NOT USING THIS FOR NOW.
const createUserSchema = Joi.object({
	username: Joi.string().allow(null, ''),
	email: Joi.string().allow(null, ''),
	firstname: Joi.string().allow(null, ''),
	surname: Joi.string().allow(null, ''),
	phone: Joi.string().allow(null, ''),
	address1: Joi.string().allow(null, ''),
	address2: Joi.string().allow(null, ''),
	postcode: Joi.string().allow(null, ''),
	area: Joi.string().allow(null, ''),
	country: Joi.string().allow(null, ''),
	state: Joi.string().allow(null, ''),
	description: Joi.string().allow(null, ''),
	details: Joi.string().allow(null, '')
  });


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

		// Url for default profile picture for user.
		const image = { url: "/pictures/user_pic.png", form: "image/png" };

		const user = new User({ email, image, username});
		console.log(user);
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

module.exports.profilePage = async (req, res) => {
	const queryData = await UserInformation.findOne( {'username': `${(req.params.name) ? req.params.name : req.user.username}`});
	res.render('users/profile', { queryData });
};

module.exports.editPage = async (req, res) => {
	res.render('users/edit')
}

module.exports.createEditPage = async (req, res) => {

	const filter = { username: req.user.username };
	const option = { new: true, upsert: true }
	const userinfo = {
		username: req.user.username,
		email: req.user.email,
		firstname: req.body.firstname,
		surname: req.body.surname,
		phone: req.body.phone,
		address1: req.body.address1,
		address2: req.body.address2,
		postcode: req.body.postcode,
		area: req.body.area,
		country: req.body.country,
		state: req.body.state,
		description: req.body.description,
		details: req.body.details	
	};


	//validate inputs "WILL FIX LATER IF NECESSARY".
	//const userSchema = await createUserSchema.validateAsync(userinfo);

	//Update DB.
	await UserInformation.findOneAndUpdate(filter, userinfo, option);
	res.redirect('/profilePage');
	
}
