import { expect, assert } from 'chai';
import {DummyManager} from './dummy-manager';
import * as jupyter_webrtc from '../lib';
import {create_model, create_model_webrtc, create_view, create_video_stream} from './widget-utils'

// use(require("chai-as-promised"))

describe("VideoStream >", () => {
    beforeEach(async function() {
        this.manager = new DummyManager({'jupyter-webrtc': jupyter_webrtc});
    });

    it("captureStream no widget", async function() {
        let videoModel = await create_model_webrtc(this.manager, 'VideoStream', 'video1');
        try {
            await videoModel.captureStream()
            throw new Error('should thrown error')
        } catch(e) {
            if(e.message != 'no media widget passed') {
                new Error('wrong msg: '  + e.message)
            }
        }
    });
    it("captureStream creates 1 view", async function() {
        let videoModel: any = await create_video_stream(this.manager, 'video1');
        await videoModel.captureStream()
        let widget1: any = videoModel.media_wid;
        await videoModel.captureStream()
        let widget2: any = videoModel.media_wid;
        expect(widget1).to.equal(widget2);
    });
});