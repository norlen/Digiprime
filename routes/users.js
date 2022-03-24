const express = require("express");
const router = express.Router();
const passport = require("passport");
const users = require("../controllers/users");

router.get("/login", passport.authenticate("keycloak"));

router.get(
  "/callback",
  passport.authenticate("keycloak", { failureRedirect: "/auth/login" }),
  users.onAuthCallback
);

router.post("/logout", users.logout);

module.exports = router;
