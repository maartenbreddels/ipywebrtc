import { unpack_models } from "@jupyter-widgets/base";
import { StreamModel } from "./Media";
import { RecorderModel, RecorderView } from "./Recorder";

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
  video: { deserialize: unpack_models },
};

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
  video: { deserialize: unpack_models },
};

export class VideoRecorderView extends RecorderView {
  initialize() {
    super.initialize.apply(this, arguments);
    this.tag = "video";
    this.recordIconClass = "fa fa-circle";
  }
}
