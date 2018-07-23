var version = require('./package.json').version;

// // Custom webpack loaders are generally the same for all webpack bundles, hence
// // stored in a separate local variable.
// var loaders = [
//     { test: /\.json$/, loader: 'json-loader' },
// ];

const path = require('path');

var rules = [
    // { test: /\.json$/, use: "json-loader" },
    {test: /\.js$/,  use: [{loader: "ts-loader", options: {transpileOnly: true} }]}
];
var externals = ['@jupyter-widgets/base', '@jupyter-widgets/controls', 'jupyter-js-widgets']
var pyname = 'ipywebrtc'

var resolve =  {
    extensions: ['.ts', '.js']
};

module.exports = [
    {
        entry: './src/extension.js',
        output: {
            filename: 'extension.js',
            path: path.resolve(__dirname, `../${pyname}/static`),
            libraryTarget: 'amd'
        },
        mode: 'development',
        resolve: resolve
    },
    {
        entry: './src/index.js',
        output: {
            filename: 'index.js',
            path: path.resolve(__dirname, `../${pyname}/static`),
            libraryTarget: 'amd'
        },
        devtool: 'source-map',
        module: {
            rules: rules
        },
        externals: externals,
        mode: 'development',
        resolve: resolve
    },
    {// Embeddable jupyter-webrtc bundle
        entry: './src/embed.js',
        output: {
            filename: 'index.js',
            path: path.resolve(__dirname, './dist/'),
            libraryTarget: 'amd',
            publicPath: 'https://unpkg.com/jupyter-webrtc@' + version + '/dist/'
        },
        devtool: 'source-map',
        module: {
            rules: rules
        },
        externals: externals,
        mode: 'development',
        resolve: resolve
    }
];
