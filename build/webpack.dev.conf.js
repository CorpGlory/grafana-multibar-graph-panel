const webpack = require('webpack');
const baseWebpackConfig = require('./webpack.base.conf');

var conf = baseWebpackConfig;
conf.watch = true;
conf.devtool = 'source-map';
conf.mode = 'development';

module.exports = conf;
