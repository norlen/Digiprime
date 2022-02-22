const express = require("express");
const router = express.Router();
const catchAsync = require("../utils/catchAsync");
const negotiation = require("../controllers/negotiation");
const {
  isLoggedIn,
  validIdQuery,
  validateNegotiation,
  validatePlaceBid,
} = require("../middleware");

router.route("/").get(isLoggedIn, catchAsync(negotiation.list));

router
  .route("/create/:id")
  .get(isLoggedIn, validIdQuery, catchAsync(negotiation.showCreate))
  .post(
    isLoggedIn,
    validIdQuery,
    validateNegotiation,
    catchAsync(negotiation.create)
  );

router
  .route("/:id")
  .get(isLoggedIn, validIdQuery, catchAsync(negotiation.show))
  .post(
    isLoggedIn,
    validIdQuery,
    validatePlaceBid,
    catchAsync(negotiation.placeBid)
  );

router
  .route("/:id/accept")
  .post(isLoggedIn, validIdQuery, catchAsync(negotiation.accept));

router
  .route("/:id/cancel")
  .get(isLoggedIn, validIdQuery, catchAsync(negotiation.cancel));

module.exports = router;
