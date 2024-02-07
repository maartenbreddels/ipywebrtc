import {
  DOMWidgetModel,
  DOMWidgetView,
  unpack_models,
} from "@jupyter-widgets/base";

const semver_range = "~" + require("../../package.json").version;

const captureStream = function (widget) {
  if (widget.captureStream) {
    return widget.captureStream();
  } else {
    return widget.stream;
  }
};

export class RecorderModel extends DOMWidgetModel {
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
      console.log("media recorder recording");
      this.chunks = [];

      captureStream(source).then((stream) => {
        console.log("creating media recorder");
        this.mediaRecorder = new MediaRecorder(stream, {
          audioBitsPerSecond: 128000,
          videoBitsPerSecond: 2500000,
          mimeType: mimeType,
        });
        console.log("starting media recorder");
        this.mediaRecorder.start();
        this.mediaRecorder.ondataavailable = (event) => {
          console.log("media recorder pushing chunks");
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
  ...DOMWidgetModel.serializers,
  stream: { deserialize: unpack_models },
};

export class RecorderView extends DOMWidgetView {
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
