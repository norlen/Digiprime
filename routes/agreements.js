const express = require("express");
const router = express.Router();
const catchAsync = require("../utils/catchAsync");
const agreements = require("../controllers/agreements");
const { isLoggedIn } = require("../middleware");

router.route("/").get(catchAsync(agreements.list));

router.route("/pending").get(isLoggedIn, catchAsync(agreements.listPending));

router.route("/:agreementId").get(isLoggedIn, catchAsync(agreements.show));

router
  .route("/:agreementId/accept")
  .post(isLoggedIn, catchAsync(agreements.acceptAgreement));

router
  .route("/:agreementId/cancel")
  .post(isLoggedIn, catchAsync(agreements.cancel));

module.exports = router;
