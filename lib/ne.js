const axios = require("axios");

const NE_BASE_URL =
  process.env.NEGOTIATION_ENGINE_BASE_URL || "http://localhost:5000";

module.exports.createAuction = async (username, data) => {
  const params = new URLSearchParams(data);
  const response = await axios.post(`${NE_BASE_URL}/create-room`, params, {
    auth: { username },
  });

  // Response data contains a message, which contains the auction name and id.
  // We are interested in the ID here.
  // Example response: "The room auction #1 has been created id: 61e7f7e20daf6671113c4941"
  const auctionId = response.data.message.split("id: ")[1];

  return auctionId;
};
