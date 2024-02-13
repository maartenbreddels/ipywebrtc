import { IJupyterWidgetRegistry } from "@jupyter-widgets/base";
import { version } from "../package.json";

const extension = {
  id: "jupyter-webrtc",
  requires: [IJupyterWidgetRegistry],
  activate: (app, widgets) => {
    widgets.registerWidget({
      name: "jupyter-webrtc",
      version: version,
      exports: async () => import("./index"),
    });
  },
  autoStart: true,
};

export default extension;
