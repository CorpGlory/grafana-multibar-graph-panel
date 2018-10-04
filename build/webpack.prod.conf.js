const baseWebpackConfig = require('./webpack.base.conf');
const ngAnnotatePlugin = require('ng-annotate-webpack-plugin');

var conf = baseWebpackConfig;
conf.mode = 'production';

conf.plugins.push(new ngAnnotatePlugin());

module.exports = baseWebpackConfig;
