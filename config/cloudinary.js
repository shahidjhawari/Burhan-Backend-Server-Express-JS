const { v2: cloudinary } = require("cloudinary");

cloudinary.config({
  cloud_name: "dxampilpv",
  api_key: "275126976155417",
  api_secret: "B5S8aupE03A3VWLT8HbCOhRfLLY",
});

module.exports = cloudinary;
