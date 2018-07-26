import {assert, expect} from 'chai';
import {DummyManager} from './dummy-manager';
import jupyter_webrtc = require('..');
import {create_model, create_model_webrtc, create_view} from './widget-utils'

declare function require(string): string;
let image_data_src = require("base64-image-loader!./jupyter.jpg");


describe("mediastream >", () => {
    beforeEach(async function() {
        this.manager = new DummyManager({'jupyter-webrtc': jupyter_webrtc});
    });

    it("create", async function() {
        let image_data = (new TextEncoder().encode(image_data_src)).buffer;
        let imageModel = await create_model(this.manager, '@jupyter-widgets/controls', 'ImageModel', 'ImageView', 'im1', {value: {buffer: image_data}, format: 'url'});
        let imageStreamModel = await create_model_webrtc(this.manager, 'ImageStream', 'is1', {image: 'IPY_MODEL_im1'});
        let mediaImageRecorder = await create_model_webrtc(this.manager, 'MediaImageRecorder', 'mir1', {image: 'IPY_MODEL_is1'});
        let view = await this.manager.create_view(mediaImageRecorder);
        view.grabButton.click()
        // why does this not compile?
        // expect(mediaImageRecorder.get('data')).to.have.lengthOf(0);
    });
});