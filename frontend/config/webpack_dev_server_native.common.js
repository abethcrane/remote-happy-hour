const common = require('./webpack.common');
const merge = require('webpack-merge');

module.exports = merge(common, {
  entry: './js/index.js',
  devServer: {
    host: 'localhost',
    port: 9081,
    contentBase: './static',
    headers: {
      'Access-Control-Allow-Origin': '*'
    },
    onListening: function(server) {
      const port = server.listeningApp.address().port;
      console.log('Listening on port:', port);
    },
  },
});
