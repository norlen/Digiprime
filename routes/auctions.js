const express = require("express");
const router = express.Router();
const catchAsync = require("../utils/catchAsync");
const auction = require("../controllers/auctions");
const { csrfProtection } = require("../utils/csrf");
const {
  isLoggedIn,
  validateGetCreateAuction,
  validatePostCreateAuction,
  validIdQuery,
  validatePlaceBid,
  validateSelectWinner,
} = require("../middleware");

router.route("/").get(isLoggedIn, catchAsync(auction.index));

router.route("/history").get(isLoggedIn, catchAsync(auction.history));

router
  .route("/create")
  .get(
    isLoggedIn,
    csrfProtection,
    validateGetCreateAuction,
    catchAsync(auction.create)
  )
  .post(
    isLoggedIn,
    csrfProtection,
    validatePostCreateAuction,
    catchAsync(auction.createAuction)
  );

router
  .route("/:id")
  .get(isLoggedIn, csrfProtection, validIdQuery, catchAsync(auction.show))
  .post(
    isLoggedIn,
    validIdQuery,
    csrfProtection,
    validatePlaceBid,
    catchAsync(auction.placeBid)
  );

router
  .route("/:id/end")
  .post(
    isLoggedIn,
    validIdQuery,
    csrfProtection,
    validateSelectWinner,
    catchAsync(auction.selectWinner)
  );

router
  .route("/:id/bids")
  .get(isLoggedIn, validIdQuery, catchAsync(auction.getBids));

module.exports = router;
