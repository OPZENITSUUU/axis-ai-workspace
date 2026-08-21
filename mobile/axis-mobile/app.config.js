const baseConfig = require("./app.json");

const googleServicesFile = process.env.GOOGLE_SERVICES_JSON;

module.exports = {
  ...baseConfig.expo,
  android: {
    ...baseConfig.expo.android,
    ...(googleServicesFile ? { googleServicesFile } : {}),
  },
};
