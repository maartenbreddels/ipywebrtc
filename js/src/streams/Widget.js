import { unpack_models } from "@jupyter-widgets/base";
import * as html2canvas from "html2canvas";
import { MediaStreamModel, MediaStreamView } from "./Media";

export class WidgetStreamModel extends MediaStreamModel {
  defaults() {
    return {
      ...super.defaults(),
      _model_name: "WidgetStreamModel",
      _view_name: "WidgetStreamView",
      widget: null,
      max_fps: null,
      _html2canvas_start_streaming: false,
    };
  }

  initialize() {
    super.initialize.apply(this, arguments);

    this.on(
      "change:_html2canvas_start_streaming",
      this.updateHTML2CanvasStreaming,
      this,
    );
    this.rendered_view = null;

    // If the widget already has a captureStream -> use it
    if (typeof this.get("widget").captureStream === "function") {
      const fps = this.get("max_fps");
      this.captureStream = () => {
        if (fps === null || fps === undefined) {
          return this.get("widget").captureStream();
        }
        return this.get("widget").captureStream(fps);
      };
    }
    // Else try to stream the first view of this widget
    else {
      this.captureStream = () => {
        const id_views = Object.keys(this.get("widget").views);
        if (id_views.length === 0) {
          return new Promise((resolve, reject) => {
            reject({
              message:
                "Cannot create WidgetStream if the widget has no view rendered",
            });
          });
        }

        const first_view = this.get("widget").views[id_views[0]];
        return first_view.then((view) => {
          this.rendered_view = view;

          // If the widget view is a canvas or a video element
          const capturable_obj = this.find_capturable_obj(
            this.rendered_view.el,
          );
          if (capturable_obj) {
            return this._captureStream(capturable_obj);
          }

          // Else use html2canvas
          this.canvas = document.createElement("canvas");
          this.set("_html2canvas_start_streaming", true);
          return this._captureStream(this.canvas);
        });
      };
    }
  }

  _captureStream(capturable_obj) {
    return new Promise((resolve, reject) => {
      const fps = this.get("max_fps");

      if (capturable_obj.captureStream) {
        if (fps === null || fps === undefined) {
          resolve(capturable_obj.captureStream());
        } else {
          resolve(capturable_obj.captureStream(fps));
        }
      }

      if (capturable_obj.mozCaptureStream) {
        if (fps === null || fps === undefined) {
          resolve(capturable_obj.mozCaptureStream());
        } else {
          resolve(capturable_obj.mozCaptureStream(fps));
        }
      }

      reject(new Error("captureStream not supported for this browser"));
    });
  }

  find_capturable_obj(element) {
    const nb_children = element.children.length;
    for (let child_idx = 0; child_idx < nb_children; child_idx++) {
      const child = element.children[child_idx];
      if (child.captureStream || child.mozCaptureStream) {
        return child;
      }

      const capturable_obj = this.find_capturable_obj(child);
      if (capturable_obj) {
        return capturable_obj;
      }
    }
  }

  updateHTML2CanvasStreaming() {
    if (
      this.get("_html2canvas_start_streaming") &&
      !this.html2CanvasStreaming
    ) {
      this.html2CanvasStreaming = true;

      let lastTime;
      const updateStream = (currentTime) => {
        if (!this._closed) {
          if (!lastTime) {
            lastTime = currentTime;
          }
          const timeSinceLastFrame = currentTime - lastTime;
          lastTime = currentTime;

          const fps = this.get("max_fps");
          if (fps === 0) {
            /* TODO: maybe implement the same behavior as here:
                          https://developer.mozilla.org/en-US/docs/Web/API/HTMLCanvasElement/captureStream */
          } else {
            let waitingTime = 0;
            if (fps !== null && fps !== undefined) {
              waitingTime = 1000 / fps - timeSinceLastFrame;
              if (waitingTime < 0) {
                waitingTime = 0;
              }
            }

            setTimeout(() => {
              html2canvas(this.rendered_view.el, {
                canvas: this.canvas,
                logging: false,
                useCORS: true,
                ignoreElements: (element) => {
                  return !(
                    // Do not ignore if the element contains what we want to render
                    (
                      element.contains(this.rendered_view.el) ||
                      // Do not ignore if the element is contained by what we want to render
                      this.rendered_view.el.contains(element) ||
                      // Do not ignore if the element is contained by the head (style and scripts)
                      document.head.contains(element)
                    )
                  );
                },
              }).then(() => {
                window.requestAnimationFrame(updateStream);
              });
            }, waitingTime);
          }
        }
      };
      window.requestAnimationFrame(updateStream);
    }
  }
}

WidgetStreamModel.serializers = {
  ...MediaStreamModel.serializers,
  widget: { deserialize: unpack_models },
};

export class WidgetStreamView extends MediaStreamView {}
