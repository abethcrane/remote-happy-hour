const root = require('app-root-path').path;
const path = require('path');
const glob = require('glob');

module.exports = {
  entry: './frontend/js/index.js',
  output: {
    filename: 'bundle.js',
    path: path.join(__dirname, '../../static/dist'),
  },
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
