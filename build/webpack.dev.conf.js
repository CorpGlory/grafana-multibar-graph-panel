const webpack = require('webpack');
const baseWebpackConfig = require('./webpack.base.conf');

var conf = baseWebpackConfig;
conf.watch = true;
conf.devtool = 'inline-source-map';
conf.mode = 'development';
conf.plugins.push(new webpack.SourceMapDevToolPlugin({
  filename: null,
  exclude: [/node_modules/],
  test: /\.ts$/
}));

module.exports = conf;
