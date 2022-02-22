const ne = require("../lib/ne");
const { paginate } = require("../lib/paginate");

module.exports.showCreate = async (req, res) => {
  res.render("negotiations/create", {});
};

module.exports.show = async (req, res) => {
  const { id: negotiationId } = req.params;
  const { username } = req.user;

  const negotiation = await ne.getNegotiation(username, negotiationId);

  res.render("negotiations/show", {});
};

module.exports.list = async (req, res) => {
  const { username } = req.user;

  const negotiations = await ne.listNegotiations(username);

  res.render("negotiations/list", {
    page: paginate(negotiations, req.query.page, 10),
  });
};

module.exports.create = async (req, res) => {
  // todo
};

module.exports.placeBid = async (req, res) => {
  // todo
};

module.exports.accept = async (req, res) => {
  // todo
};

module.exports.cancel = async (req, res) => {
  // todo
};
