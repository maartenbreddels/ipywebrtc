widgets = require('@jupyter-widgets/base');
_ = require("underscore");
require('webrtc-adapter');
mqtt = require('mqtt');
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

var MediaStreamView = widgets.DOMWidgetView.extend({
    render: function() {
        MediaStreamView.__super__.render.apply(this, arguments);
        window.last_media_stream_view = this;
        this.video = document.createElement('video');
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
        })
    },

    remove: function() {
        this.model.captureStream().then((stream) => {
            this.video.srcObject = null;
        });
        return MediaStreamView.__super__.remove.apply(this, arguments);
    }
});

var VideoStreamModel = MediaStreamModel.extend({
    defaults: function() {
        return _.extend(MediaStreamModel.prototype.defaults(), {
            _model_name: 'VideoStreamModel',
            url: 'https://webrtc.github.io/samples/src/video/chrome.mp4',
            format: 'mp4',
            value: null,
            play: true,
            loop: true,
        });
    },

    initialize: function() {
        VideoStreamModel.__super__.initialize.apply(this, arguments);
        window.last_video_stream = this;
        this.video = document.createElement('video');
        this.source = document.createElement('source');

        var format = this.get('format');
        var value = this.get('value');
        if(format != 'url') {
            var mimeType = 'video/${format}';
            this.video.src = window.URL.createObjectURL(new Blob([value], {type: mimeType}));
        } else {
            var url = String.fromCharCode.apply(null, new Uint8Array(value.buffer));
            this.source.setAttribute('src', url);
            this.video.appendChild(this.source);
        }

        this.on('change:play', this.updatePlay, this)
        this.on('change:loop', this.updateLoop, this)
    },

    captureStream: function() {
        return new Promise((resolve, reject) => {
            if(this.video.captureStream || this.video.mozCaptureStream) {
                // following https://github.com/webrtc/samples/blob/gh-pages/src/content/capture/video-pc/js/main.js
                var makeStream = _.once(_.bind(function() {
                    if(this.video.captureStream) {
                        resolve(this.video.captureStream());
                    } else if(this.video.mozCaptureStream) {
                        resolve(this.video.mozCaptureStream());
                    }
                }, this));
                // see https://github.com/webrtc/samples/pull/853
                this.video.oncanplay = makeStream;
                if(this.video.readyState >= 3) {
                    makeStream();
                }

                this.updatePlay();
                this.updateLoop();
            } else {
                reject(new Error('captureStream not supported for this browser'));
            }
        });
    },

    updatePlay: function() {
        if(this.get('play')) {
            this.video.play();
        } else {
            this.video.pause();
        }
    },

    updateLoop: function() {
        this.video.loop = this.get('loop');
    },

    close: function() {
        var returnValue = VideoStreamModel.__super__.close.apply(this, arguments);
        this.video.pause();
        if (this.video.src && this.video.src.startsWith('blob:')) {
            URL.revokeObjectURL(this.video.src);
        }
        this.video.src = '';
        return returnValue;
    }
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

var MediaRecorderModel = widgets.DOMWidgetModel.extend({
    defaults: function() {
        return _.extend(widgets.DOMWidgetModel.prototype.defaults(), {
            _model_module: 'jupyter-webrtc',
            _view_module: 'jupyter-webrtc',
            _model_name: 'MediaRecorderModel',
            _view_name: 'MediaRecorderView',
            _model_module_version: semver_range,
            _view_module_version: semver_range,
            source: null,
            data: null,
            filename: 'record',
            format: 'webm',
            _recording: false,
            _video_src: '',
         })
    },

    initialize: function() {
        MediaRecorderModel.__super__.initialize.apply(this, arguments);
        window.last_media_recorder = this;

        this.on('msg:custom', _.bind(this.handleCustomMessage, this));
        this.on('change:_recording', this.updateRecord);

        this.mediaRecorder = null;
        this.chunks = [];
    },

    handleCustomMessage: function(content) {
        if (content.msg == 'play') {
            this.play();
        } else if(content.msg == 'download') {
            this.download();
        }
    },

    updateRecord: function() {
        var source = this.get('source');
        if(!source) {
            new Error('No source specified');
            return;
        }

        if(this.get('_recording')) {
            this.chunks = [];

            source.captureStream().then((stream) => {
                this.mediaRecorder = new MediaRecorder(stream, {
                    audioBitsPerSecond: 128000,
                    videoBitsPerSecond: 2500000,
                    mimeType: 'video/' + this.get('format')
                });
                this.mediaRecorder.start();
                this.mediaRecorder.ondataavailable = (event) => {
                    this.chunks.push(event.data);
                };
            });
        } else {
            this.mediaRecorder.stop();
        }
    },

    play: function() {
        if (this.chunks.length == 0) {
            new Error('Nothing to play');
            return;
        }
        if (this.get('_video_src') != '') {
            URL.revokeObjectURL(this.get('_video_src'));
        }
        var buffer = new Blob(this.chunks, {type: 'video/' + this.get('format')});
        this.set('_video_src', window.URL.createObjectURL(buffer));
    },

    download: function() {
        if (this.chunks.length == 0) {
            new Error('Nothing to download');
            return;
        }
        var blob = new Blob(this.chunks, {type: 'video/' + this.get('format')});
        var url = window.URL.createObjectURL(blob);
        var a = document.createElement('a');
        a.style.display = 'none';
        a.href = url;
        a.download = this.get('filename');
        document.body.appendChild(a);
        a.click();
        setTimeout(function() {
            document.body.removeChild(a);
            window.URL.revokeObjectURL(url);
        }, 100);
    },

    close: function() {
        if (this.get('_video_src') != '') {
            URL.revokeObjectURL(this.get('_video_src'));
        }
        return MediaRecorderModel.__super__.close.apply(this, arguments);
    }
}, {
serializers: _.extend({
    source: { deserialize: widgets.unpack_models },
    }, widgets.DOMWidgetModel.serializers)
});

var MediaRecorderView = widgets.DOMWidgetView.extend({
    render: function() {
        MediaRecorderView.__super__.render.apply(this, arguments);

        this.el.classList.add('jupyter-widgets');

        this.buttons = document.createElement('div');
        this.buttons.classList.add('widget-inline-hbox');
        this.buttons.classList.add('widget-play');

        this.recordButton = document.createElement('button');
        this.playButton = document.createElement('button');
        this.downloadButton = document.createElement('button');
        this.video = document.createElement('video');

        this.recordButton.className = 'jupyter-button';
        this.playButton.className = 'jupyter-button';
        this.downloadButton.className = 'jupyter-button';

        this.buttons.appendChild(this.recordButton);
        this.buttons.appendChild(this.playButton);
        this.buttons.appendChild(this.downloadButton);
        this.el.appendChild(this.buttons);
        this.el.appendChild(this.video);

        var recordIcon = document.createElement('i');
        recordIcon.className = 'fa fa-circle';
        this.recordButton.appendChild(recordIcon);
        var playIcon = document.createElement('i');
        playIcon.className = 'fa fa-play';
        this.playButton.appendChild(playIcon);
        var downloadIcon = document.createElement('i');
        downloadIcon.className = 'fa fa-download';
        this.downloadButton.appendChild(downloadIcon);

        this.recordButton.onclick = () => {
            this.model.set('_recording', !this.model.get('_recording'));
        };
        this.playButton.onclick = this.model.play.bind(this.model);
        this.downloadButton.onclick = this.model.download.bind(this.model);

        this.listenTo(this.model, 'change:_recording', () => {
            if(this.model.get('_recording')) {
                recordIcon.style.color = 'darkred';
                this.playButton.disabled = true;
            } else {
                recordIcon.style.color = '';
                this.playButton.disabled = false;
            }
        });

        this.listenTo(this.model, 'change:_video_src', () => {
            this.video.src = this.model.get('_video_src');
            this.video.play();
        });
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
            id: widgets.uuid(),
            nickname: 'anonymous',
            peers: [],
            streams: []
        })
    },
    log: function() {
        var args = [this.get('nickname') + ' ' +this.get('id') +': ']
        args = args.concat(Array.prototype.slice.call(arguments))
        console.log.apply(null, args);
    },
    initialize: function() {
        WebRTCRoomModel.__super__.initialize.apply(this, arguments);
        this.set('id',  widgets.uuid())
        this.id = this.get('id')
        this.room = this.get('room')
        this.peers = {} // id (string) to WebRTCPeerModel
        window['last_webrtc_room_' + this.id] = this
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
                id_local: this.get('id'),
                id_remote: from_id
        }).then(_.bind(function(peer) {
            peer.peer_msg_send = _.bind(function(msg) {
                msg.id = this.get('id')
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
        var from_id = msg.id;
        if(msg.id == this.id)
            return; // skip my own msg'es
        if(msg.type == 'join') {
            this.log('join from', msg.id)
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
        } else if(msg.id) {
            if(msg.to != this.id) {
                return
            }
            if(!this.peers[msg.id]) {
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
            var peer = this.peers[msg.id]
            if(peer) {
                //console.log(this.id, ': peer', msg.id, peer, this, this.cid)
                peer.then(_.bind(function(peer) {
                    this.log('sending from', msg.id, ' to', msg.to, msg)
                    peer.on_peer_msg(msg)
                }, this))
            } else {
                console.error('sending to unknown peer', msg.id)
            }
        } else {
            console.error('expected a to id to be present')
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
        this.room_msg_send({type: 'join', id: this.get('id')})

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
        this.room_msg_send({type: 'join', id: this.get('id')})

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
        var args = [this.get('id') +': ']
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
                    console.log('sending sdp', this.id)
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
        var id = this.id = this.get('id_local')
        this.initiator = false

        var pc_config = {"iceServers": [{"urls": ["stun:stun.l.google.com:19302", 'stun:stun1.l.google.com:19302', 'stun:stun2.l.google.com:19302']}]};
        //var pc_config = null;
        this.pc = new RTCPeerConnection(pc_config);

        window['last_webrtc_'+id] = this
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
            console.log(this.id, 'onicecandidate', event.candidate)
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
                    model.stream = Promise.resolve(evt.stream); // TODO: not nice to just set the promise...
                    that.set('stream_remote', model)
                    //mo
                    that.save_changes()
                    console.log(that.id, ': added stream_remote')
                    return model;
                });
        }, this)
        this.pc.onconnecting = _.bind(function() {
            console.log('onconnecting', name)
        }, this)
        this.pc.oniceconnectionstatechange = _.bind(function() {
            console.log(this.id, 'ICE connection state', this.pc.iceConnectionState);
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
            console.log(this.id, 'connection state', this.pc.connectionState);
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
                var id = that.get('id')
                var offer = {
                  offerToReceiveAudio: 1,
                  offerToReceiveVideo: 1
                };

                this.pc.createOffer(offer)
                .then((sdp)  => {
                    console.log('set local desc');
                    that.pc.setLocalDescription(sdp)
                    console.log(that.id, 'send sdp')
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
    VideoStreamModel:VideoStreamModel,
    CameraStreamModel: CameraStreamModel,
    MediaRecorderModel: MediaRecorderModel,
    MediaRecorderView: MediaRecorderView,
    WebRTCPeerModel: WebRTCPeerModel,
    WebRTCPeerView: WebRTCPeerView,
    WebRTCRoomModel: WebRTCRoomModel,
    WebRTCRoomLocalModel: WebRTCRoomLocalModel,
    WebRTCRoomMqttModel: WebRTCRoomMqttModel,
}
