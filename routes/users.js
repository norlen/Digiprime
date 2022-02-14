const express = require("express");
const router = express.Router();
const passport = require("passport");
const catchAsync = require("../utils/catchAsync");
const users = require("../controllers/users");
const {
  isLoggedIn,
  validateEditProfile,
  validateUsername,
} = require("../middleware");

router
  .route("/register")
  .get(users.register)
  .post(catchAsync(users.createRegister));

router
  .route("/login")
  .get(users.login)
  .post(
    passport.authenticate("local", {
      failureFlash: true,
      failureRedirect: "/login",
    }),
    users.createLogin
  );

router
  .route("/profile/edit")
  .get(isLoggedIn, catchAsync(users.editPage))
  .post(isLoggedIn, validateEditProfile, catchAsync(users.createEditPage));

router
  .route("/profile/:username")
  .get(validateUsername, isLoggedIn, catchAsync(users.profilePage));

router.get("/logout", users.logout);

module.exports = router;
