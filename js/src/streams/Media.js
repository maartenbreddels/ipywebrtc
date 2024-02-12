import * as _ from "underscore";
import {
  DOMWidgetView,
  DOMWidgetModel,
  unpack_models,
} from "@jupyter-widgets/base";
import * as utils from "../utils";

const semver_range = "~" + require("../../package.json").version;

export class MediaStreamModel extends DOMWidgetModel {
  defaults() {
    return {
      ...super.defaults(),
      _model_module: "jupyter-webrtc",
      _view_module: "jupyter-webrtc",
      _model_name: "MediaStreamModel",
      _view_name: "MediaStreamView",
      _model_module_version: semver_range,
      _view_module_version: semver_range,
    };
  }

  get stream() {
    return this.captureStream();
  }

  captureStream() {
    throw new Error("Not implemented");
  }
}

const captureStream = function (widget) {
  if (widget.captureStream) {
    return widget.captureStream();
  } else {
    return widget.stream;
  }
};

export class MediaStreamView extends DOMWidgetView {
  render() {
    super.render.apply(this, arguments);
    window.last_media_stream_view = this;
    this.video = document.createElement("video");
    this.video.controls = true;
    this.pWidget.addClass("jupyter-widgets");
    this.pWidget.addClass("widget-image");
    this.pWidget.addClass("video-stream");

    this.initPromise = this.model.captureStream();

    this.initPromise.then(
      (stream) => {
        this.video.srcObject = stream;
        this.el.appendChild(this.video);
        this.video.play();
      },
      (error) => {
        const text = document.createElement("div");
        text.innerHTML =
          "Error creating view for mediastream: " + error.message;
        this.el.appendChild(text);
      },
    );
  }

  remove() {
    if (this.initPromise === null) {
      // Remove already called
      return;
    }
    this.initPromise.then((stream) => {
      this.video.pause();
      this.video.srcObject = null;
    });
    this.initPromise = null;
    return super.remove.apply(this, arguments);
  }
}

export class StreamModel extends MediaStreamModel {
  defaults() {
    return { ...super.defaults(), playing: true };
  }

  initialize() {
    super.initialize.apply(this, arguments);

    this.media = undefined;

    this.on("change:playing", this.updatePlay, this);
  }

  async captureStream() {
    if (!this.createView) {
      this.createView = _.once(() => {
        return this.widget_manager
          .create_view(this.get(this.type))
          .then((view) => {
            this.media_wid = view;
            this.media = this.media_wid.el;
          });
      });
    }
    let widget = this.get(this.type);
    if (!widget) throw new Error("no media widget passed");
    await this.createView();
    if (this.media.captureStream || this.media.mozCaptureStream) {
      // following https://github.com/webrtc/samples/blob/gh-pages/src/content/capture/video-pc/js/main.js
      await utils.onCanPlay(this.media);

      this.updatePlay();

      if (this.media.captureStream) {
        return this.media.captureStream();
      } else if (this.media.mozCaptureStream) {
        return this.media.mozCaptureStream();
      }
    } else {
      throw new Error("captureStream not supported for this browser");
    }
  }

  updatePlay() {
    if (this.get("playing")) {
      this.media.play();
    } else {
      this.media.pause();
    }
  }

  close() {
    const returnValue = super.close.apply(this, arguments);
    this.media.pause();
    this.media_wid.close();
    return returnValue;
  }
}
