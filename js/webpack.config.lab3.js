var path = require("path");
var webpack = require("webpack");
const crypto = require("crypto");

var plugins = [
  new webpack.ProvidePlugin({
    Buffer: ["buffer", "Buffer"],
  }),
];

module.exports = {
  plugins: plugins,
};

// Workaround for loaders using "md4" by default, which is not supported in FIPS-compliant OpenSSL
const cryptoOrigCreateHash = crypto.createHash;
crypto.createHash = (algorithm) =>
  cryptoOrigCreateHash(algorithm == "md4" ? "sha256" : algorithm);
