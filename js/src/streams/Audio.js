import { DOMWidgetView, unpack_models } from "@jupyter-widgets/base";
import { RecorderModel, RecorderView } from "./Recorder";
import { StreamModel } from "./Media";

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
  audio: { deserialize: unpack_models },
};

export class AudioStreamView extends DOMWidgetView {
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
    return super.remove.apply(this, arguments);
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
  audio: { deserialize: unpack_models },
};

export class AudioRecorderView extends RecorderView {
  initialize() {
    super.initialize.apply(this, arguments);
    this.tag = "audio";
    this.recordIconClass = "fa fa-circle";
  }
}
