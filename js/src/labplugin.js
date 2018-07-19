var jupyter_webrtc = require('./index');
var base = require('@jupyter-widgets/base');

module.exports = {
  id: 'jupyter-webrtc',
  requires: [base.IJupyterWidgetRegistry],
  activate: function(app, widgets) {
      widgets.registerWidget({
          name: 'jupyter-webrtc',
          version: jupyter_webrtc.version,
          exports: jupyter_webrtc
      });
  },
  autoStart: true
};

