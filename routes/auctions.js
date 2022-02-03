const express = require("express");
const router = express.Router();
const catchAsync = require("../utils/catchAsync");
const auction = require("../controllers/auctions");
const { isLoggedIn } = require("../middleware");

router
  .route("/")
  .get(isLoggedIn, catchAsync(auction.index));

router
  .route("/history")
  .get(isLoggedIn, catchAsync(auction.history));

router
  .route("/create")
  .get(isLoggedIn, catchAsync(auction.create))
  .post(isLoggedIn, catchAsync(auction.createAuction));

router
  .route("/:id")
  .get(isLoggedIn, catchAsync(auction.show))
  .post(isLoggedIn, catchAsync(auction.placeBid));

router
  .route("/:id/end")
  .get(isLoggedIn, catchAsync(auction.showHighestBids))
  .post(isLoggedIn, catchAsync(auction.selectWinner));

router
  .route("/:id/bids")
  .get(isLoggedIn, catchAsync(auction.getBids));

module.exports = router;
