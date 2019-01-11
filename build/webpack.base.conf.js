const path = require('path');
const CopyWebpackPlugin = require('copy-webpack-plugin');

function resolve(dir) {
  return path.join(__dirname, '..', dir)
}

module.exports = {
  target: 'node',
  context: resolve('src'),
  entry: './module.ts',
  output: {
    filename: 'module.js',
    path: resolve('dist'),
    libraryTarget: 'amd'
  },
  externals: [
    // remove the line below if you don't want to use buildin versions
    'lodash', 'moment', 'angular',
    function(context, request, callback) {
      var prefix = 'grafana/';
      if (request.indexOf(prefix) === 0) {
        return callback(null, request.substr(prefix.length));
      }
      callback();
    }
  ],
  plugins: [
    new CopyWebpackPlugin([
      { from: 'plugin.json' },
      { from: 'img/*' },
      { from: 'screenshots/*' },
      { from: 'partials/*' },
      { from: '../README.md' }
    ])
  ],
  resolve: {
    extensions: ['.ts', '.js']
  },
  module: {
    rules: [
      {
        test: /\.ts$/, 
        loaders: [
          'ts-loader'
        ],
        exclude: /node_modules/,
      },
      {
        test: /jquery\.flot/,
        loaders: [
          'imports-loader?jQuery=jquery,lodash=lodash,angular=angular,tetherDrop=tether-drop'
        ]
      }
    ]
  }
}
