import * as THREEx from "@ar-js-org/ar.js/three.js/build/ar-threex.js";
import * as widgets from "@jupyter-widgets/base";
import * as html2canvas from "html2canvas";
import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import * as _ from "underscore";
import "../css/webrtc.css";
// import blueBg from "../../../images/bg.jpg";
require("webrtc-adapter");

// Workaround for JupyterLab: "ws" is not defined
// https://github.com/maartenbreddels/ipywebrtc/issues/55
window.ws = global.WebSocket;

import * as mqtt from "mqtt";
import * as utils from "./utils";
const semver_range = "~" + require("../package.json").version;

import { imageWidgetToCanvas } from "./utils";

export class MediaStreamModel extends widgets.DOMWidgetModel {
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

export class MediaStreamView extends widgets.DOMWidgetView {
  render() {
    super.render.apply(this, arguments);
    window.last_media_stream_view = this;
    this.video = document.createElement("video");
    this.video.controls = true;
    this.pWidget.addClass("jupyter-widgets");
    this.pWidget.addClass("widget-image");

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
  image: { deserialize: widgets.unpack_models },
};

class StreamModel extends MediaStreamModel {
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

export class VideoStreamModel extends StreamModel {
  defaults() {
    return {
      ...super.defaults(),
      _model_name: "VideoStreamModel",
      video: null,
    };
  }

  initialize() {
    super.initialize.apply(this, arguments);
    window.last_video_stream = this;

    this.type = "video";
  }
}

VideoStreamModel.serializers = {
  ...StreamModel.serializers,
  video: { deserialize: widgets.unpack_models },
};

export class AudioStreamModel extends StreamModel {
  defaults() {
    return {
      ...super.defaults(),
      _model_name: "AudioStreamModel",
      _view_name: "AudioStreamView",
      audio: undefined,
    };
  }

  initialize() {
    super.initialize.apply(this, arguments);
    window.last_audio_stream = this;

    this.type = "audio";
  }
}

AudioStreamModel.serializers = {
  ...StreamModel.serializers,
  audio: { deserialize: widgets.unpack_models },
};

export class AudioStreamView extends widgets.DOMWidgetView {
  render() {
    super.render.apply(this, arguments);
    window.last_audio_stream_view = this;
    this.audio = document.createElement("audio");
    this.audio.controls = true;
    this.pWidget.addClass("jupyter-widgets");

    this.model.captureStream().then(
      (stream) => {
        this.audio.srcObject = stream;
        this.el.appendChild(this.audio);
        this.audio.play();
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
    this.model.captureStream().then((stream) => {
      this.audio.pause();
      this.audio.srcObject = null;
    });
    return widgets.super.remove.apply(this, arguments);
  }
}

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
  widget: { deserialize: widgets.unpack_models },
};

export class WidgetStreamView extends MediaStreamView {}

export class CameraStreamModel extends MediaStreamModel {
  defaults() {
    return {
      ...super.defaults(),
      _model_name: "CameraStreamModel",
      constraints: { audio: true, video: true },
    };
  }

  captureStream() {
    if (!this.cameraStream) {
      this.cameraStream = navigator.mediaDevices.getUserMedia(
        this.get("constraints"),
      );
    }
    return this.cameraStream;
  }

  close() {
    if (this.cameraStream) {
      this.cameraStream.then((stream) => {
        stream.getTracks().forEach((track) => {
          track.stop();
        });
      });
    }
    return super.close.apply(this, arguments);
  }
}

class RecorderModel extends widgets.DOMWidgetModel {
  defaults() {
    return {
      ...super.defaults(),
      _model_module: "jupyter-webrtc",
      _view_module: "jupyter-webrtc",
      _model_module_version: semver_range,
      _view_module_version: semver_range,
      stream: null,
      filename: "record",
      format: "webm",
      codecs: "",
      recording: false,
      _data_src: "",
    };
  }

  initialize() {
    super.initialize.apply(this, arguments);

    this.on("msg:custom", this.handleCustomMessage, this);
    this.on("change:recording", this.updateRecord, this);

    this.mediaRecorder = null;
    this.chunks = [];
    this.stopping = null;
  }

  handleCustomMessage(content) {
    if (content.msg === "download") {
      this.download();
    }
  }

  get mimeType() {
    const codecs = this.get("codecs") || "";
    let mimeType = `${this.type}/${this.get("format")}`;
    if (codecs) {
      mimeType += `; codecs="${codecs}"`;
    }
    return mimeType;
  }

  updateRecord() {
    const source = this.get("stream");
    if (!source) {
      throw new Error("No stream specified");
    }

    const mimeType = this.mimeType;
    if (!MediaRecorder.isTypeSupported(mimeType)) {
      throw new Error(
        `The mimeType ${mimeType} is not supported for record on this browser`,
      );
    }

    if (this.get("recording")) {
      this.chunks = [];

      captureStream(source).then((stream) => {
        this.mediaRecorder = new MediaRecorder(stream, {
          audioBitsPerSecond: 128000,
          videoBitsPerSecond: 2500000,
          mimeType: mimeType,
        });
        this.mediaRecorder.start();
        this.mediaRecorder.ondataavailable = (event) => {
          this.chunks.push(event.data);
        };
      });
    } else {
      this.stopping = new Promise((resolve, reject) => {
        this.mediaRecorder.onstop = (e) => {
          if (this.get("_data_src") !== "") {
            URL.revokeObjectURL(this.get("_data_src"));
          }
          const blob = new Blob(this.chunks, { type: mimeType });
          this.set("_data_src", window.URL.createObjectURL(blob));
          this.save_changes();

          const reader = new FileReader();
          reader.readAsArrayBuffer(blob);
          reader.onloadend = () => {
            const bytes = new Uint8Array(reader.result);
            this.get(this.type).set("value", new DataView(bytes.buffer));
            this.get(this.type).save_changes();
            resolve();
          };
        };
      });
      this.stopping.then(() => {
        this.stopping = null;
      });
      this.mediaRecorder.stop();
    }
  }

  download() {
    if (this.chunks.length === 0) {
      if (this.stopping === null) {
        throw new Error("Nothing to download");
      }
      // Re-trigger after stop completes
      this.stopping.then(() => {
        this.download();
      });
      return;
    }
    let blob = new Blob(this.chunks, { type: this.mimeType });
    let filename = this.get("filename");
    if (filename.indexOf(".") < 0) {
      filename = this.get("filename") + "." + this.get("format");
    }
    utils.downloadBlob(blob, filename);
  }

  close() {
    if (this.get("_data_src") !== "") {
      URL.revokeObjectURL(this.get("_data_src"));
    }
    return super.close.apply(this, arguments);
  }
}

RecorderModel.serializers = {
  ...widgets.DOMWidgetModel.serializers,
  stream: { deserialize: widgets.unpack_models },
};

class RecorderView extends widgets.DOMWidgetView {
  render() {
    super.render.apply(this, arguments);

    this.el.classList.add("jupyter-widgets");

    this.buttons = document.createElement("div");
    this.buttons.classList.add("widget-inline-hbox");
    this.buttons.classList.add("widget-play");

    this.recordButton = document.createElement("button");
    this.downloadButton = document.createElement("button");
    this.result = document.createElement(this.tag);
    this.result.controls = true;

    this.recordButton.className = "jupyter-button";
    this.downloadButton.className = "jupyter-button";

    this.buttons.appendChild(this.recordButton);
    this.buttons.appendChild(this.downloadButton);
    this.el.appendChild(this.buttons);
    this.el.appendChild(this.result);

    const recordIcon = document.createElement("i");
    recordIcon.className = this.recordIconClass;
    this.recordButton.appendChild(recordIcon);
    const downloadIcon = document.createElement("i");
    downloadIcon.className = "fa fa-download";
    this.downloadButton.appendChild(downloadIcon);

    this.recordButton.onclick = () => {
      this.model.set("recording", !this.model.get("recording"));
    };
    this.downloadButton.onclick = this.model.download.bind(this.model);

    this.listenTo(this.model, "change:recording", () => {
      if (this.model.get("recording")) {
        recordIcon.style.color = "darkred";
      } else {
        recordIcon.style.color = "";
      }
    });

    this.listenTo(this.model, "change:_data_src", () => {
      this.result.src = this.model.get("_data_src");
      if (this.result.play) {
        this.result.play();
      }
    });
  }
}

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
  image: { deserialize: widgets.unpack_models },
};

export class ImageRecorderView extends RecorderView {
  initialize() {
    super.initialize.apply(this, arguments);
    this.tag = "img";
    this.recordIconClass = "fa fa-camera";
  }
}

export class VideoRecorderModel extends RecorderModel {
  defaults() {
    return {
      ...super.defaults(),
      _model_name: "VideoRecorderModel",
      _view_name: "VideoRecorderView",
      video: null,
    };
  }

  initialize() {
    super.initialize.apply(this, arguments);
    window.last_video_recorder = this;

    this.type = "video";
  }
}

VideoRecorderModel.serializers = {
  ...RecorderModel.serializers,
  video: { deserialize: widgets.unpack_models },
};

export class VideoRecorderView extends RecorderView {
  initialize() {
    super.initialize.apply(this, arguments);
    this.tag = "video";
    this.recordIconClass = "fa fa-circle";
  }
}

export class AudioRecorderModel extends RecorderModel {
  defaults() {
    return {
      ...super.defaults(),
      _model_name: "AudioRecorderModel",
      _view_name: "AudioRecorderView",
      audio: null,
    };
  }

  initialize() {
    super.initialize.apply(this, arguments);
    window.last_audio_recorder = this;

    this.type = "audio";
  }
}

AudioRecorderModel.serializers = {
  ...RecorderModel.serializers,
  audio: { deserialize: widgets.unpack_models },
};

export class AudioRecorderView extends RecorderView {
  initialize() {
    super.initialize.apply(this, arguments);
    this.tag = "audio";
    this.recordIconClass = "fa fa-circle";
  }
}

export class WebRTCRoomModel extends widgets.DOMWidgetModel {
  defaults() {
    return {
      ...super.defaults(),
      _model_name: "WebRTCRoomModel",
      //_view_name: 'WebRTCRoomView',
      _model_module: "jupyter-webrtc",
      //_view_module: 'jupyter-webrtc',
      _model_module_version: semver_range,
      _view_module_version: semver_range,
      room: "room",
      stream: null,
      room_id: widgets.uuid(),
      nickname: "anonymous",
      peers: [],
      streams: [],
    };
  }
  log() {
    let args = [this.get("nickname") + " " + this.get("room_id") + ": "];
    args = args.concat(Array.prototype.slice.call(arguments));
    console.log.apply(null, args);
  }
  initialize() {
    super.initialize.apply(this, arguments);
    this.set("room_id", widgets.uuid());
    this.room_id = this.get("room_id");
    this.room = this.get("room");
    this.peers = {}; // room_id (string) to WebRTCPeerModel
    window["last_webrtc_room_" + this.room_id] = this;
    const stream = this.get("stream");
    if (stream) {
      this.set("streams", [stream]);
    }
    this.save_changes();
    this.on("msg:custom", this.custom_msg, this);
  }
  custom_msg(content) {
    if (content.msg === "close") {
      this.close();
    }
  }
  close() {
    this.get("peers").forEach((peer) => peer.close());
  }
  create_peer(from_id) {
    return this.widget_manager
      .new_widget(
        {
          model_name: "WebRTCPeerModel",
          model_module: "jupyter-webrtc",
          model_module_version: semver_range,
          view_name: "WebRTCPeerView",
          view_module: "jupyter-webrtc",
          view_module_version: semver_range,
          widget_class: "webrtc.WebRTCPeerModel", // ipywidgets6
        },
        {
          stream_local: this.get("stream"),
          id_local: this.get("room_id"),
          id_remote: from_id,
        },
      )
      .then((peer) => {
        peer.peer_msg_send = (msg) => {
          msg.room_id = this.get("room_id");
          msg.to = from_id;
          this.log("send to peer", msg);
          //console.log('sending to room', msg, from_id);
          peer.save_changes();
          this.room_msg_send(msg);
        };
        return peer;
      });
  }
  listen_to_remote_stream(peer) {
    peer.on(
      "change:stream_remote",
      _.once(() => {
        this.log("add remote stream");
        const streams = this.get("streams").slice();
        const stream = peer.get("stream_remote");
        streams.push(stream);
        this.set("streams", streams);
        this.save_changes();
      }),
    );
    peer.on("change:connected", () => {
      const connected = peer.get("connected");
      this.log(
        "changed connected status for ",
        peer.get("id_remote"),
        "to",
        connected,
      );
      if (!connected) {
        let streams = this.get("streams").slice();
        const stream = peer.get("stream_remote");
        streams = _.without(streams, stream);
        this.set("streams", streams);

        let peers = this.get("peers").slice();
        peers = _.without(peers, peer);
        this.set("peers", peers);

        delete this.peers[peer.get("id_remote")];
        this.save_changes();
      }
    });
  }
  on_room_msg(msg) {
    const from_id = msg.room_id;
    if (msg.room_id === this.room_id) return; // skip my own msg'es
    if (msg.type === "join") {
      this.log("join from", msg.room_id);
      this.peers[from_id] = this.create_peer(from_id).then((peer) => {
        this.listen_to_remote_stream(peer);
        peer.join().then(() => {
          const peers = this.get("peers").slice();
          peers.push(peer);
          this.set("peers", peers);
          this.save_changes();
        });
        return peer;
      });
      this.log(": added peer", from_id);
    } else if (msg.room_id) {
      if (msg.to !== this.room_id) {
        return;
      }
      if (!this.peers[msg.room_id]) {
        this.peers[from_id] = this.create_peer(from_id).then((peer) => {
          this.listen_to_remote_stream(peer);
          const peers = this.get("peers").slice();
          peers.push(peer);
          this.set("peers", peers);
          this.save_changes();
          return peer;
        });
        this.log("added peer", from_id);
      }
      const peer = this.peers[msg.room_id];
      if (peer) {
        //console.log(this.room_id, ': peer', msg.room_id, peer, this, this.cid)
        peer.then((peer) => {
          this.log("sending from", msg.room_id, " to", msg.to, msg);
          peer.on_peer_msg(msg);
        });
      } else {
        console.error("sending to unknown peer", msg.room_id);
      }
    } else {
      console.error("expected a to room_id to be present");
    }
  }
}

WebRTCRoomModel.serializers = {
  ...widgets.DOMWidgetModel.serializers,
  stream: { deserialize: widgets.unpack_models },
  peers: { deserialize: widgets.unpack_models },
};

const global_rooms = {};

export class WebRTCRoomLocalModel extends WebRTCRoomModel {
  defaults() {
    return { ...super.defaults(), _model_name: "WebRTCRoomLocalModel" };
  }
  initialize() {
    super.initialize.apply(this, arguments);
    this.join();
  }
  join() {
    const room = this.get("room");
    console.log("joining room", room);
    const callbacks = global_rooms[room] || [];
    callbacks.push((msg) => this.on_room_msg(msg));
    global_rooms[room] = callbacks;
    this.room_msg_send({ type: "join", room_id: this.get("room_id") });
  }
  room_msg_send(msg) {
    const room = this.get("room");
    console.log("send to room", room, msg, global_rooms[room]);
    _.each(global_rooms[room], function (callback) {
      callback(msg);
    });
  }
}

export class WebRTCRoomMqttModel extends WebRTCRoomModel {
  defaults() {
    return {
      ...super.defaults(),
      _model_name: "WebRTCRoomMqttModel",
      server: "wss://iot.eclipse.org:443/ws",
    };
  }
  initialize() {
    super.initialize.apply(this, arguments);
    console.log("connecting to", this.get("server"));
    this.mqtt_client = mqtt.connect(this.get("server"));
    const client = this.mqtt_client;
    this.topic_join = "jupyter-webrtc/" + this.get("room") + "/join";
    //this.topic_present = 'jupyter-webrtc/' +this.room +'/present'
    this.mqtt_client.on("connect", () => {
      client.subscribe(this.topic_join);
      //client.subscribe(this.topic_present);
      //client.publish('jupyter-webrtc/room-a/present', 'you|me', {retain:true});
      //client.publish('jupyter-webrtc/room-a/join', 'Hello mqtt');
    });
    client.on("message", (topic, message) => {
      const msg = JSON.parse(message);
      console.log("msg received", message, msg);
      if (topic === this.topic_join) {
        this.on_room_msg(msg);
      }
    });
    this.join();
  }
  join() {
    this.room_msg_send({ type: "join", room_id: this.get("room_id") });
  }
  room_msg_send(msg) {
    const text = JSON.stringify(msg);
    console.log("send to mqtt channel", msg);
    this.mqtt_client.publish(this.topic_join, text);
  }
}

export class WebRTCPeerModel extends widgets.DOMWidgetModel {
  defaults() {
    return {
      ...super.defaults(),
      _model_name: "WebRTCPeerModel",
      _view_name: "WebRTCPeerView",
      _model_module: "jupyter-webrtc",
      _view_module: "jupyter-webrtc",
      _model_module_version: semver_range,
      _view_module_version: semver_range,
    };
  }
  log() {
    let args = [this.get("room_id") + ": "];
    args = args.concat(Array.prototype.slice.call(arguments));
    console.log.apply(null, args);
  }
  on_peer_msg(info) {
    this.log("peer msg", info);
    if (info.sdp) {
      // the other party send us the sdp
      this.log(name, "got sdp");
      const sdp_remote = new RTCSessionDescription(info.sdp);
      const remote_description_set = this.pc.setRemoteDescription(sdp_remote);
      if (!this.initiator) {
        console.log(
          this.get("id_local"),
          "did not initiate, reply with answer",
        );
        // if we didn't initiate, we should respond with an answer
        // now we create an answer, and send a sdp back
        Promise.all([remote_description_set, this.tracks_added])
          .then(() => this.pc.createAnswer())
          .then((sdp) => {
            console.log("sending sdp", this.room_id);
            this.send_sdp(sdp);
            this.pc.setLocalDescription(sdp);
          });
      }
    } else if (info.candidate) {
      const c = new RTCIceCandidate(info.candidate);
      this.pc.addIceCandidate(c);
    }
  }
  initialize() {
    super.initialize.apply(this, arguments);

    const room_id = (this.room_id = this.get("id_local"));
    this.initiator = false;

    const pc_config = {
      iceServers: [
        {
          urls: [
            "stun:stun.l.google.com:19302",
            "stun:stun1.l.google.com:19302",
            "stun:stun2.l.google.com:19302",
          ],
        },
      ],
    };
    //const pc_config = null;
    this.pc = new RTCPeerConnection(pc_config);

    window["last_webrtc_" + room_id] = this;
    //this.other = null

    if (this.get("stream_local")) {
      this.tracks_added = new Promise((resolve, reject) => {
        this.get("stream_local").stream.then((stream) => {
          console.log("add stream", stream);
          //this.pc.addStream(stream) (this crashes/hangs chrome)
          // so we use the addTrack api
          stream.getTracks().forEach((track) => {
            this.pc.addTrack(track, stream);
          });
          resolve();
        }); // TODO: catch/reject?
      });
    } else {
      console.log("no stream");
      this.tracks_added = Promise.resolve();
    }
    this.tracks_added.then(() => console.log("tracks added"));
    this.pc.onicecandidate = (event) => {
      console.log(this.room_id, "onicecandidate", event.candidate);
      this.event_candidate = event;
      this.send_ice_candidate(event.candidate);
    };
    this.pc.onopen = () => {
      console.log("onopen", name);
    };
    this.pc.onaddstream = (evt) => {
      console.log("onaddstream", name);
      this.widget_manager
        .new_widget({
          model_name: "MediaStreamModel",
          model_module: "jupyter-webrtc",
          model_module_version: semver_range,
          view_name: "MediaStreamView",
          view_module: "jupyter-webrtc",
          view_module_version: semver_range,
          widget_class: "webrtc.MediaStreamModel", // ipywidgets6
        })
        .then((model) => {
          model.captureStream = () => {
            return new Promise((resolve, reject) => {
              resolve(evt.stream);
            });
          }; // TODO: not nice to just set the method...
          this.set("stream_remote", model);
          //mo
          this.save_changes();
          console.log(this.room_id, ": added stream_remote");
          return model;
        });
    };
    this.pc.onconnecting = () => {
      console.log("onconnecting", name);
    };
    this.pc.oniceconnectionstatechange = () => {
      console.log(
        this.room_id,
        "ICE connection state",
        this.pc.iceConnectionState,
      );
      if (this.pc.iceConnectionState === "disconnected") {
        this.set("connected", false);
        this.save_changes();
      }
      if (this.pc.iceConnectionState === "connected") {
        this.set("connected", true);
        this.save_changes();
      }
      // TODO: can we recover from this?
      if (this.pc.iceConnectionState === "failed") {
        this.set("connected", false);
        this.save_changes();
      }
    };
    /*
        this doesn't seem to exist in chrome at least, lets rely on ice state change above
        this.pc.onconnectionstatechange = () => {
            console.log(this.room_id, 'connection state', this.pc.connectionState);
            if (this.pc.connectionState === 'disconnected') {
                this.set('connected', false)
                this.save_changes()
            }
            if (this.pc.connectionState === 'connected') {
                this.set('connected', true)
                this.save_changes()
            }
        }, this)
        */
    this.on("msg:custom", this.custom_msg, this);
    //this.disconnect = _.once(this.disconnect, this));
    window.addEventListener("beforeunload", () => {
      this.close();
    });
  }
  custom_msg(content) {
    console.log("custom msg", content);
    if (content.msg === "connect") {
      this.connect();
    } else if (content.msg === "close") {
      this.close();
    } else {
      this.disconnect();
    }
  }
  close() {
    //console.log('disconnect')
    this.pc.close(); // does not trigger ice conncection status changes
    this.set("connected", false);
    this.save_changes();
  }
  join() {
    this.initiator = true;
    return this.tracks_added.then(() => {
      return new Promise((resolve, reject) => {
        const room_id = this.get("room_id");
        const offer = {
          offerToReceiveAudio: 1,
          offerToReceiveVideo: 1,
        };

        this.pc
          .createOffer(offer)
          .then((sdp) => {
            console.log("set local desc");
            this.pc.setLocalDescription(sdp);
            console.log(room_id, "send sdp");
            this.send_sdp(sdp);
            resolve();
          })
          .catch((e) => {
            console.error(e);
            reject(e);
          });
        return this;
      });
    });
  }
  send_sdp(sdp) {
    this.broadcast({ sdp: sdp });
  }
  send_ice_candidate(candidate) {
    this.broadcast({ candidate: candidate });
  }
  broadcast(msg) {
    this.peer_msg_send(msg);
  }
}

WebRTCPeerModel.serializers = {
  ...widgets.DOMWidgetModel.serializers,
  stream: { deserialize: widgets.unpack_models },
  peers: { deserialize: widgets.unpack_models },
};

export class WebRTCPeerView extends widgets.DOMWidgetView {
  initialize() {
    const el = document.createElement("video");
    window.last_media_view = this;
    this.setElement(el);
    super.initialize.apply(this, arguments);
  }

  render() {
    this.model.stream.then((stream) => {
      this.el.srcObject = stream;
      this.el.play();
    });
  }
}

// Based on magic cube example by Stemkoski: https://github.com/stemkoski/AR-Examples/blob/master/magic-cube.html
export class ArCubeModel extends widgets.DOMWidgetModel {
  defaults() {
    return {
      ...super.defaults(),
      _model_module: "jupyter-webrtc",
      _view_module: "jupyter-webrtc",
      _model_name: "ArCubeModel",
      _view_name: "ArCubeView",
      _model_module_version: semver_range,
      _view_module_version: semver_range,
      width: 640,
      height: 480,
      scale: 1.0,
      position: [0, 0, 0],
      model_url:
        "https://github.khronos.org/glTF-Sample-Viewer-Release/assets/models/Models/Duck/glTF/Duck.gltf",
      show_stage: true,
      stage_color: "#11111B",
      show_edges: true,
      fps_limit: 60,
      okToLoadModel: true,
    };
  }

  initialize(attributes, options) {
    super.initialize(attributes, options);

    // promise to track if AR.js has loaded the webcam
    this.webcam_loaded = new Promise((resolve) => {
      this.resolve = resolve;
    });

    window.addEventListener("arjs-video-loaded", (e) => {
      this.resolve();
      e.detail.component.style.display = "none";
    });

    // TODO: This feels kind of hacky?
    this.okToLoadModel = true;

    this.setupThreeStuff();
    this.setupSource();
    this.setupContext();
    this.setupMarkerRoots();
    this.setupScene();
    // this.animate();
  }

  setupThreeStuff() {
    this.clock = new THREE.Clock();
    this.scene = new THREE.Scene();

    // TODO: Add this as a python option
    // this.scene.background = new THREE.TextureLoader().load(blueBg);

    this.ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    console.log("this.ambientLight", this.ambientLight);
    this.scene.add(this.ambientLight);

    this.camera = new THREE.Camera();
    this.scene.add(this.camera);
  }

  setupSource() {
    this.arToolkitSource = new THREEx.ArToolkitSource({
      sourceType: "webcam",
      // source height/width used to set ideal in userMediaConstraints
      sourceWidth: this.get("width"),
      sourceHeight: this.get("height"),
      displayWidth: this.get("width"),
      displayHeight: this.get("height"),
    });

    // TODO: resize? Height of cell doesn't change on resize, so to maintain aspect ratio, width of video shouldn't change either
    this.arToolkitSource
      .init
      //function onReady() {this.onResize();}
      ();

    // handle resize event
    // window.addEventListener("resize", () => {
    //   console.log("setup source window listener");
    //   console.log("this-listener", this);
    //   this.onResize();
    // });
  }

  setupContext() {
    console.log("context setup");
    this.arToolkitContext = new THREEx.ArToolkitContext({
      cameraParametersUrl:
        THREEx.ArToolkitContext.baseURL + "../data/data/camera_para.dat",
      detectionMode: "mono",
    });

    // copy projection matrix to camera when initialization complete
    this.arToolkitContext.init(() => {
      this.camera.projectionMatrix.copy(
        this.arToolkitContext.getProjectionMatrix(),
      );
    });
  }

  setupMarkerRoots() {
    console.log("marker root setup");
    this.markerRootArray = [];
    this.markerGroupArray = [];
    // this.patternArray = [
    //   new URL("../../data/letterA.patt", import.meta.url),
    //   new URL("../../data/letterB.patt", import.meta.url),
    //   new URL("../../data/letterC.patt", import.meta.url),
    //   new URL("../../data/letterD.patt", import.meta.url),
    //   new URL("../../data/letterF.patt", import.meta.url),
    //   new URL("../../data/kanji.patt", import.meta.url),
    // ];

    this.patternArray = [
      "letterA",
      "letterB",
      "letterC",
      "letterD",
      "letterF",
      "kanji",
    ];

    this.rotationArray = [
      new THREE.Vector3(-Math.PI / 2, 0, 0),
      new THREE.Vector3(0, -Math.PI / 2, Math.PI / 2),
      new THREE.Vector3(Math.PI / 2, 0, Math.PI),
      new THREE.Vector3(-Math.PI / 2, Math.PI / 2, 0),
      new THREE.Vector3(Math.PI, 0, 0),
      new THREE.Vector3(0, 0, 0),
    ];

    for (let i = 0; i < 6; i++) {
      this.markerRoot = new THREE.Group();

      this.markerRootArray.push(this.markerRoot);

      this.scene.add(this.markerRoot);

      this.markerControls = new THREEx.ArMarkerControls(
        this.arToolkitContext,
        this.markerRoot,
        {
          type: "pattern",
          patternUrl:
            THREEx.ArToolkitContext.baseURL +
            "examples/marker-training/examples/pattern-files/pattern-" +
            this.patternArray[i] +
            ".patt",
          // new URL("../../data/" + this.patternArray[i] + ".patt",import.meta.url),
        },
      );

      this.markerGroup = new THREE.Group();
      this.markerGroupArray.push(this.markerGroup);

      this.markerGroup.position.y = -1.25 / 2;
      this.markerGroup.rotation.setFromVector3(this.rotationArray[i]);

      this.markerRoot.add(this.markerGroup);
    }
  }

  setupScene() {
    console.log("scene setup");
    this.sceneGroup = new THREE.Group();

    // Scale cube model to cover physical cube
    this.sceneGroup.scale.set(1.75 / 2, 1.75 / 2, 1.75 / 2);

    this.buildStage();

    this.cubeEdges();

    this.loadModel();

    // fancy light
    this.pointLight = new THREE.PointLight(0xffffff, 1, 50);
    this.pointLight.position.set(0.5, 3, 2);
    this.scene.add(this.pointLight);
  }

  buildStage() {
    this.loader = new THREE.TextureLoader();

    // TODO: Let user set image
    // this.stageTextureImage = this.get("bg") || blueBg;
    // this.stageTexture = this.loader.load(this.stageTextureImage);

    // remove old model first
    if (this.stage) {
      this.removeFromScene(this.stage);
    }

    // reversed cube
    this.stageMesh = new THREE.MeshBasicMaterial({
      // map: this.stageTexture,
      color: this.get("stage_color"), //1a1b26
      side: THREE.BackSide,
    });

    this.stage = new THREE.Mesh(new THREE.BoxGeometry(2, 2, 2), this.stageMesh);
    this.sceneGroup.add(this.stage);
  }

  cubeEdges() {
    // cube edges
    this.edgeGroup = new THREE.Group();

    this.edgeGeometry = new THREE.CylinderGeometry(0.03, 0.03, 2, 32);

    this.edgeCenters = [
      new THREE.Vector3(0, -1, -1),
      new THREE.Vector3(0, 1, -1),
      new THREE.Vector3(0, -1, 1),
      new THREE.Vector3(0, 1, 1),
      new THREE.Vector3(-1, 0, -1),
      new THREE.Vector3(1, 0, -1),
      new THREE.Vector3(-1, 0, 1),
      new THREE.Vector3(1, 0, 1),
      new THREE.Vector3(-1, -1, 0),
      new THREE.Vector3(1, -1, 0),
      new THREE.Vector3(-1, 1, 0),
      new THREE.Vector3(1, 1, 0),
    ];

    this.edgeRotations = [
      new THREE.Vector3(0, 0, Math.PI / 2),
      new THREE.Vector3(0, 0, Math.PI / 2),
      new THREE.Vector3(0, 0, Math.PI / 2),
      new THREE.Vector3(0, 0, Math.PI / 2),
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(Math.PI / 2, 0, 0),
      new THREE.Vector3(Math.PI / 2, 0, 0),
      new THREE.Vector3(Math.PI / 2, 0, 0),
      new THREE.Vector3(Math.PI / 2, 0, 0),
    ];

    for (let i = 0; i < 12; i++) {
      let edge = new THREE.Mesh(
        this.edgeGeometry,
        new THREE.MeshLambertMaterial({
          color: 0x262626,
        }),
      );

      edge.position.copy(this.edgeCenters[i]);
      edge.rotation.setFromVector3(this.edgeRotations[i]);

      this.edgeGroup.add(edge);
    }

    this.sceneGroup.add(this.edgeGroup);
  }

  loadModel() {
    // instantiate loader
    if (!this.gltfLoader) {
      this.gltfLoader = new GLTFLoader();
    }

    // remove old model first
    if (this.gltfModel) {
      this.removeFromScene(this.gltfModel);
    }

    // load model
    if (this.okToLoadModel) {
      this.okToLoadModel = false;

      this.gltfLoader.load(
        this.get("model_url"),
        (gltf) => {
          let scale = this.get("scale");
          this.gltfModel = gltf.scene;
          this.gltfModel.scale.set(scale, scale, scale);
          this.gltfModel.position.fromArray(this.get("position"));

          this.animations = gltf.animations;
          this.mixer = new THREE.AnimationMixer(this.gltfModel);

          if (this.animations) {
            this.animations.forEach((clip) => {
              this.mixer.clipAction(clip).play();
            });
          }

          this.sceneGroup.add(this.gltfModel);
          this.okToLoadModel = true;
        },
        () => {
          console.log("model loading");
        },
        (error) => {
          console.log("Error loading model", error);
        },
      );
    }
  }

  // TODO: Handle ImageBitMaps
  // disposeTexture(texture) {
  //   if (texture instanceof THREE.Texture) {
  //     texture.dispose();
  //   } else if (texture instanceof ImageBitmap) {
  //     // Dispose of ImageBitmap
  //     texture.close();
  //   }
  //   // Add more conditions for other texture types as needed
  // }

  // dispose geometries, materials, and textures associated with previous model
  removeFromScene(object3d) {
    this.sceneGroup.remove(object3d);

    object3d.traverse((object) => {
      if (object.isMesh) {
        // Dispose of textures
        for (const key in object.material) {
          if (key.endsWith("Map") && object.material[key]) {
            object.material[key].dispose();
          }
        }

        // this is the only one with a lower case m so let's just toss it in
        if (object.material.map) {
          object.material.map.dispose();
        }

        object.geometry.dispose();
        object.material.dispose();

        // TODO: Handle ImageBitMaps
      }
    });
  }

  // onResize() {
  //   console.log("this-resize", this);

  //   this.arToolkitSource.onResizeElement();
  //   this.arToolkitSource.copySizeTo(this.renderer.domElement);
  //   if (this.arToolkitContext.arController !== null) {
  //     this.arToolkitSource.copySizeTo(
  //       this.arToolkitContext.arController.canvas,
  //     );
  //   }
  // }
}

ArCubeModel.serializers = {
  ...widgets.DOMWidgetModel.serializers,
};

export class ArCubeView extends widgets.DOMWidgetView {
  async render() {
    // start time for FPS limit
    this.then = performance.now();
    this.fpsInterval = 1000 / this.model.get("fps_limit");

    // Check if webcam feed already exists
    this.webcamFromArjs = document.getElementById("arjs-video");

    // Wait for AR.js to set up webcam feed before rendering view
    if (!this.webcamFromArjs) {
      await this.model.webcam_loaded;
    }

    super.render();

    this.setupRenderer();
    this.inViewObserver();
    this.modelEvents();

    this.el.classList.add("ar-container");
    this.el.style.minHeight = "480px";

    this.el.appendChild(this.renderer.domElement);

    // Create new webcam element
    this.existingWebcam = document.getElementById("arjs-video");
    this.newWebcam = this.existingWebcam.cloneNode(true);
    this.newWebcam.srcObject = this.existingWebcam.srcObject;
    this.newWebcam.id = `webcamView${Object.keys(this.model.views).length}`;
    this.newWebcam.style.display = "";
    this.newWebcam.style.zIndex = "0";
    // this.newWebcam.classList.add("jl-vid");
    this.el.appendChild(this.newWebcam);
  }

  setupRenderer() {
    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
    });

    this.renderer.setClearColor(new THREE.Color("lightgrey"), 0);
    this.renderer.setSize(this.model.get("width"), this.model.get("height"));
    this.renderer.domElement.style.zIndex = "2";
    this.renderer.domElement.style.position = "absolute";
    this.renderer.domElement.style.top = "0px";
    this.renderer.domElement.style.left = "0px";
  }

  animate() {
    this.animationRequestId = window.requestAnimationFrame(
      this.animate.bind(this),
    );

    this.mixerUpdateDelta = this.model.clock.getDelta();

    this.now = performance.now();

    // time elapsed since last frame
    // TODO: I think I can use getDelta from the three clock here maybe?
    this.elapsed = this.now - this.then;

    // if enough time has passed to render the next frame
    if (this.elapsed > this.fpsInterval) {
      this.then = this.now - (this.elapsed % this.fpsInterval);

      this.update();
      this.model.mixer.update(this.mixerUpdateDelta);

      this.renderer.render(this.model.scene, this.model.camera);
    }
  }

  // Stop animation loop if view is not in viewport
  inViewObserver() {
    this.observer = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting) {
        this.animate();
      } else {
        window.cancelAnimationFrame(this.animationRequestId);
        this.animationRequestId = undefined;
      }
    });

    this.observer.observe(this.el);
  }

  update() {
    // update artoolkit on every frame
    if (this.model.arToolkitSource.ready !== false)
      this.model.arToolkitContext.update(this.model.arToolkitSource.domElement);

    for (let i = 0; i < 6; i++) {
      if (this.model.markerRootArray[i].visible) {
        this.model.markerGroupArray[i].add(this.model.sceneGroup);
        // console.log("visible: " + this.model.patternArray[i]);
        break;
      }
    }
  }

  modelEvents() {
    this.listenTo(this.model, "change:position", () => {
      this.model.gltfModel.position.fromArray(this.model.get("position"));
    });

    this.listenTo(this.model, "change:scale", () => {
      let scale = this.model.get("scale");
      this.model.gltfModel.scale.set(scale, scale, scale);
    });

    this.listenTo(this.model, "change:model_url", () => {
      if (this.model.get("okToLoadModel")) {
        this.model.loadModel();
      }
    });

    this.listenTo(this.model, "change:show_stage", () => {
      if (this.model.get("show_stage")) {
        this.model.stage.visible = true;
      } else {
        this.model.stage.visible = false;
      }
    });

    this.listenTo(this.model, "change:stage_color", () => {
      this.model.buildStage();
    });

    this.listenTo(this.model, "change:show_edges", () => {
      if (this.model.get("show_edges")) {
        this.model.edgeGroup.visible = true;
      } else {
        this.model.edgeGroup.visible = false;
      }
    });
  }
}

window.addEventListener("markerFound", () => {
  console.log("Marker found");
});

window.addEventListener("markerLost", () => {
  console.log("Marker lost");
});
