const formatDistanceToNow = require("date-fns/formatDistanceToNow");
const formatDate = require("date-fns/format");

// Converts from a Javascript date to a time format NegotationEngine accepts.
//
// The required date is similar to an ISO string, but not quite. An ISO string
// can be: '2022-01-19T15:42:25.373Z', and the required format is
// YYYY-MM-DDTHH:MM:SS, so we have to cut off after the seconds.
module.exports.createNeTimeString = (originalTime) => {
  return originalTime.toISOString().split(".")[0];
};

// Take a date string without a timezone and parses it as UTC and returns
// it as a date.
module.exports.parseAsUTCDate = (dateString) => {
  return new Date(dateString.split(".")[0] + " UTC");
};

module.exports.showDistanceToNow = (dateString) => {
  return formatDistanceToNow(new Date(dateString.split(".")[0] + " UTC"));
};

module.exports.displayDate = (dateString) => {
  return formatDate(
    new Date(dateString.split(".")[0] + " UTC"),
    "yyyy-MM-dd HH:mm"
  );
};
