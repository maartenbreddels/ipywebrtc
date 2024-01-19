import * as jupyter_webrtc from "../src";
import { DummyManager } from "./dummy-manager";
import { create_model_webrtc } from "./widget-utils";

describe("VideoStream >", () => {
  beforeEach(async function () {
    this.manager = new DummyManager({ "jupyter-webrtc": jupyter_webrtc });
  });

  it("captureStream no widget", async function () {
    let videoModel = await create_model_webrtc(
      this.manager,
      "VideoStream",
      "video1"
    );
    try {
      await videoModel.captureStream();
      throw new Error("should thrown error");
    } catch (e) {
      if (e.message != "no media widget passed") {
        new Error("wrong msg: " + e.message);
      }
    }
  });
  // it("captureStream creates 1 view", async function() {
  //     let videoModel: any = await create_video_stream(this.manager, 'video1');
  //     await videoModel.captureStream()
  //     let widget1: any = videoModel.media_wid;
  //     await videoModel.captureStream()
  //     let widget2: any = videoModel.media_wid;
  //     expect(widget1).to.equal(widget2);
  // });
});
