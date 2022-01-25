const express = require('express');
const router = express.Router();
const catchAsync = require('../utils/catchAsync');
const auction = require('../controllers/auctions');
const { isLoggedIn } = require('../middleware');

router
  .route('/')
  .get(isLoggedIn, catchAsync(auction.index))

router
  .route('/create')
  .get(isLoggedIn, catchAsync(auction.create))
  .post(isLoggedIn, catchAsync(auction.createAuction))

router
  .route('/:id')
  .get(isLoggedIn, catchAsync(auction.show))

module.exports = router;
