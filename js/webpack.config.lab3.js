var path = require('path');
var webpack = require('webpack');

var plugins =  [
    new webpack.ProvidePlugin({
           Buffer: ['buffer', 'Buffer'],
    }),
];

module.exports = {
    plugins: plugins,
}