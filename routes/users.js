const express = require("express");
const router = express.Router();
const passport = require("passport");
const catchAsync = require("../utils/catchAsync");
const users = require("../controllers/users");
const { User } = require("../models/user");
const { session } = require("passport");
const { isLoggedIn } = require("../middleware");

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
  .route("/profilePage/:name")
  .post(isLoggedIn, catchAsync(users.profilePage))
  .get(isLoggedIn, catchAsync(users.profilePage));

router
  .route("/editPage")
  .get(isLoggedIn, catchAsync(users.editPage))
  .post(isLoggedIn, catchAsync(users.createEditPage));

router.get("/logout", users.logout);

module.exports = router;
