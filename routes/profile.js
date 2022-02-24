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

module.exports = router;
