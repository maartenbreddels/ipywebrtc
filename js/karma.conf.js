var webpackConfig = require('./webpack.config.js');
var webpack = require('webpack');

module.exports = function(config) {
  config.set({
    basePath: '',
    frameworks: ['mocha', 'chai', 'sinon'],
    files: [
        {pattern: 'test_js/test/index.js'},
    ],
    exclude: ['**/embed.js', 'src/**'],
    preprocessors: {
        'test_js/test/index.js': ['webpack', 'sourcemap']
    },
    webpack: {
      module: webpackConfig[1].module,
      devtool: 'source-map',
      mode: 'development',
      resolve: {
            extensions: ['.js']
      },
      plugins: [
          // see https://github.com/webpack-contrib/karma-webpack/issues/109#issuecomment-224961264
          new webpack.SourceMapDevToolPlugin({
            filename: null, // if no value is provided the sourcemap is inlined
            test: /\.(js)($|\?)/i // process .js files only
          }),
          new webpack.ProvidePlugin({
            Buffer: ['buffer', 'Buffer'],
            process: 'process/browser',
          }),
        ],
    },
    mochaReporter: {
       showDiff: true
    },
    reporters: ['progress', 'mocha'],
    port: 9876,
    colors: true,
    // possible values: config.LOG_DISABLE || config.LOG_ERROR || config.LOG_WARN || config.LOG_INFO || config.LOG_DEBUG
    logLevel: config.LOG_INFO,
    autoWatch: true,
    // available browser launchers: https://npmjs.org/browse/keyword/karma-launcher
    browsers: ['HeadlessChrome'],
    customLaunchers: {
      HeadlessChrome: {
        base: 'Chrome',
        flags: ['--headless', '--disable-gpu', '--remote-debugging-port=9222']
      }
    },
    // if true, Karma captures browsers, runs the tests and exits
    singleRun: true,
    // how many browser should be started simultaneous
    concurrency: Infinity
  })
}
