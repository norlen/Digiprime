if (process.env.NODE_ENV !== "production") {
  require("dotenv").config();
}

const express = require("express");
const app = express();
const path = require("path");
const mongoose = require("mongoose");
const ejsMate = require("ejs-mate");
const session = require("express-session");
const flash = require("connect-flash");
const ExpressError = require("./utils/ExpressError");
const methodOverride = require("method-override");
const passport = require("passport");
const helmet = require("helmet");
const mongoSanitize = require("express-mongo-sanitize");
const MongoStore = require("connect-mongo");
const KeyCloakStrategy = require("passport-keycloak-oauth2-oidc").Strategy;

const offerRoutes = require("./routes/offers");
const reviewRoutes = require("./routes/reviews");
const userRoutes = require("./routes/users");
const profileRoutes = require("./routes/profile");
const auctionRoutes = require("./routes/auctions");
const negotiationRoutes = require("./routes/negotiation");
const messageRoutes = require("./routes/messages");

// const { csrfProtection } = require("./utils/csrf");

const Message = require("./models/messages");
const userController = require("./controllers/users");

const BASE_URL = process.env.BASE_URL || "";
const port = process.env.PORT || 3000;
const dbUrl = process.env.DB_URL || "mongodb://localhost:27017/offer-test";
const secret = process.env.SECRET || "thisshouldbeabettersecret!";
const secrets = secret.split(",");
const useTls = process.env.USE_TLS === "true";

mongoose.connect(dbUrl, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  useCreateIndex: true,
  useFindAndModify: false,
});

const db = mongoose.connection;
db.on("error", console.error.bind(console, "connection error:"));
db.once("open", () => {
  console.log("Database connected");
});

app.engine("ejs", ejsMate);
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

app.use(express.urlencoded({ extended: true }));
app.use(methodOverride("_method"));
app.use(mongoSanitize());
app.use(helmet());
// app.use(helmet({contentSecurityPolicy:false})); to avoid the use of all the urls for contentsecurity

const store = MongoStore.create({
  mongoUrl: dbUrl,
  touchAfter: 24 * 60 * 60,
  crypto: {
    secret,
  },
});

store.on("error", function (e) {
  console.log("SESSION STORE ERROR", e);
});

const sessionConfig = {
  store,
  name: "session",
  secret: secrets,
  resave: false,
  saveUninitialized: true,
  cookie: {
    httpOnly: true,
    expires: Date.now() + 1000 * 60 * 60 * 24 * 7,
    maxAge: 1000 * 60 * 60 * 24 * 7,
    secure: useTls,
  },
};

const scriptSrcUrls = [
  "https://stackpath.bootstrapcdn.com/",
  "https://api.tiles.mapbox.com/",
  "https://api.mapbox.com/",
  "https://kit.fontawesome.com/",
  "https://cdnjs.cloudflare.com/",
  "https://cdn.jsdelivr.net",
];

const styleSrcUrls = [
  "https://kit-free.fontawesome.com/",
  "https://api.mapbox.com/",
  "https://api.tiles.mapbox.com/",
  "https://fonts.googleapis.com/",
  "https://use.fontawesome.com/",
  "https://cdn.jsdelivr.net",
];

const connectSrcUrls = [
  "https://api.mapbox.com/",
  "https://a.tiles.mapbox.com/",
  "https://b.tiles.mapbox.com/",
  "https://events.mapbox.com/",
];

let imgSrcUrls = [
  "https://res.cloudinary.com/diq0t2bqj/",
  "https://images.unsplash.com",
];

if (!!process.env.CLOUDINARY_CLOUD_NAME) {
  imgSrcUrls = [
    ...imgSrcUrls,
    `https://res.cloudinary.com/${process.env.CLOUDINARY_CLOUD_NAME}/`,
  ];
}

const fontSrcUrls = ["https://cdn.jsdelivr.net"];

app.use(
  helmet.contentSecurityPolicy({
    directives: {
      defaultSrc: [],
      connectSrc: ["'self'", ...connectSrcUrls],
      scriptSrc: ["'unsafe-inline'", "'self'", ...scriptSrcUrls],
      styleSrc: ["'self'", "'unsafe-inline'", ...styleSrcUrls],
      workerSrc: ["'self'", "blob:"],
      childSrc: ["blob:"],
      objectSrc: [],
      imgSrc: ["'self'", "blob:", "data:", ...imgSrcUrls],
      fontSrc: ["'self'", ...fontSrcUrls],
    },
  })
);

// Set the base URL so application can redirect and show links properly.
app.locals.baseUrl = BASE_URL;

app.use(session(sessionConfig));
app.use(flash());

app.use(passport.initialize());
app.use(passport.session());

passport.use(
  new KeyCloakStrategy(
    {
      clientID: process.env.KEYCLOAK_CLIENT_ID,
      realm: process.env.KEYCLOAK_REALM,
      publicClient: "false",
      clientSecret: process.env.KEYCLOAK_CLIENT_SECRET,
      sslRequired: "external",
      authServerURL: process.env.KEYCLOAK_AUTH_SERVER_URL,
      callbackURL: process.env.KEYCLOAK_CALLBACK_URL,
    },
    userController.saveUser
  )
);

// Used to stuff a piece of information into a cookie
passport.serializeUser((user, done) => {
  done(null, user);
});

// Used to decode the received cookie and persist session
passport.deserializeUser((user, done) => {
  done(null, user);
});

app.use((req, res, next) => {
  res.locals.currentUser = req.user;
  res.locals.success = req.flash("success");
  res.locals.error = req.flash("error");
  next();
});

const setUnreadCount = (req, res, next) => {
  const setCount = async (user) => {
    if (!user) return;

    const count = await Message.countDocuments({
      $or: [
        { $and: [{ to: user._id, to_read: false }] },
        { $and: [{ from: user._id, from_read: false }] },
      ],
    });
    return count;
  };

  res.locals.unreadMessages = null;
  setCount(res.locals.currentUser)
    .then((count) => {
      res.locals.unreadMessages = count || null;
      next();
    })
    .catch(next);
};
app.use(setUnreadCount);

// app.use(csrfProtection);
// app.use((req, res, next) => {
//   res.locals._csrf = req.csrfToken();
//   next();
// });

const router = express.Router();
router.use(express.static(path.join(__dirname, "public")));

router.use("/auth", userRoutes);
router.use("/offers", offerRoutes);
router.use("/offers/:id/reviews", reviewRoutes);
router.use("/profile", profileRoutes);
router.use("/auctions", auctionRoutes);
router.use("/negotiations", negotiationRoutes);
router.use("/messages", messageRoutes);

router.get("/", (req, res) => {
  console.log(req.baseUrl);
  res.render("home");
});

app.use(BASE_URL, router);

app.all("*", (req, res, next) => {
  next(new ExpressError("Page Not Found", 404));
});

app.use((err, req, res, next) => {
  const { statusCode = 500 } = err;
  if (!err.message) err.message = "Something Went Wrong";

  res.status(statusCode).render("error", { err, statusCode });
});

app.listen(port, () => {
  console.log(`Serving on http://localhost/${port}`);
});
