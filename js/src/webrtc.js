import * as widgets from '@jupyter-widgets/base';
import * as _  from 'underscore';
require('webrtc-adapter');
import * as html2canvas from 'html2canvas';

// Workaround for JupyterLab: "ws" is not defined
// https://github.com/maartenbreddels/ipywebrtc/issues/55
window.ws = global.WebSocket;

import * as mqtt from 'mqtt';
import * as utils from './utils';
const semver_range = '~' + require('../package.json').version;

import { imageWidgetToCanvas } from './utils';

export class MediaStreamModel extends widgets.DOMWidgetModel {
    defaults() {
        return {...super.defaults(),
            _model_module: 'jupyter-webrtc',
            _view_module: 'jupyter-webrtc',
            _model_name: 'MediaStreamModel',
            _view_name: 'MediaStreamView',
            _model_module_version: semver_range,
            _view_module_version: semver_range,
        };
    }

    get stream() {
        return this.captureStream();
    }

    captureStream() {
        throw new Error('Not implemented');
    }
}

const captureStream = function(widget) {
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
        this.video = document.createElement('video');
        this.video.controls = true;
        this.pWidget.addClass('jupyter-widgets');
        this.pWidget.addClass('widget-image');

        this.initPromise = this.model.captureStream();

        this.initPromise.then((stream) => {
            this.video.srcObject = stream;
            this.el.appendChild(this.video);
            this.video.play();
        }, (error) => {
            const text = document.createElement('div');
            text.innerHTML = 'Error creating view for mediastream: ' + error.message;
            this.el.appendChild(text);
        });
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
        return {...super.defaults(),
            _model_name: 'ImageStreamModel',
            image: null,
        };
    }

    initialize() {
        super.initialize.apply(this, arguments);
        window.last_image_stream = this;
        this.canvas = document.createElement('canvas');
        this.context = this.canvas.getContext('2d');

        this.canvas.width = this.get('width');
        this.canvas.height = this.get('height');
        // I was hoping this should do it
        imageWidgetToCanvas(this.get('image'), this.canvas);
        this.get('image').on('change:value', this.sync_image, this);
    }

    sync_image() {
        // not sure if firefox uses moz prefix also on a canvas
        if (this.canvas.captureStream) {
            // TODO: add a fps trait
            // but for some reason we need to do it again
            imageWidgetToCanvas(this.get('image'), this.canvas);
        } else {
            throw new Error('captureStream not supported for this browser');
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
        return { ...super.defaults(),
            playing: true,
        };
    }

    initialize() {
        super.initialize.apply(this, arguments);

        this.media = undefined;

        this.on('change:playing', this.updatePlay, this);
    }

    async captureStream() {
        if (!this.createView) {
            this.createView = _.once(() => {
                return this.widget_manager.create_view(this.get(this.type)).then((view) => {
                    this.media_wid = view;
                    this.media = this.media_wid.el;
                });
            });
        }
        let widget = this.get(this.type);
        if (!widget)
            throw new Error('no media widget passed');
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
            throw new Error('captureStream not supported for this browser');
        }
    }

    updatePlay() {
        if (this.get('playing')) {
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
        return { ...super.defaults(),
            _model_name: 'VideoStreamModel',
            video: null,
        };
    }

    initialize() {
        super.initialize.apply(this, arguments);
        window.last_video_stream = this;

        this.type = 'video';
    }
}

VideoStreamModel.serializers = {
    ...StreamModel.serializers,
    video: { deserialize: widgets.unpack_models }
};

export class AudioStreamModel extends StreamModel {
    defaults() {
        return {...super.defaults(),
            _model_name: 'AudioStreamModel',
            _view_name: 'AudioStreamView',
            audio: undefined,
        };
    }

    initialize() {
        super.initialize.apply(this, arguments);
        window.last_audio_stream = this;

        this.type = 'audio';
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
        this.audio = document.createElement('audio');
        this.audio.controls = true;
        this.pWidget.addClass('jupyter-widgets');

        this.model.captureStream().then((stream) => {
            this.audio.srcObject = stream;
            this.el.appendChild(this.audio);
            this.audio.play();
        }, (error) => {
            const text = document.createElement('div');
            text.innerHTML = 'Error creating view for mediastream: ' + error.message;
            this.el.appendChild(text);
        });
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
        return {...super.defaults(),
            _model_name: 'WidgetStreamModel',
            _view_name: 'WidgetStreamView',
            widget: null,
            max_fps: null,
            _html2canvas_start_streaming: false,
        };
    }

    initialize() {
        super.initialize.apply(this, arguments);

        this.on('change:_html2canvas_start_streaming', this.updateHTML2CanvasStreaming, this);
        this.rendered_view = null;

        // If the widget already has a captureStream -> use it
        if (typeof this.get('widget').captureStream === 'function') {
            const fps = this.get('max_fps');
            this.captureStream = () => {
                if (fps === null || fps === undefined) {
                    return this.get('widget').captureStream();
                }
                return this.get('widget').captureStream(fps);
            };
        }
        // Else try to stream the first view of this widget
        else {
            this.captureStream = () => {
                const id_views = Object.keys(this.get('widget').views);
                if (id_views.length === 0) {
                    return new Promise((resolve, reject) => {
                        reject({'message': 'Cannot create WidgetStream if the widget has no view rendered'});
                    });
                }

                const first_view = this.get('widget').views[id_views[0]];
                return first_view.then((view) => {
                    this.rendered_view = view;

                    // If the widget view is a canvas or a video element
                    const capturable_obj = this.find_capturable_obj(this.rendered_view.el);
                    if (capturable_obj) {
                        return this._captureStream(capturable_obj);
                    }

                    // Else use html2canvas
                    this.canvas = document.createElement('canvas');
                    this.set('_html2canvas_start_streaming', true);
                    return this._captureStream(this.canvas);
                });
            };
        }
    }

    _captureStream(capturable_obj) {
        return new Promise((resolve, reject) => {
            const fps = this.get('max_fps');

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

            reject(new Error('captureStream not supported for this browser'));
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
        if (this.get('_html2canvas_start_streaming') && !this.html2CanvasStreaming) {
            this.html2CanvasStreaming = true;

            let lastTime;
            const updateStream = (currentTime) => {
                if (!this._closed) {
                    if (!lastTime) {
                        lastTime = currentTime;
                    }
                    const timeSinceLastFrame = currentTime - lastTime;
                    lastTime = currentTime;

                    const fps = this.get('max_fps');
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
                                        element.contains(this.rendered_view.el) ||
                                        // Do not ignore if the element is contained by what we want to render
                                        this.rendered_view.el.contains(element) ||
                                        // Do not ignore if the element is contained by the head (style and scripts)
                                        document.head.contains(element)
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

export class WidgetStreamView extends MediaStreamView {
}

export class CameraStreamModel extends MediaStreamModel {
    defaults() {
        return {...super.defaults(),
            _model_name: 'CameraStreamModel',
            constraints: {audio: true, video: true}
        };
    }

    captureStream() {
        if (!this.cameraStream) {
            this.cameraStream = navigator.mediaDevices.getUserMedia(this.get('constraints'));
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
        return {...super.defaults(),
            _model_module: 'jupyter-webrtc',
            _view_module: 'jupyter-webrtc',
            _model_module_version: semver_range,
            _view_module_version: semver_range,
            stream: null,
            filename: 'record',
            format: 'webm',
            codecs: '',
            recording: false,
            _data_src: '',
         };
    }

    initialize() {
        super.initialize.apply(this, arguments);

        this.on('msg:custom', this.handleCustomMessage, this);
        this.on('change:recording', this.updateRecord, this);

        this.mediaRecorder = null;
        this.chunks = [];
        this.stopping = null;
    }

    handleCustomMessage(content) {
        if (content.msg === 'download') {
            this.download();
        }
    }

    get mimeType() {
        const codecs = this.get('codecs') || '';
        let mimeType = `${this.type}/${this.get('format')}`;
        if (codecs) {
            mimeType += `; codecs="${codecs}"`;
        }
        return mimeType;
    }

    updateRecord() {
        const source = this.get('stream');
        if (!source) {
            throw new Error('No stream specified');
        }

        const mimeType = this.mimeType;
        if (!MediaRecorder.isTypeSupported(mimeType)) {
            throw new Error(`The mimeType ${mimeType} is not supported for record on this browser`);
        }

        if (this.get('recording')) {
            this.chunks = [];

            captureStream(source).then((stream) => {
                this.mediaRecorder = new MediaRecorder(stream, {
                    audioBitsPerSecond: 128000,
                    videoBitsPerSecond: 2500000,
                    mimeType: mimeType
                });
                this.mediaRecorder.start();
                this.mediaRecorder.ondataavailable = (event) => {
                    this.chunks.push(event.data);
                };
            });
        } else {
            this.stopping = new Promise((resolve, reject) => {
                this.mediaRecorder.onstop = (e) => {
                    if (this.get('_data_src') !== '') {
                        URL.revokeObjectURL(this.get('_data_src'));
                    }
                    const blob = new Blob(this.chunks, { 'type' : mimeType });
                    this.set('_data_src', window.URL.createObjectURL(blob));
                    this.save_changes();

                    const reader = new FileReader();
                    reader.readAsArrayBuffer(blob);
                    reader.onloadend = () => {
                        const bytes = new Uint8Array(reader.result);
                        this.get(this.type).set('value', new DataView(bytes.buffer));
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
                throw new Error('Nothing to download');
            }
            // Re-trigger after stop completes
            this.stopping.then(() => {
                this.download();
            });
            return;
        }
        let blob = new Blob(this.chunks, {type: this.mimeType});
        let filename = this.get('filename');
        if (filename.indexOf('.') < 0) {
          filename = this.get('filename') + '.' + this.get('format');
        }
        utils.downloadBlob(blob, filename);
    }

    close() {
        if (this.get('_data_src') !== '') {
            URL.revokeObjectURL(this.get('_data_src'));
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

        this.el.classList.add('jupyter-widgets');

        this.buttons = document.createElement('div');
        this.buttons.classList.add('widget-inline-hbox');
        this.buttons.classList.add('widget-play');

        this.recordButton = document.createElement('button');
        this.downloadButton = document.createElement('button');
        this.result = document.createElement(this.tag);
        this.result.controls = true;

        this.recordButton.className = 'jupyter-button';
        this.downloadButton.className = 'jupyter-button';

        this.buttons.appendChild(this.recordButton);
        this.buttons.appendChild(this.downloadButton);
        this.el.appendChild(this.buttons);
        this.el.appendChild(this.result);

        const recordIcon = document.createElement('i');
        recordIcon.className = this.recordIconClass;
        this.recordButton.appendChild(recordIcon);
        const downloadIcon = document.createElement('i');
        downloadIcon.className = 'fa fa-download';
        this.downloadButton.appendChild(downloadIcon);

        this.recordButton.onclick = () => {
            this.model.set('recording', !this.model.get('recording'));
        };
        this.downloadButton.onclick = this.model.download.bind(this.model);

        this.listenTo(this.model, 'change:recording', () => {
            if (this.model.get('recording')) {
                recordIcon.style.color = 'darkred';
            } else {
                recordIcon.style.color = '';
            }
        });

        this.listenTo(this.model, 'change:_data_src', () => {
            this.result.src = this.model.get('_data_src');
            if (this.result.play) {
                this.result.play();
            }
        });
    }
}

export class ImageRecorderModel extends RecorderModel {
    defaults() {
        return {...super.defaults(),
            _model_name: 'ImageRecorderModel',
            _view_name: 'ImageRecorderView',
            image: null,
            _height: '',
            _width: '',
        };
    }

    initialize() {
        super.initialize.apply(this, arguments);
        window.last_image_recorder = this;

        this.type = 'image';
    }

    async snapshot() {
        const mimeType = this.type + '/' + this.get('format');
        const mediaStream = await captureStream(this.get('stream'));
        // turn the mediastream into a video element
        let video = document.createElement('video');
        video.srcObject = mediaStream;
        video.play();
        await utils.onCanPlay(video);
        await utils.onLoadedMetaData(video);
        // and the video element can be drawn onto a canvas
        let canvas = document.createElement('canvas');
        let context = canvas.getContext('2d');
        let height = video.videoHeight;
        let width = video.videoWidth;
        canvas.height = height;
        canvas.width = width;
        context.drawImage(video, 0, 0, canvas.width, canvas.height);

        // from the canvas we can get the underlying encoded data
        // TODO: check support for toBlob, or find a polyfill
        const blob = await utils.canvasToBlob(canvas, mimeType);
        this.set('_data_src', window.URL.createObjectURL(blob));
        this._last_blob = blob;

        const bytes = await utils.blobToBytes(blob);

        this.get(this.type).set('value', new DataView(bytes.buffer));
        this.get(this.type).save_changes();
        this.set('_height', height.toString() + 'px');
        this.set('_width', width.toString() + 'px');
        this.set('recording', false);
        this.save_changes();
    }

    updateRecord() {
        const source = this.get('stream');
        if (!source) {
            throw new Error('No stream specified');
        }

        if (this.get('_data_src') !== '') {
            URL.revokeObjectURL(this.get('_data_src'));
        }
        if (this.get('recording'))
            this.snapshot();
    }

    download() {
        let filename = this.get('filename');
        let format = this.get('format');
        if (filename.indexOf('.') < 0) {
          filename = this.get('filename') + '.' + format;
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
        this.tag = 'img';
        this.recordIconClass = 'fa fa-camera';
    }
}

export class VideoRecorderModel extends RecorderModel {
    defaults() {
        return {...super.defaults(),
            _model_name: 'VideoRecorderModel',
            _view_name: 'VideoRecorderView',
            video: null,
        };
    }

    initialize() {
        super.initialize.apply(this, arguments);
        window.last_video_recorder = this;

        this.type = 'video';
    }
}

VideoRecorderModel.serializers = {
    ...RecorderModel.serializers,
    video: { deserialize: widgets.unpack_models },
};

export class VideoRecorderView extends RecorderView {
    initialize() {
        super.initialize.apply(this, arguments);
        this.tag = 'video';
        this.recordIconClass = 'fa fa-circle';
    }
}

export class AudioRecorderModel extends RecorderModel {
    defaults() {
        return {...super.defaults(),
            _model_name: 'AudioRecorderModel',
            _view_name: 'AudioRecorderView',
            audio: null,
        };
    }

    initialize() {
        super.initialize.apply(this, arguments);
        window.last_audio_recorder = this;

        this.type = 'audio';
    }
}

AudioRecorderModel.serializers = {
    ...RecorderModel.serializers,
    audio: { deserialize: widgets.unpack_models },
};

export class AudioRecorderView extends RecorderView {
    initialize() {
        super.initialize.apply(this, arguments);
        this.tag = 'audio';
        this.recordIconClass = 'fa fa-circle';
    }
}

export class WebRTCRoomModel extends widgets.DOMWidgetModel {
    defaults() {
        return {...super.defaults(),
            _model_name: 'WebRTCRoomModel',
            //_view_name: 'WebRTCRoomView',
            _model_module: 'jupyter-webrtc',
            //_view_module: 'jupyter-webrtc',
            _model_module_version: semver_range,
            _view_module_version: semver_range,
            room: 'room',
            stream: null,
            room_id: widgets.uuid(),
            nickname: 'anonymous',
            peers: [],
            streams: []
        };
    }
    log() {
        let args = [this.get('nickname') + ' ' + this.get('room_id') + ': '];
        args = args.concat(Array.prototype.slice.call(arguments));
        console.log.apply(null, args);
    }
    initialize() {
        super.initialize.apply(this, arguments);
        this.set('room_id',  widgets.uuid());
        this.room_id = this.get('room_id');
        this.room = this.get('room');
        this.peers = {}; // room_id (string) to WebRTCPeerModel
        window['last_webrtc_room_' + this.room_id] = this;
        const stream = this.get('stream');
        if (stream) {
            this.set('streams', [stream]);
        }
        this.save_changes();
        this.on('msg:custom', this.custom_msg, this);
    }
    custom_msg(content) {
        if (content.msg === 'close') {
            this.close();
        }
    }
    close() {
        this.get('peers').forEach((peer) => peer.close());
    }
    create_peer(from_id) {
        return this.widget_manager.new_widget({
                model_name: 'WebRTCPeerModel',
                model_module: 'jupyter-webrtc',
                model_module_version: semver_range,
                view_name: 'WebRTCPeerView',
                view_module: 'jupyter-webrtc',
                view_module_version: semver_range,
                widget_class: 'webrtc.WebRTCPeerModel', // ipywidgets6
            }, {
                stream_local: this.get('stream'),
                id_local: this.get('room_id'),
                id_remote: from_id,
        }).then((peer) => {
            peer.peer_msg_send = (msg) => {
                msg.room_id = this.get('room_id');
                msg.to = from_id;
                this.log('send to peer', msg);
                //console.log('sending to room', msg, from_id);
                peer.save_changes();
                this.room_msg_send(msg);
            };
            return peer;
        });
    }
    listen_to_remote_stream(peer) {
        peer.on('change:stream_remote', _.once(() => {
            this.log('add remote stream');
            const streams = this.get('streams').slice();
            const stream = peer.get('stream_remote');
            streams.push(stream);
            this.set('streams', streams);
            this.save_changes();
        }));
        peer.on('change:connected', () => {
            const connected = peer.get('connected');
            this.log('changed connected status for ', peer.get('id_remote'), 'to', connected);
            if (!connected) {
                let streams = this.get('streams').slice();
                const stream = peer.get('stream_remote');
                streams = _.without(streams, stream);
                this.set('streams', streams);

                let peers = this.get('peers').slice();
                peers = _.without(peers, peer);
                this.set('peers', peers);

                delete this.peers[peer.get('id_remote')];
                this.save_changes();
            }
        });
    }
    on_room_msg(msg) {
        const from_id = msg.room_id;
        if (msg.room_id === this.room_id)
            return; // skip my own msg'es
        if (msg.type === 'join') {
            this.log('join from', msg.room_id);
            this.peers[from_id] = this.create_peer(from_id).then((peer) => {
                this.listen_to_remote_stream(peer);
                peer.join().then(() => {
                    const peers = this.get('peers').slice();
                    peers.push(peer);
                    this.set('peers', peers);
                    this.save_changes();
                });
                return peer;
            });
            this.log(': added peer', from_id);
        } else if (msg.room_id) {
            if (msg.to !== this.room_id) {
                return;
            }
            if (!this.peers[msg.room_id]) {
                this.peers[from_id] = this.create_peer(from_id).then((peer) => {
                    this.listen_to_remote_stream(peer);
                    const peers = this.get('peers').slice();
                    peers.push(peer);
                    this.set('peers', peers);
                    this.save_changes();
                    return peer;
                });
                this.log('added peer', from_id);
            }
            const peer = this.peers[msg.room_id];
            if (peer) {
                //console.log(this.room_id, ': peer', msg.room_id, peer, this, this.cid)
                peer.then((peer) => {
                    this.log('sending from', msg.room_id, ' to', msg.to, msg);
                    peer.on_peer_msg(msg);
                });
            } else {
                console.error('sending to unknown peer', msg.room_id);
            }
        } else {
            console.error('expected a to room_id to be present');
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
        return {...super.defaults(),
            _model_name: 'WebRTCRoomLocalModel',
        };
    }
    initialize() {
        super.initialize.apply(this, arguments);
        this.join();
    }
    join() {
        const room = this.get('room');
        console.log('joining room', room);
        const callbacks = global_rooms[room] || [];
        callbacks.push((msg) => this.on_room_msg(msg));
        global_rooms[room] = callbacks;
        this.room_msg_send({type: 'join', room_id: this.get('room_id')});

    }
    room_msg_send(msg) {
        const room = this.get('room');
        console.log('send to room', room, msg, global_rooms[room]);
        _.each(global_rooms[room], function(callback) {
            callback(msg);
        });
    }
}

export class WebRTCRoomMqttModel extends WebRTCRoomModel {
    defaults() {
        return {...super.defaults(),
            _model_name: 'WebRTCRoomMqttModel',
            server: 'wss://iot.eclipse.org:443/ws'
        };
    }
    initialize() {
        super.initialize.apply(this, arguments);
        console.log('connecting to', this.get('server'));
        this.mqtt_client = mqtt.connect(this.get('server'));
        const client = this.mqtt_client;
        this.topic_join = 'jupyter-webrtc/' + this.get('room') + '/join';
        //this.topic_present = 'jupyter-webrtc/' +this.room +'/present'
        this.mqtt_client.on('connect', () => {
          client.subscribe(this.topic_join);
          //client.subscribe(this.topic_present);
          //client.publish('jupyter-webrtc/room-a/present', 'you|me', {retain:true});
          //client.publish('jupyter-webrtc/room-a/join', 'Hello mqtt');
        });
        client.on('message', (topic, message) => {
            const msg = JSON.parse(message);
            console.log('msg received', message, msg);
            if (topic === this.topic_join) {
                this.on_room_msg(msg);
            }
        });
        this.join();
    }
    join() {
        this.room_msg_send({type: 'join', room_id: this.get('room_id')});

    }
    room_msg_send(msg) {
        const text = JSON.stringify(msg);
        console.log('send to mqtt channel', msg);
        this.mqtt_client.publish(this.topic_join, text);
    }
}

export class WebRTCPeerModel extends widgets.DOMWidgetModel {
    defaults() {
        return {...super.defaults(),
            _model_name: 'WebRTCPeerModel',
            _view_name: 'WebRTCPeerView',
            _model_module: 'jupyter-webrtc',
            _view_module: 'jupyter-webrtc',
            _model_module_version: semver_range,
            _view_module_version: semver_range
        };
    }
    log() {
        let args = [this.get('room_id') + ': '];
        args = args.concat(Array.prototype.slice.call(arguments));
        console.log.apply(null, args);
    }
    on_peer_msg(info) {
        this.log('peer msg', info);
        if (info.sdp) {
            // the other party send us the sdp
            this.log(name, 'got sdp');
            const sdp_remote = new RTCSessionDescription(info.sdp);
            const remote_description_set = this.pc.setRemoteDescription(sdp_remote);
            if (!this.initiator) {
                console.log(this.get('id_local'), 'did not initiate, reply with answer');
                // if we didn't initiate, we should respond with an answer
                // now we create an answer, and send a sdp back
                Promise.all([remote_description_set, this.tracks_added])
                    .then(() => this.pc.createAnswer())
                    .then((sdp) => {
                        console.log('sending sdp', this.room_id);
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

        const room_id = this.room_id = this.get('id_local');
        this.initiator = false;

        const pc_config = {'iceServers': [{'urls': ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302', 'stun:stun2.l.google.com:19302']}]};
        //const pc_config = null;
        this.pc = new RTCPeerConnection(pc_config);

        window['last_webrtc_' + room_id] = this;
        //this.other = null

        if (this.get('stream_local')) {
            this.tracks_added = new Promise((resolve, reject) => {
                this.get('stream_local').stream.then((stream) => {
                    console.log('add stream', stream);
                    //this.pc.addStream(stream) (this crashes/hangs chrome)
                    // so we use the addTrack api
                    stream.getTracks().forEach((track) => {
                        this.pc.addTrack(track, stream);
                    });
                    resolve();
                }); // TODO: catch/reject?
            });
        } else {
            console.log('no stream');
            this.tracks_added = Promise.resolve();
        }
        this.tracks_added.then(() => console.log('tracks added'));
        this.pc.onicecandidate = (event) => {
            console.log(this.room_id, 'onicecandidate', event.candidate);
            this.event_candidate = event;
            this.send_ice_candidate(event.candidate);
        };
        this.pc.onopen = () => {
            console.log('onopen', name);
        };
        this.pc.onaddstream = (evt) => {
            console.log('onaddstream', name);
            this.widget_manager.new_widget({
                    model_name: 'MediaStreamModel',
                    model_module: 'jupyter-webrtc',
                    model_module_version: semver_range,
                    view_name: 'MediaStreamView',
                    view_module: 'jupyter-webrtc',
                    view_module_version: semver_range,
                    widget_class: 'webrtc.MediaStreamModel', // ipywidgets6
                }).then((model) => {
                    model.captureStream = (() => {
                        return new Promise((resolve, reject) => {
                            resolve(evt.stream);
                        });
                    }); // TODO: not nice to just set the method...
                    this.set('stream_remote', model);
                    //mo
                    this.save_changes();
                    console.log(this.room_id, ': added stream_remote');
                    return model;
                });
        };
        this.pc.onconnecting = () => {
            console.log('onconnecting', name);
        };
        this.pc.oniceconnectionstatechange = () => {
            console.log(this.room_id, 'ICE connection state', this.pc.iceConnectionState);
            if (this.pc.iceConnectionState === 'disconnected') {
                this.set('connected', false);
                this.save_changes();
            }
            if (this.pc.iceConnectionState === 'connected') {
                this.set('connected', true);
                this.save_changes();
            }
            // TODO: can we recover from this?
            if (this.pc.iceConnectionState === 'failed') {
                this.set('connected', false);
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
        this.on('msg:custom', this.custom_msg, this);
        //this.disconnect = _.once(this.disconnect, this));
        window.addEventListener('beforeunload', () => {
            this.close();
        });
    }
    custom_msg(content) {
        console.log('custom msg', content);
        if (content.msg === 'connect') {
            this.connect();
        } else if (content.msg === 'close') {
            this.close();
        } else {
            this.disconnect();
        }
    }
    close() {
        //console.log('disconnect')
        this.pc.close(); // does not trigger ice conncection status changes
        this.set('connected', false);
        this.save_changes();
    }
    join() {
        this.initiator = true;
        return this.tracks_added.then(() => {
            return new Promise((resolve, reject) => {
                const room_id = this.get('room_id');
                const offer = {
                  offerToReceiveAudio: 1,
                  offerToReceiveVideo: 1,
                };

                this.pc.createOffer(offer).then((sdp) => {
                    console.log('set local desc');
                    this.pc.setLocalDescription(sdp);
                    console.log(room_id, 'send sdp');
                    this.send_sdp(sdp);
                    resolve();
                }) .catch(e => {
                    console.error(e);
                    reject(e);
                });
                return this;
            });
        });
    }
    send_sdp(sdp) {
        this.broadcast({sdp: sdp});
    }
    send_ice_candidate(candidate) {
        this.broadcast({candidate: candidate});
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
        const el = document.createElement('video');
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
