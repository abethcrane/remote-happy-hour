const root = require('app-root-path').path;
const path = require('path');
const glob = require('glob');

module.exports = {
  entry: 'js/index.js',
  output: {
    filename: 'bundle.js',
    path: 'static',
  },
  // resolve: {
  //   modules: [RUNFILES_NODE_MODULES_PATH].concat(
  //       glob.sync(
  //           `${RUNFILES_NODE_MODULES_PATH}/**/node_modules`
  //       )),
  //   extensions: [".js", ".json", ".jsx", ".css", ".scss"],
  //   symlinks: false,
  // },
  // resolveLoader: {
  //   modules: [RUNFILES_NODE_MODULES_PATH],
  // },
  module: {
    rules: [{
      test: /\.html$/,
      exclude: /node_modules/,
      use: {
        loader: 'html-loader'
      }
    }, {
      test: /\.(js|jsx)$/,
      exclude: /(node_modules|bower_components)/,
      use: {
        loader: 'babel-loader',
        options: {
          presets: [
            [
              require
              .resolve(
                '@babel/preset-env'
              ), {
                exclude: [
                  '@babel/plugin-transform-regenerator'
                ]
              }
            ],
            require
            .resolve(
              '@babel/preset-react'
            )
          ],
          plugins: []
        }
      }
    }, {
      test: /\.css$/,
      loader: 'style-loader!css-loader?modules'
    }, {
      test: /\.s[ac]ss$/i,
      use: [
        'style-loader',
        'css-loader',
        'sass-loader',
      ],
    }, {
      test: /\.glsl$/,
      loader: 'webpack-glsl-loader',
    }]
  }
};
