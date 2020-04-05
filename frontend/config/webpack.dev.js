// const { BundleAnalyzerPlugin } = require('webpack-bundle-analyzer');
const common = require('./webpack.common');
const overrideConfig = {};
module.exports = {
  baseConfig: common,
  overrideConfig: overrideConfig
};
