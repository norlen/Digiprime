const User = require("../models/user");
const ne = require("../lib/ne");

module.exports.saveUser = (accessToken, refreshToken, profile, done) => {
  const inner = async () => {
    let user = await User.findOne({ userId: profile.id });

    if (!user) {
      // No user was found. Create a new user.
      user = new User({
        username: profile.name || profile.username,
        email: profile.email,
        userId: profile.id,
        user: profile._json,
      });

      // This is pretty bad, since we're doing a dual write here. But as it is
      // we pretty much have no choice. Further work should be in checking how
      // NE handles multiple users with the same name, if its fine and we can
      // consider it idempotent or if it breaks, in which case it's pretty bad.
      //
      // And with the new keycloak stuff, we can't even pick our locations.
      // TODO: Should make changes in NE to handle this?
      await ne.signup(user.username, "dontcare");

      // We save the user here, since it's more likely that the call to NE
      // fails, rather than this call.
      await user.save();
    }

    return user;
  };

  inner()
    .then((user) => done(undefined, user))
    .catch((err) => done(err, undefined));
};

module.exports.onAuthCallback = (req, res) => {
  req.flash("success", "Welcome back!");
  const redirectUrl = req.session.returnTo || "/offers";
  delete req.session.returnTo;
  res.redirect(redirectUrl);
};

module.exports.logout = (req, res) => {
  const logoutKey = `${process.env.KEYCLOAK_AUTH_SERVER_URL}/realms/${process.env.KEYCLOAK_REALM}/protocol/openid-connect/logout?redirect_uri=${process.env.DIGIPRIME_BASE_URL}`;

  req.logout();
  req.flash("success", "Success logout!");
  res.redirect(logoutKey);
};
