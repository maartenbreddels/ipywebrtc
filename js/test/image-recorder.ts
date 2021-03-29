import {assert, expect} from 'chai';
import {DummyManager} from './dummy-manager';
import * as jupyter_webrtc from '../src';
import {create_model, create_model_webrtc, create_view, create_image_stream} from './widget-utils'

// declare function require(string): string;
// let image_data_src = require("base64-image-loader!./jupyter.jpg");


describe("image recorder >", () => {
    beforeEach(async function() {
        this.manager = new DummyManager({'jupyter-webrtc': jupyter_webrtc});
    });

    it("create", async function() {
        // let image_data = (new TextEncoder().encode(image_data_src)).buffer;
        // let imageModel = await create_model(this.manager, '@jupyter-widgets/controls', 'ImageModel', 'ImageView', 'im1', {value: {buffer: image_data}, format: 'url'});
        // let imageStreamModel = await create_model_webrtc(this.manager, 'ImageStream', 'is1', {image: 'IPY_MODEL_im1'});
        let image_target = await create_model(this.manager, '@jupyter-widgets/controls', 'ImageModel', 'imageView', `image1`);
        let image = await create_image_stream(this.manager, 'is1')
        let imageRecorder = await create_model_webrtc(this.manager, 'ImageRecorder', 'mir1', {stream: 'IPY_MODEL_is1', image: 'IPY_MODEL_image1'});
        let view = await this.manager.create_view(imageRecorder);
        await imageRecorder.snapshot()
        // console.log(imageRecorder.get('data'))
        // let bytes =
        // expect()
        // view.recordButton.click()
        // why does this not compile?
        // expect(mediaImageRecorder.get('data')).to.have.lengthOf(0);
    });
});
