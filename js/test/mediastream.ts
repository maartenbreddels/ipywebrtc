import { expect } from 'chai';
import {DummyManager} from './dummy-manager';
import jupyter_webrtc = require('..');
import {create_model, create_model_webrtc, create_view} from './widget-utils'


describe("mediastream >", () => {
    beforeEach(async function() {
        this.manager = new DummyManager({'jupyter-webrtc': jupyter_webrtc});
    });

    it("create", async function() {
        let videoModel = await create_model_webrtc(this.manager, 'VideoStream', 'video1');
    });
});