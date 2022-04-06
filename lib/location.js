const mapboxGeocoding = require("@mapbox/mapbox-sdk/services/geocoding");
const mapboxToken = process.env.MAPBOX_TOKEN;
const geocoder = mapboxGeocoding({ accessToken: mapboxToken });

/**
 * Takes a location and finds the longitude and latitude for it. Returns the
 * longitute and latitude as a string with a comma separating them.
 *
 * @param {string} location location to get long/lat from
 * @returns long/lat in the format "long,lat"
 */
module.exports.getLongLat = async (location) => {
  const geoData = await geocoder
    .forwardGeocode({
      query: location,
      limit: 1,
    })
    .send();

  // If we didn't get any features, we could not find a valid location.
  if (geoData.body.features.length == 0) {
    throw new Error("Invalid location");
  }

  // Map the long lat into a comma string.
  const coordinates = geoData.body.features[0].geometry.coordinates
    .map((v) => v.toString())
    .join(",");

  return coordinates;
};
