import * as widgets from '@jupyter-widgets/base';
import * as _  from 'underscore';
require('webrtc-adapter');
import * as html2canvas from 'html2canvas';
import * as mqtt from 'mqtt';
import * as utils from './utils';
var semver_range = '~' + require('../package.json').version;

var MediaStreamModel = widgets.DOMWidgetModel.extend({
    defaults: function() {
        return _.extend(widgets.DOMWidgetModel.prototype.defaults(), {
            _model_module: 'jupyter-webrtc',
            _view_module: 'jupyter-webrtc',
            _model_name: 'MediaStreamModel',
            _view_name: 'MediaStreamView',
            _model_module_version: semver_range,
            _view_module_version: semver_range,
        });
    },
});

// Backward compatibility
Object.defineProperty(MediaStreamModel.prototype, 'stream', {
    get: function() { return this.captureStream(); }
});

var captureStream = function(widget) {
    if(widget.captureStream)
        return widget.captureStream()
    else
        return widget.stream
}

var MediaStreamView = widgets.DOMWidgetView.extend({
    render: function() {
        MediaStreamView.__super__.render.apply(this, arguments);
        window.last_media_stream_view = this;
        this.video = document.createElement('video');
        this.video.controls = true;
        this.pWidget.addClass('jupyter-widgets');
        this.pWidget.addClass('widget-image');

        this.model.captureStream().then((stream) => {
            this.video.srcObject = stream;
            this.el.appendChild(this.video);
            this.video.play();
        }, (error) => {
            var text = document.createElement('div');
            text.innerHTML = 'Error creating view for mediastream: ' + error.message;
            this.el.appendChild(text);
        });
    },

    remove: function() {
        this.model.captureStream().then((stream) => {
            this.video.pause();
            this.video.srcObject = null;
        });
        return MediaStreamView.__super__.remove.apply(this, arguments);
    }
});

import {imageWidgetToCanvas} from './utils';

var ImageStreamModel = MediaStreamModel.extend({
    defaults: function() {
        return _.extend(MediaStreamModel.prototype.defaults(), {
            _model_name: 'ImageStreamModel',
            image: null
        });
    },

    initialize: function() {
      ImageStreamModel.__super__.initialize.apply(this, arguments);
        window.last_image_stream = this;
        this.canvas = document.createElement('canvas');
        this.context = this.canvas.getContext('2d');

        this.canvas.width = this.get('width');
        this.canvas.height = this.get('height')
        // I was hoping this should do it
        imageWidgetToCanvas(this.get('image'), this.canvas)
    },

    captureStream: function() {
        return new Promise((resolve, reject) => {
            // not sure if firefox uses moz prefix also on a canvas
            if(this.canvas.captureStream) {
                // TODO: add a fps trait
                resolve(this.canvas.captureStream())
                // but for some reason we need to do it again
                imageWidgetToCanvas(this.get('image'), this.canvas)
            } else {
                reject(new Error('captureStream not supported for this browser'));
            }
        });
    },

    close: function() {
        var returnValue = ImageStreamModel.__super__.close.apply(this, arguments);
        return returnValue;
    }
}, {
    serializers: _.extend({
        image: { deserialize: widgets.unpack_models },
    }, MediaStreamModel.serializers)
});

var StreamModel = MediaStreamModel.extend({
    defaults: function() {
        return _.extend(MediaStreamModel.prototype.defaults(), {
            playing: true,
            currentTime: 0.0,
            duration: 0.0,
        });
    },

    initialize: function() {
        StreamModel.__super__.initialize.apply(this, arguments);

        this.media = undefined;

        this.on('change:playing', this.updatePlay, this);
        this.on('change:currentTime', this.updateCurrentTime, this);
    },

    captureStream: async function() {
        if (!this.createView) {
            this.createView = _.once(() => {
                return this.widget_manager.create_view(this.get(this.type)).then((view) => {
                    this.media_wid = view;
                    this.media = this.media_wid.el;
                    this.media.addEventListener('durationchange', () => {
                        this.set('duration', this.media.duration);
                        this.save_changes();
                    });
                    this.media.addEventListener('timeupdate', () => {
                        this.set('currentTime', this.media.currentTime);
                        this.save_changes();
                    });
                });
            });
        }
        let widget = this.get(this.type);
        if(!widget)
            throw new Error('no media widget passed')
        await this.createView();
        if(this.media.captureStream || this.media.mozCaptureStream) {
            // following https://github.com/webrtc/samples/blob/gh-pages/src/content/capture/video-pc/js/main.js
            var makeStream = () => {
                this.updatePlay();

                if(this.media.captureStream) {
                    return this.media.captureStream();
                } else if(this.media.mozCaptureStream) {
                    return this.media.mozCaptureStream();
                }
            };
            await utils.onCanPlay(this.media);
            return makeStream()
        } else {
            throw  new Error('captureStream not supported for this browser');
        }
    },

    updatePlay: function() {
        if(this.get('playing')) {
            this.media.play();
        } else {
            this.media.pause();
        }
    },

    updateCurrentTime: function() {
        let currentTime = this.get('currentTime');
        if (this.media.currentTime != currentTime)
        {
            this.media.currentTime = currentTime;
        }
    },

    close: function() {
        var returnValue = StreamModel.__super__.close.apply(this, arguments);
        this.media.pause();
        this.media_wid.close();
        return returnValue;
    }
});

var VideoStreamModel = StreamModel.extend({
    defaults: function() {
        return _.extend(StreamModel.prototype.defaults(), {
            _model_name: 'VideoStreamModel',
            video: null,
        });
    },

    initialize: function() {
        VideoStreamModel.__super__.initialize.apply(this, arguments);
        window.last_video_stream = this;

        this.type = 'video';
    },
}, {
    serializers: _.extend({
        video: { deserialize: widgets.unpack_models },
    }, StreamModel.serializers)
});

var AudioStreamModel = StreamModel.extend({
    defaults: function() {
        return _.extend(StreamModel.prototype.defaults(), {
            _model_name: 'AudioStreamModel',
            _view_name: 'AudioStreamView',
            audio: undefined,
        });
    },

    initialize: function() {
        AudioStreamModel.__super__.initialize.apply(this, arguments);
        window.last_audio_stream = this;

        this.type = 'audio';
    },
}, {
    serializers: _.extend({
        audio: { deserialize: widgets.unpack_models },
    }, StreamModel.serializers)
});

var AudioStreamView = widgets.DOMWidgetView.extend({
    render: function() {
        AudioStreamView.__super__.render.apply(this, arguments);
        window.last_audio_stream_view = this;
        this.audio = document.createElement('audio');
        this.audio.controls = true;
        this.pWidget.addClass('jupyter-widgets');

        this.model.captureStream().then((stream) => {
            this.audio.srcObject = stream;
            this.el.appendChild(this.audio);
            this.audio.play();
        }, (error) => {
            var text = document.createElement('div');
            text.innerHTML = 'Error creating view for mediastream: ' + error.message;
            this.el.appendChild(text);
        });
    },

    remove: function() {
        this.model.captureStream().then((stream) => {
            this.audio.pause();
            this.audio.srcObject = null;
        });
        return widgets.DOMWidgetView.__super__.remove.apply(this, arguments);
    }
});

var WidgetStreamModel = MediaStreamModel.extend({
    defaults: function() {
        return _.extend(MediaStreamModel.prototype.defaults(), {
            _model_name: 'WidgetStreamModel',
            _view_name: 'WidgetStreamView',
            widget: null,
            max_fps: null,
            _html2canvas_start_streaming: false,
        })
    },

    initialize: function() {
        WidgetStreamModel.__super__.initialize.apply(this, arguments);

        this.on('change:_html2canvas_start_streaming', this.updateHTML2CanvasStreaming, this);
        this.rendered_view = null;

        // If the widget already has a captureStream -> use it
        if (typeof this.get('widget').captureStream == 'function') {
            // TODO: use the fps attr of captureStream once it's here
            this.captureStream = () => {
                return this.get('widget').captureStream();
            };
        }
        // Else try to stream the first view of this widget
        else {
            this.captureStream = () => {
                var id_views = Object.keys(this.get('widget').views);
                if (id_views.length == 0) {
                    return new Promise((resolve, reject) => {
                        reject({'message': 'Cannot create WidgetStream if the widget has no view rendered'});
                    });
                }

                var first_view = this.get('widget').views[id_views[0]];
                return first_view.then((view) => {
                    this.rendered_view = view;

                    // If the widget view is a canvas or a video element
                    var capturable_obj = this.find_capturable_obj(this.rendered_view.el);
                    if (capturable_obj) {
                        // TODO: use the fps attr of captureStream once it's here
                        return this._captureStream(capturable_obj);
                    }

                    // Else use html2canvas
                    this.canvas = document.createElement('canvas');
                    this.set('_html2canvas_start_streaming', true);
                    // TODO: use the fps attr of captureStream once it's here
                    return this._captureStream(this.canvas);
                });
            };
        }
    },

    _captureStream: function(capturable_obj) {
        return new Promise((resolve, reject) => {
            var fps = this.get('max_fps');

            if (capturable_obj.captureStream) {
                if (fps || fps == 0) {
                    resolve(capturable_obj.captureStream(fps));
                } else {
                    resolve(capturable_obj.captureStream());
                }
            }

            if (capturable_obj.mozCaptureStream) {
                if (fps || fps == 0) {
                    resolve(capturable_obj.mozCaptureStream(fps));
                } else {
                    resolve(capturable_obj.mozCaptureStream());
                }
            }

            reject(new Error('captureStream not supported for this browser'));
        });
    },

    find_capturable_obj: function(element) {
        var nb_children = element.children.length;
        for (var child_idx = 0; child_idx < nb_children; child_idx++) {
            var child = element.children[child_idx];
            if (child.captureStream || child.mozCaptureStream) {
                return child;
            }

            var capturable_obj = this.find_capturable_obj(child);
            if (capturable_obj) {
                return capturable_obj;
            }
        }
    },

    updateHTML2CanvasStreaming: function() {
        if (this.get('_html2canvas_start_streaming') && !this.html2CanvasStreaming) {
            this.html2CanvasStreaming = true;

            var lastTime;
            var updateStream = (currentTime) => {
                if (!this._closed) {
                    if (!lastTime) {
                        lastTime = currentTime;
                    }
                    var timeSinceLastFrame = currentTime - lastTime;
                    lastTime = currentTime;

                    var fps = this.get('max_fps');
                    if (fps == 0) {
                        /* TODO: maybe implement the same behavior as here:
                        https://developer.mozilla.org/en-US/docs/Web/API/HTMLCanvasElement/captureStream */
                    } else {
                        var waitingTime = 0;
                        if (fps != null) {
                            waitingTime = 1000/fps - timeSinceLastFrame;
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
}, {
serializers: _.extend({
    widget: { deserialize: widgets.unpack_models },
    }, MediaStreamModel.serializers)
});

var WidgetStreamView = MediaStreamView.extend({
});

var CameraStreamModel = MediaStreamModel.extend({
    defaults: function() {
        return _.extend(MediaStreamModel.prototype.defaults(), {
            _model_name: 'CameraStreamModel',
            constraints: {audio: true, video: true}
        });
    },

    captureStream: function() {
        if(!this.cameraStream) {
            this.cameraStream = navigator.mediaDevices.getUserMedia(this.get('constraints'));
        }
        return this.cameraStream;
    },

    close: function() {
        if(this.cameraStream) {
            this.cameraStream.then((stream) => {
                stream.getTracks().forEach((track) => {
                    track.stop();
                });
            });
        }
        return CameraStreamModel.__super__.close.apply(this, arguments);
    }
});


var RecorderModel = widgets.DOMWidgetModel.extend({
    defaults: function() {
        return _.extend(widgets.DOMWidgetModel.prototype.defaults(), {
            _model_module: 'jupyter-webrtc',
            _view_module: 'jupyter-webrtc',
            _model_module_version: semver_range,
            _view_module_version: semver_range,
            stream: null,
            filename: 'record',
            format: 'webm',
            recording: false,
            _data_src: '',
         })
    },

    initialize: function() {
        RecorderModel.__super__.initialize.apply(this, arguments);

        this.on('msg:custom', _.bind(this.handleCustomMessage, this));
        this.on('change:recording', this.updateRecord);

        this.mediaRecorder = null;
        this.chunks = [];
    },

    handleCustomMessage: function(content) {
        if(content.msg == 'download') {
            this.download();
        }
    },

    updateRecord: function() {
        var source = this.get('stream');
        if(!source) {
            new Error('No stream specified');
            return;
        }

        var mimeType = this.type + '/' + this.get('format');
        if (!MediaRecorder.isTypeSupported(mimeType)) {
            new Error('The mimeType', mimeType, 'is not supported for record on this browser');
            return;
        }

        if(this.get('recording')) {
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
            this.mediaRecorder.onstop = (e) => {
                if (this.get('_data_src') != '') {
                    URL.revokeObjectURL(this.get('_data_src'));
                }
                var blob = new Blob(this.chunks, { 'type' : mimeType });
                this.set('_data_src', window.URL.createObjectURL(blob));
                this.save_changes();

                var reader = new FileReader();
                reader.readAsArrayBuffer(blob);
                reader.onloadend = () => {
                    var bytes = new Uint8Array(reader.result);
                    this.get(this.type).set('value', new DataView(bytes.buffer));
                    this.get(this.type).save_changes();
                }
            }
            this.mediaRecorder.stop();
        }
    },

    download: function() {
        if (this.chunks.length == 0) {
            new Error('Nothing to download');
            return;
        }
        let blob = new Blob(this.chunks, {type: this.type + '/' + this.get('format')});
        let filename = this.get('filename');
        if (filename.indexOf('.') < 0) {
          filename = this.get('filename') + '.' + this.get('format');
        }
        utils.downloadBlob(blob, filename);
    },

    close: function() {
        if (this.get('_data_src') != '') {
            URL.revokeObjectURL(this.get('_data_src'));
        }
        return RecorderModel.__super__.close.apply(this, arguments);
    }
}, {
    serializers: _.extend({
        stream: { deserialize: widgets.unpack_models },
    }, widgets.DOMWidgetModel.serializers)
});

var RecorderView = widgets.DOMWidgetView.extend({
    render: function() {
        RecorderView.__super__.render.apply(this, arguments);

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

        var recordIcon = document.createElement('i');
        recordIcon.className = this.recordIconClass;
        this.recordButton.appendChild(recordIcon);
        var downloadIcon = document.createElement('i');
        downloadIcon.className = 'fa fa-download';
        this.downloadButton.appendChild(downloadIcon);

        this.recordButton.onclick = () => {
            this.model.set('recording', !this.model.get('recording'));
        };
        this.downloadButton.onclick = this.model.download.bind(this.model);

        this.listenTo(this.model, 'change:recording', () => {
            if(this.model.get('recording')) {
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
    },
});

var ImageRecorderModel = RecorderModel.extend({
    defaults: function() {
        return _.extend(RecorderModel.prototype.defaults(), {
            _model_name: 'ImageRecorderModel',
            _view_name: 'ImageRecorderView',
            image: null,
            _height: '',
            _width: '',
         })
    },

    initialize: function() {
        ImageRecorderModel.__super__.initialize.apply(this, arguments);
        window.last_image_recorder = this;

        this.type = 'image';
    },

    snapshot: async function() {
        var mimeType = this.type + '/' + this.get('format');
        var mediaStream = await captureStream(this.get('stream'));
        // turn the mediastream into a video element
        let video = document.createElement('video');
        video.srcObject = mediaStream;
        video.play()
        await utils.onCanPlay(video);
        // and the video element can be drawn onto a canvas
        let canvas = document.createElement('canvas')
        let context = canvas.getContext('2d');
        let height = video.videoHeight;
        let width = video.videoWidth;
        canvas.height = height;
        canvas.width = width;
        context.drawImage(video, 0, 0, canvas.width, canvas.height);

        // from the canvas we can get the underlying encoded data
        // TODO: check support for toBlob, or find a polyfill
        var blob = await utils.canvasToBlob(canvas, mimeType);
        this.set('_data_src', window.URL.createObjectURL(blob));
        this._last_blob = blob;

        var bytes = await utils.blobToBytes(blob);

        this.get(this.type).set('value', new DataView(bytes.buffer));
        this.get(this.type).save_changes();
        this.set('_height', height.toString() + 'px');
        this.set('_width', width.toString() + 'px');
        this.set('recording', false);
        this.save_changes();
    },

    updateRecord: function() {
        var source = this.get('stream');
        if(!source) {
            new Error('No stream specified');
            return;
        }

        if (this.get('_data_src') != '') {
            URL.revokeObjectURL(this.get('_data_src'));
        }
        if(this.get('recording'))
            this.snapshot()
    },

    download: function() {
        let filename = this.get('filename');
        let format = this.get('format');
        if (filename.indexOf('.') < 0) {
          filename = this.get('filename') + '.' + format;
        }
        utils.downloadBlob(this._last_blob, filename);
    },
}, {
    serializers: _.extend({
        image: { deserialize: widgets.unpack_models },
    }, RecorderModel.serializers)
});

var ImageRecorderView = RecorderView.extend({
    initialize: function() {
        ImageRecorderView.__super__.initialize.apply(this, arguments);
        this.tag = 'img';
        this.recordIconClass = 'fa fa-camera';
    },
});

var VideoRecorderModel = RecorderModel.extend({
    defaults: function() {
        return _.extend(RecorderModel.prototype.defaults(), {
            _model_name: 'VideoRecorderModel',
            _view_name: 'VideoRecorderView',
            video: null,
         })
    },

    initialize: function() {
        VideoRecorderModel.__super__.initialize.apply(this, arguments);
        window.last_video_recorder = this;

        this.type = 'video';
    },
}, {
    serializers: _.extend({
        video: { deserialize: widgets.unpack_models },
    }, RecorderModel.serializers)
});

var VideoRecorderView = RecorderView.extend({
    initialize: function() {
        VideoRecorderView.__super__.initialize.apply(this, arguments);
        this.tag = 'video';
        this.recordIconClass = 'fa fa-circle';
    },
});

var AudioRecorderModel = RecorderModel.extend({
    defaults: function() {
        return _.extend(RecorderModel.prototype.defaults(), {
            _model_name: 'AudioRecorderModel',
            _view_name: 'AudioRecorderView',
            audio: null,
         })
    },

    initialize: function() {
        AudioRecorderModel.__super__.initialize.apply(this, arguments);
        window.last_audio_recorder = this;

        this.type = 'audio';
    },
}, {
    serializers: _.extend({
        audio: { deserialize: widgets.unpack_models },
    }, RecorderModel.serializers)
});

var AudioRecorderView = RecorderView.extend({
    initialize: function() {
        AudioRecorderView.__super__.initialize.apply(this, arguments);
        this.tag = 'audio';
        this.recordIconClass = 'fa fa-circle';
    },
});

var WebRTCRoomModel = widgets.DOMWidgetModel.extend({
    defaults: function() {
        return _.extend(widgets.DOMWidgetModel.prototype.defaults(), {
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
        })
    },
    log: function() {
        var args = [this.get('nickname') + ' ' +this.get('room_id') +': ']
        args = args.concat(Array.prototype.slice.call(arguments))
        console.log.apply(null, args);
    },
    initialize: function() {
        WebRTCRoomModel.__super__.initialize.apply(this, arguments);
        this.set('room_id',  widgets.uuid())
        this.room_id = this.get('room_id')
        this.room = this.get('room')
        this.peers = {} // room_id (string) to WebRTCPeerModel
        window['last_webrtc_room_' + this.room_id] = this
        var stream = this.get('stream')
        if(stream) {
            this.set('streams', [stream])
        }
        this.save_changes()
        this.on('msg:custom', _.bind(this.custom_msg, this));
    },
    custom_msg: function(content) {
        if(content.msg == 'close') {
            this.close()
        }
    },
    close: function() {
        this.get('peers').forEach((peer) => peer.close())
    },
    create_peer: function(from_id) {
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
                id_remote: from_id
        }).then(_.bind(function(peer) {
            peer.peer_msg_send = _.bind(function(msg) {
                msg.room_id = this.get('room_id')
                msg.to = from_id
                this.log('send to peer', msg)
                //console.log('sending to room', msg, from_id)
                peer.save_changes()
                this.room_msg_send(msg)
            }, this)
            return peer
        }, this))
    },
    listen_to_remote_stream: function(peer) {
        peer.on('change:stream_remote', _.once(_.bind(function(){
            this.log('add remote stream')
            var streams = this.get('streams').slice()
            var stream = peer.get('stream_remote')
            streams.push(stream)
            this.set('streams', streams)
            this.save_changes()
        }, this)))
        peer.on('change:connected', _.bind(function() {
            var connected = peer.get('connected')
            this.log('changed connected status for ', peer.get('id_remote'), 'to', connected)
            if(!connected) {
                var streams = this.get('streams').slice()
                var stream = peer.get('stream_remote')
                streams = _.without(streams, stream)
                this.set('streams', streams)

                var peers = this.get('peers').slice()
                peers = _.without(peers, peer)
                this.set('peers', peers)

                delete this.peers[peer.get('id_remote')]
                this.save_changes()
            }
        }, this))
    },
    on_room_msg: function(msg) {
        var from_id = msg.room_id;
        if(msg.room_id == this.room_id)
            return; // skip my own msg'es
        if(msg.type == 'join') {
            this.log('join from', msg.room_id)
            this.peers[from_id] = this.create_peer(from_id).then(_.bind(function(peer) {
                this.listen_to_remote_stream(peer)
                peer.join().then(_.bind(function() {
                    var peers = this.get('peers').slice()
                    peers.push(peer)
                    this.set('peers', peers)
                    this.save_changes()
                }, this))
                return peer
            }, this))
            this.log(': added peer', from_id)
            return peer;
        } else if(msg.room_id) {
            if(msg.to != this.room_id) {
                return
            }
            if(!this.peers[msg.room_id]) {
                this.peers[from_id] = this.create_peer(from_id).then(_.bind(function(peer) {
                    this.listen_to_remote_stream(peer)
                    var peers = this.get('peers').slice()
                    peers.push(peer)
                    this.set('peers', peers)
                    this.save_changes()
                    return peer
                }, this))
                this.log('added peer', from_id)
            }
            var peer = this.peers[msg.room_id]
            if(peer) {
                //console.log(this.room_id, ': peer', msg.room_id, peer, this, this.cid)
                peer.then(_.bind(function(peer) {
                    this.log('sending from', msg.room_id, ' to', msg.to, msg)
                    peer.on_peer_msg(msg)
                }, this))
            } else {
                console.error('sending to unknown peer', msg.room_id)
            }
        } else {
            console.error('expected a to room_id to be present')
        }
    }
}, {
serializers: _.extend({
    stream: { deserialize: widgets.unpack_models },
    peers: { deserialize: widgets.unpack_models },
    }, widgets.DOMWidgetModel.serializers)
});

var global_rooms = {}

var WebRTCRoomLocalModel = WebRTCRoomModel.extend({
    defaults: function() {
        return _.extend(WebRTCRoomModel.prototype.defaults(), {
            _model_name: 'WebRTCRoomLocalModel',
        })
    },
    initialize: function() {
        WebRTCRoomLocalModel.__super__.initialize.apply(this, arguments);
        this.join()
    },
    join: function() {
        var room = this.get('room');
        console.log('joining room', room)
        var callbacks = global_rooms[room] || []
        callbacks.push(_.bind(this.on_room_msg, this))
        global_rooms[room] = callbacks
        this.room_msg_send({type: 'join', room_id: this.get('room_id')})

    },
    room_msg_send: function(msg) {
        var room = this.get('room');
        console.log('send to room', room, msg, global_rooms[room])
        _.each(global_rooms[room], function(callback) {
            callback(msg)
        })

    },
});

var WebRTCRoomMqttModel = WebRTCRoomModel.extend({
    defaults: function() {
        return _.extend(WebRTCRoomModel.prototype.defaults(), {
            _model_name: 'WebRTCRoomMqttModel',
            server: 'wss://iot.eclipse.org:443/ws'
        })
    },
    initialize: function() {
        WebRTCRoomMqttModel.__super__.initialize.apply(this, arguments);
        console.log('connecting to', this.get('server'))
        this.mqtt_client = mqtt.connect(this.get('server'))
        var client = this.mqtt_client
        this.topic_join = 'jupyter-webrtc/' + this.get('room') +'/join'
        //this.topic_present = 'jupyter-webrtc/' +this.room +'/present'
        this.mqtt_client.on('connect', _.bind(function () {
          client.subscribe(this.topic_join)
          //client.subscribe(this.topic_present)
          //client.publish('jupyter-webrtc/room-a/present', 'you|me', {retain:true})
          //client.publish('jupyter-webrtc/room-a/join', 'Hello mqtt')
        }, this))
        client.on('message', _.bind(function (topic, message) {
            var msg = JSON.parse(message)
            console.log('msg received', message, msg)
            if(topic == this.topic_join) {
                this.on_room_msg(msg)
            }
        }, this))
        this.join()
    },
    join: function() {
        this.room_msg_send({type: 'join', room_id: this.get('room_id')})

    },
    room_msg_send: function(msg) {
        var text = JSON.stringify(msg)
        console.log('send to mqtt channel', msg)
        this.mqtt_client.publish(this.topic_join, text)
    }
});

var WebRTCPeerModel = widgets.DOMWidgetModel.extend({
    defaults: function() {
        return _.extend(widgets.DOMWidgetModel.prototype.defaults(), {
            _model_name: 'WebRTCPeerModel',
            _view_name: 'WebRTCPeerView',
            _model_module: 'jupyter-webrtc',
            _view_module: 'jupyter-webrtc',
            _model_module_version: semver_range,
            _view_module_version: semver_range
        })
    },
    log: function() {
        var args = [this.get('room_id') +': ']
        args = args.concat(Array.prototype.slice.call(arguments))
        console.log.apply(null, args);
    },
    on_peer_msg: function(msg) {
        var info = msg;
        var that = this;
        this.log('peer msg', info)
        if(info.sdp) {
            // the other party send us the sdp
            this.log(name, 'got sdp')
            var sdp_remote = new RTCSessionDescription(info.sdp)
            var remote_description_set = this.pc.setRemoteDescription(sdp_remote)
            if(!this.initiator) {
                console.log(this.get('id_local'), 'did not initiate, reply with answer')
                // if we didn't initiate, we should respond with an answer
                // now we create an answer, and send a sdp back
                Promise.all([remote_description_set, this.tracks_added])
                .then(() => this.pc.createAnswer())
                .then((sdp) => {
                    console.log('sending sdp', this.room_id)
                    that.send_sdp(sdp)
                    that.pc.setLocalDescription(sdp)
                })
            }
        } else if (info.candidate) {
            var c = new RTCIceCandidate(info.candidate);
            this.pc.addIceCandidate(c)
        }
    },
    initialize: function() {
        WebRTCPeerModel.__super__.initialize.apply(this, arguments);

        var that = this;
        var room_id = this.room_id = this.get('id_local')
        this.initiator = false

        var pc_config = {"iceServers": [{"urls": ["stun:stun.l.google.com:19302", 'stun:stun1.l.google.com:19302', 'stun:stun2.l.google.com:19302']}]};
        //var pc_config = null;
        this.pc = new RTCPeerConnection(pc_config);

        window['last_webrtc_'+room_id] = this
        //this.other = null

        if(this.get('stream_local')) {
            this.tracks_added = new Promise((resolve, reject) => {
                that.get('stream_local').stream.then((stream) => {
                    console.log('add stream', stream)
                    //this.pc.addStream(stream) (this crashes/hangs chrome)
                    // so we use the addTrack api
                    stream.getTracks().forEach(
                        function(track) {
                          that.pc.addTrack(
                            track,
                            stream
                          );
                        }
                    );
                    resolve()
                }) // TODO: catch/reject?
            })
        } else {
            console.log('no stream')
            this.tracks_added = Promise.resolve()
        }
        this.tracks_added.then(() => console.log('tracks added'))
        this.pc.onicecandidate = _.bind(function(event) {
            console.log(this.room_id, 'onicecandidate', event.candidate)
            this.event_candidate = event
            this.send_ice_candidate(event.candidate)
        }, this)
        this.pc.onopen = _.bind(function() {
            console.log('onopen', name)
        }, this)
        this.pc.onaddstream = _.bind(function(evt) {
            console.log('onaddstream', name)
            this.widget_manager.new_widget({
                    model_name: 'MediaStreamModel',
                    model_module: 'jupyter-webrtc',
                    model_module_version: semver_range,
                    view_name: 'MediaStreamView',
                    view_module: 'jupyter-webrtc',
                    view_module_version: semver_range,
                    widget_class: 'webrtc.MediaStreamModel', // ipywidgets6
                }).then(function(model) {
                    model.captureStream = (() => {
                        return new Promise((resolve, reject) => {
                            resolve(evt.stream);
                        });
                    });// TODO: not nice to just set the method...
                    that.set('stream_remote', model)
                    //mo
                    that.save_changes()
                    console.log(that.room_id, ': added stream_remote')
                    return model;
                });
        }, this)
        this.pc.onconnecting = _.bind(function() {
            console.log('onconnecting', name)
        }, this)
        this.pc.oniceconnectionstatechange = _.bind(function() {
            console.log(this.room_id, 'ICE connection state', this.pc.iceConnectionState);
            if(this.pc.iceConnectionState == 'disconnected') {
                this.set('connected', false)
                this.save_changes()
            }
            if(this.pc.iceConnectionState == 'connected') {
                this.set('connected', true)
                this.save_changes()
            }
            // TODO: can we recover from this?
            if(this.pc.iceConnectionState == 'failed') {
                this.set('connected', false)
                this.save_changes()
            }
        }, this)
        /*
        this doesn't seem to exist in chrome at least, lets rely on ice state change above
        this.pc.onconnectionstatechange = _.bind(function() {
            console.log(this.room_id, 'connection state', this.pc.connectionState);
            if(this.pc.connectionState == 'disconnected') {
                this.set('connected', false)
                this.save_changes()
            }
            if(this.pc.connectionState == 'connected') {
                this.set('connected', true)
                this.save_changes()
            }
        }, this)
        */
        this.on('msg:custom', _.bind(this.custom_msg, this));
        //this.disconnect = _.once(_.bind(this.disconnect, this))
        window.addEventListener('beforeunload', function () {
            that.close()
        }, false);
    },
    custom_msg: function(content) {
        console.log('custom msg', content)
        if(content.msg == 'connect') {
            this.connect()
        } else if(content.msg == 'close') {
            this.close()
        } else {
            this.disconnect()
        }
    },
    close: function() {
        //console.log('disconnect')
        this.pc.close() // does not trigger ice conncection status changes
        this.set('connected', false)
        this.save_changes()
    },
    join: function() {
        this.initiator = true
        var that = this;
        var after_stream
        return this.tracks_added.then(() => {
            return new Promise((resolve, reject) => {
                var room_id = that.get('room_id')
                var offer = {
                  offerToReceiveAudio: 1,
                  offerToReceiveVideo: 1
                };

                this.pc.createOffer(offer)
                .then((sdp)  => {
                    console.log('set local desc');
                    that.pc.setLocalDescription(sdp)
                    console.log(that.room_id, 'send sdp')
                    that.send_sdp(sdp)
                    resolve()
                })
                .catch(e => {
                    console.error(e)
                    reject(e)
                });
                return that
            })
        })
    },
    send_sdp: function(sdp) {
        this.broadcast({sdp:sdp})
    },
    send_ice_candidate: function(candidate) {
        this.broadcast({candidate:candidate})
    },
    broadcast: function(msg) {
        this.peer_msg_send(msg)

    },
}, {
serializers: _.extend({
    stream: { deserialize: widgets.unpack_models },
    peers: { deserialize: widgets.unpack_models },
    }, widgets.DOMWidgetModel.serializers)
});

var WebRTCPeerView = widgets.DOMWidgetView.extend({

    initialize: function() {
        var el = document.createElement('video')
        window.last_media_view = this;
        this.setElement(el);
        WebRTCPeerView.__super__.initialize.apply(this, arguments);
    },

    render: function() {
        var that = this;
        that.model.stream.then(function(stream) {
            that.el.srcObject = stream;
            that.el.play()
        })
    }

});

module.exports = {
    MediaStreamModel: MediaStreamModel,
    MediaStreamView: MediaStreamView,
    WidgetStreamModel: WidgetStreamModel,
    WidgetStreamView: WidgetStreamView,
    ImageStreamModel: ImageStreamModel,
    VideoStreamModel: VideoStreamModel,
    AudioStreamModel: AudioStreamModel,
    AudioStreamView: AudioStreamView,
    CameraStreamModel: CameraStreamModel,
    ImageRecorderModel: ImageRecorderModel,
    ImageRecorderView: ImageRecorderView,
    VideoRecorderModel: VideoRecorderModel,
    VideoRecorderView: VideoRecorderView,
    AudioRecorderModel: AudioRecorderModel,
    AudioRecorderView: AudioRecorderView,
    WebRTCPeerModel: WebRTCPeerModel,
    WebRTCPeerView: WebRTCPeerView,
    WebRTCRoomModel: WebRTCRoomModel,
    WebRTCRoomLocalModel: WebRTCRoomLocalModel,
    WebRTCRoomMqttModel: WebRTCRoomMqttModel,
}
