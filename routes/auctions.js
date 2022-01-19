const express = require('express');
const router = express.Router();
const catchAsync = require('../utils/catchAsync');
const auction = require('../controllers/auctions');

router
  .route('/create')
  .get(catchAsync(auction.create))
  .post(catchAsync(auction.createAuction))

router
  .route('/:id')
  .get(catchAsync(auction.show))

module.exports = router;
