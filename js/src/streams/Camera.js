import { MediaStreamModel } from "./Media";

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
