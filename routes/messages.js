const express = require("express");
const router = express.Router();
const catchAsync = require("../utils/catchAsync");
const messages = require("../controllers/messages");
const {
  isLoggedIn,
} = require("../middleware");

router.route("/new")
	.get(isLoggedIn, catchAsync(messages.new))
	.post(isLoggedIn, catchAsync(messages.create));
	
router.route("/")
	.get(isLoggedIn, catchAsync(messages.list))
	.post(isLoggedIn, catchAsync(messages.mark));
	
router.route("/:id")
	.get(isLoggedIn, catchAsync(messages.show))
	.post(isLoggedIn, catchAsync(messages.reply));

module.exports = router;
