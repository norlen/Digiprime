const express = require('express');
const router = express.Router();
const passport = require('passport');
const catchAsync = require('../utils/catchAsync');
const users = require('../controllers/users');
const User = require('../models/user');
const { session } = require('passport');

router.route('/register')
    .get(users.register)
    .post(catchAsync(users.createRegister));

router.route('/login')
    .get(users.login)
    .post(passport.authenticate('local', {failureFlash: true, failureRedirect: '/login'}), users.createLogin)

router.get('/logout', users.logout)

module.exports = router;