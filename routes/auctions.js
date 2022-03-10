const express = require("express");
const router = express.Router();
const catchAsync = require("../utils/catchAsync");
const auction = require("../controllers/auctions");
const {
  isLoggedIn,
  isValidId,
  validatePlaceBid,
  validateSelectWinner,
  checkParamsSingleOfferAuction,
  validateCreateSingleOfferAuction,
  checkParamsAuction,
  validateAuction,
} = require("../middleware");

router.route("/").get(isLoggedIn, catchAsync(auction.index));

router.route("/history").get(isLoggedIn, catchAsync(auction.history));

router
  .route("/create")
  .get(isLoggedIn, checkParamsAuction, catchAsync(auction.create))
  .post(isLoggedIn, validateAuction, catchAsync(auction.createAuction));

router
  .route("/create-public")
  .get(
    isLoggedIn,
    checkParamsSingleOfferAuction,
    catchAsync(auction.createSingleOffer)
  )
  .post(
    isLoggedIn,
    validateCreateSingleOfferAuction,
    catchAsync(auction.createSingleOfferAuction)
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

router.route("/:id/join").post(isLoggedIn, isValidId, catchAsync(auction.join));

module.exports = router;
