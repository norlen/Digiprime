const express = require("express");
const router = express.Router();
const catchAsync = require("../utils/catchAsync");
const auction = require("../controllers/auctions");
const {
  isLoggedIn,
  validateGetCreateAuction,
  validatePostCreateAuction,
  isValidId,
  validatePlaceBid,
  validateSelectWinner,
} = require("../middleware");

router.route("/").get(isLoggedIn, catchAsync(auction.index));

router.route("/history").get(isLoggedIn, catchAsync(auction.history));

router.route("/temp").get(auction.temp);

router
  .route("/create")
  .get(isLoggedIn, validateGetCreateAuction, catchAsync(auction.create))
  .post(
    isLoggedIn,
    validatePostCreateAuction,
    catchAsync(auction.createAuction)
  );

router.route("/public").get(isLoggedIn, catchAsync(auction.listPublic));

router
  .route("/:id")
  .get(isLoggedIn, isValidId, catchAsync(auction.show))
  .post(isLoggedIn, isValidId, validatePlaceBid, catchAsync(auction.placeBid));

router
  .route("/:id/end")
  .post(
    isLoggedIn,
    isValidId,
    validateSelectWinner,
    catchAsync(auction.selectWinner)
  );

router
  .route("/:id/bids")
  .get(isLoggedIn, isValidId, catchAsync(auction.getBids));

module.exports = router;
