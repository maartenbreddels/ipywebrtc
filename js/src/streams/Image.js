import { unpack_models } from "@jupyter-widgets/base";
import * as utils from "../utils";
import { MediaStreamModel } from "./Media";
import { RecorderModel, RecorderView } from "./Recorder";

const captureStream = function (widget) {
  if (widget.captureStream) {
    return widget.captureStream();
  } else {
    return widget.stream;
  }
};

export class ImageStreamModel extends MediaStreamModel {
  defaults() {
    return {
      ...super.defaults(),
      _model_name: "ImageStreamModel",
      image: null,
    };
  }

  initialize() {
    super.initialize.apply(this, arguments);
    window.last_image_stream = this;
    this.canvas = document.createElement("canvas");
    this.context = this.canvas.getContext("2d");

    this.canvas.width = this.get("width");
    this.canvas.height = this.get("height");
    // I was hoping this should do it
    imageWidgetToCanvas(this.get("image"), this.canvas);
    this.get("image").on("change:value", this.sync_image, this);
  }

  sync_image() {
    // not sure if firefox uses moz prefix also on a canvas
    if (this.canvas.captureStream) {
      // TODO: add a fps trait
      // but for some reason we need to do it again
      imageWidgetToCanvas(this.get("image"), this.canvas);
    } else {
      throw new Error("captureStream not supported for this browser");
    }
  }

  async captureStream() {
    this.sync_image();
    return this.canvas.captureStream();
  }
}

ImageStreamModel.serializers = {
  ...MediaStreamModel.serializers,
  image: { deserialize: unpack_models },
};

export class ImageRecorderModel extends RecorderModel {
  defaults() {
    return {
      ...super.defaults(),
      _model_name: "ImageRecorderModel",
      _view_name: "ImageRecorderView",
      image: null,
      _height: "",
      _width: "",
    };
  }

  initialize() {
    super.initialize.apply(this, arguments);
    window.last_image_recorder = this;

    this.type = "image";
  }

  async snapshot() {
    const mimeType = this.type + "/" + this.get("format");
    const mediaStream = await captureStream(this.get("stream"));
    // turn the mediastream into a video element
    let video = document.createElement("video");
    video.srcObject = mediaStream;
    video.play();
    await utils.onCanPlay(video);
    await utils.onLoadedMetaData(video);
    // and the video element can be drawn onto a canvas
    let canvas = document.createElement("canvas");
    let context = canvas.getContext("2d");
    let height = video.videoHeight;
    let width = video.videoWidth;
    canvas.height = height;
    canvas.width = width;
    context.drawImage(video, 0, 0, canvas.width, canvas.height);

    // from the canvas we can get the underlying encoded data
    // TODO: check support for toBlob, or find a polyfill
    const blob = await utils.canvasToBlob(canvas, mimeType);
    this.set("_data_src", window.URL.createObjectURL(blob));
    this._last_blob = blob;

    const bytes = await utils.blobToBytes(blob);

    this.get(this.type).set("value", new DataView(bytes.buffer));
    this.get(this.type).save_changes();
    this.set("_height", height.toString() + "px");
    this.set("_width", width.toString() + "px");
    this.set("recording", false);
    this.save_changes();
  }

  updateRecord() {
    const source = this.get("stream");
    if (!source) {
      throw new Error("No stream specified");
    }

    if (this.get("_data_src") !== "") {
      URL.revokeObjectURL(this.get("_data_src"));
    }
    if (this.get("recording")) this.snapshot();
  }

  download() {
    let filename = this.get("filename");
    let format = this.get("format");
    if (filename.indexOf(".") < 0) {
      filename = this.get("filename") + "." + format;
    }
    utils.downloadBlob(this._last_blob, filename);
  }
}

ImageRecorderModel.serializers = {
  ...RecorderModel.serializers,
  image: { deserialize: unpack_models },
};

export class ImageRecorderView extends RecorderView {
  initialize() {
    super.initialize.apply(this, arguments);
    this.tag = "img";
    this.recordIconClass = "fa fa-camera";
  }
}
