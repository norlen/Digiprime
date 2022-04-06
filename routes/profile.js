const express = require("express");
const router = express.Router();
const catchAsync = require("../utils/catchAsync");
const profile = require("../controllers/profile");
const {
  isLoggedIn,
  validateEditProfile,
  validateUsername,
} = require("../middleware");

router
  .route("/edit")
  .get(isLoggedIn, catchAsync(profile.edit))
  .post(isLoggedIn, validateEditProfile, catchAsync(profile.update));

router.route("/:username").get(validateUsername, catchAsync(profile.show));

router
  .route("/:username/offers")
  .get(validateUsername, catchAsync(profile.offers));

router
  .route("/:username/represent")
  .get(validateUsername, catchAsync(profile.represent))
  .post(validateUsername, catchAsync(profile.requestRepresentation));

router
  .route("/:username/active")
  .get(validateUsername, catchAsync(profile.representationPendingAgreements));

router
  .route("/:username/all")
  .get(validateUsername, catchAsync(profile.representationAllAgreements));

// TODO: MW to check params.
router
  .route("/:username/:agreementId/accept")
  .post(catchAsync(profile.acceptAgreement));

module.exports = router;
