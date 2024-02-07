import * as widgets from "@jupyter-widgets/base";
import * as _ from "underscore";
require("webrtc-adapter");

// Workaround for JupyterLab: "ws" is not defined
// https://github.com/maartenbreddels/ipywebrtc/issues/55
window.ws = global.WebSocket;

import * as mqtt from "mqtt";
const semver_range = "~" + require("../../package.json").version;

export class WebRTCRoomModel extends widgets.DOMWidgetModel {
  defaults() {
    return {
      ...super.defaults(),
      _model_name: "WebRTCRoomModel",
      //_view_name: 'WebRTCRoomView',
      _model_module: "jupyter-webrtc",
      //_view_module: 'jupyter-webrtc',
      _model_module_version: semver_range,
      _view_module_version: semver_range,
      room: "room",
      stream: null,
      room_id: widgets.uuid(),
      nickname: "anonymous",
      peers: [],
      streams: [],
    };
  }
  log() {
    let args = [this.get("nickname") + " " + this.get("room_id") + ": "];
    args = args.concat(Array.prototype.slice.call(arguments));
    console.log.apply(null, args);
  }
  initialize() {
    super.initialize.apply(this, arguments);
    this.set("room_id", widgets.uuid());
    this.room_id = this.get("room_id");
    this.room = this.get("room");
    this.peers = {}; // room_id (string) to WebRTCPeerModel
    window["last_webrtc_room_" + this.room_id] = this;
    const stream = this.get("stream");
    if (stream) {
      this.set("streams", [stream]);
    }
    this.save_changes();
    this.on("msg:custom", this.custom_msg, this);
  }
  custom_msg(content) {
    if (content.msg === "close") {
      this.close();
    }
  }
  close() {
    this.get("peers").forEach((peer) => peer.close());
  }
  create_peer(from_id) {
    return this.widget_manager
      .new_widget(
        {
          model_name: "WebRTCPeerModel",
          model_module: "jupyter-webrtc",
          model_module_version: semver_range,
          view_name: "WebRTCPeerView",
          view_module: "jupyter-webrtc",
          view_module_version: semver_range,
          widget_class: "webrtc.WebRTCPeerModel", // ipywidgets6
        },
        {
          stream_local: this.get("stream"),
          id_local: this.get("room_id"),
          id_remote: from_id,
        },
      )
      .then((peer) => {
        peer.peer_msg_send = (msg) => {
          msg.room_id = this.get("room_id");
          msg.to = from_id;
          this.log("send to peer", msg);
          //console.log('sending to room', msg, from_id);
          peer.save_changes();
          this.room_msg_send(msg);
        };
        return peer;
      });
  }
  listen_to_remote_stream(peer) {
    peer.on(
      "change:stream_remote",
      _.once(() => {
        this.log("add remote stream");
        const streams = this.get("streams").slice();
        const stream = peer.get("stream_remote");
        streams.push(stream);
        this.set("streams", streams);
        this.save_changes();
      }),
    );
    peer.on("change:connected", () => {
      const connected = peer.get("connected");
      this.log(
        "changed connected status for ",
        peer.get("id_remote"),
        "to",
        connected,
      );
      if (!connected) {
        let streams = this.get("streams").slice();
        const stream = peer.get("stream_remote");
        streams = _.without(streams, stream);
        this.set("streams", streams);

        let peers = this.get("peers").slice();
        peers = _.without(peers, peer);
        this.set("peers", peers);

        delete this.peers[peer.get("id_remote")];
        this.save_changes();
      }
    });
  }
  on_room_msg(msg) {
    const from_id = msg.room_id;
    if (msg.room_id === this.room_id) return; // skip my own msg'es
    if (msg.type === "join") {
      this.log("join from", msg.room_id);
      this.peers[from_id] = this.create_peer(from_id).then((peer) => {
        this.listen_to_remote_stream(peer);
        peer.join().then(() => {
          const peers = this.get("peers").slice();
          peers.push(peer);
          this.set("peers", peers);
          this.save_changes();
        });
        return peer;
      });
      this.log(": added peer", from_id);
    } else if (msg.room_id) {
      if (msg.to !== this.room_id) {
        return;
      }
      if (!this.peers[msg.room_id]) {
        this.peers[from_id] = this.create_peer(from_id).then((peer) => {
          this.listen_to_remote_stream(peer);
          const peers = this.get("peers").slice();
          peers.push(peer);
          this.set("peers", peers);
          this.save_changes();
          return peer;
        });
        this.log("added peer", from_id);
      }
      const peer = this.peers[msg.room_id];
      if (peer) {
        //console.log(this.room_id, ': peer', msg.room_id, peer, this, this.cid)
        peer.then((peer) => {
          this.log("sending from", msg.room_id, " to", msg.to, msg);
          peer.on_peer_msg(msg);
        });
      } else {
        console.error("sending to unknown peer", msg.room_id);
      }
    } else {
      console.error("expected a to room_id to be present");
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
    return { ...super.defaults(), _model_name: "WebRTCRoomLocalModel" };
  }
  initialize() {
    super.initialize.apply(this, arguments);
    this.join();
  }
  join() {
    const room = this.get("room");
    console.log("joining room", room);
    const callbacks = global_rooms[room] || [];
    callbacks.push((msg) => this.on_room_msg(msg));
    global_rooms[room] = callbacks;
    this.room_msg_send({ type: "join", room_id: this.get("room_id") });
  }
  room_msg_send(msg) {
    const room = this.get("room");
    console.log("send to room", room, msg, global_rooms[room]);
    _.each(global_rooms[room], function (callback) {
      callback(msg);
    });
  }
}

export class WebRTCRoomMqttModel extends WebRTCRoomModel {
  defaults() {
    return {
      ...super.defaults(),
      _model_name: "WebRTCRoomMqttModel",
      server: "wss://iot.eclipse.org:443/ws",
    };
  }
  initialize() {
    super.initialize.apply(this, arguments);
    console.log("connecting to", this.get("server"));
    this.mqtt_client = mqtt.connect(this.get("server"));
    const client = this.mqtt_client;
    this.topic_join = "jupyter-webrtc/" + this.get("room") + "/join";
    //this.topic_present = 'jupyter-webrtc/' +this.room +'/present'
    this.mqtt_client.on("connect", () => {
      client.subscribe(this.topic_join);
      //client.subscribe(this.topic_present);
      //client.publish('jupyter-webrtc/room-a/present', 'you|me', {retain:true});
      //client.publish('jupyter-webrtc/room-a/join', 'Hello mqtt');
    });
    client.on("message", (topic, message) => {
      const msg = JSON.parse(message);
      console.log("msg received", message, msg);
      if (topic === this.topic_join) {
        this.on_room_msg(msg);
      }
    });
    this.join();
  }
  join() {
    this.room_msg_send({ type: "join", room_id: this.get("room_id") });
  }
  room_msg_send(msg) {
    const text = JSON.stringify(msg);
    console.log("send to mqtt channel", msg);
    this.mqtt_client.publish(this.topic_join, text);
  }
}

export class WebRTCPeerModel extends widgets.DOMWidgetModel {
  defaults() {
    return {
      ...super.defaults(),
      _model_name: "WebRTCPeerModel",
      _view_name: "WebRTCPeerView",
      _model_module: "jupyter-webrtc",
      _view_module: "jupyter-webrtc",
      _model_module_version: semver_range,
      _view_module_version: semver_range,
    };
  }
  log() {
    let args = [this.get("room_id") + ": "];
    args = args.concat(Array.prototype.slice.call(arguments));
    console.log.apply(null, args);
  }
  on_peer_msg(info) {
    this.log("peer msg", info);
    if (info.sdp) {
      // the other party send us the sdp
      this.log(name, "got sdp");
      const sdp_remote = new RTCSessionDescription(info.sdp);
      const remote_description_set = this.pc.setRemoteDescription(sdp_remote);
      if (!this.initiator) {
        console.log(
          this.get("id_local"),
          "did not initiate, reply with answer",
        );
        // if we didn't initiate, we should respond with an answer
        // now we create an answer, and send a sdp back
        Promise.all([remote_description_set, this.tracks_added])
          .then(() => this.pc.createAnswer())
          .then((sdp) => {
            console.log("sending sdp", this.room_id);
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

    const room_id = (this.room_id = this.get("id_local"));
    this.initiator = false;

    const pc_config = {
      iceServers: [
        {
          urls: [
            "stun:stun.l.google.com:19302",
            "stun:stun1.l.google.com:19302",
            "stun:stun2.l.google.com:19302",
          ],
        },
      ],
    };
    //const pc_config = null;
    this.pc = new RTCPeerConnection(pc_config);

    window["last_webrtc_" + room_id] = this;
    //this.other = null

    if (this.get("stream_local")) {
      this.tracks_added = new Promise((resolve, reject) => {
        this.get("stream_local").stream.then((stream) => {
          console.log("add stream", stream);
          //this.pc.addStream(stream) (this crashes/hangs chrome)
          // so we use the addTrack api
          stream.getTracks().forEach((track) => {
            this.pc.addTrack(track, stream);
          });
          resolve();
        }); // TODO: catch/reject?
      });
    } else {
      console.log("no stream");
      this.tracks_added = Promise.resolve();
    }
    this.tracks_added.then(() => console.log("tracks added"));
    this.pc.onicecandidate = (event) => {
      console.log(this.room_id, "onicecandidate", event.candidate);
      this.event_candidate = event;
      this.send_ice_candidate(event.candidate);
    };
    this.pc.onopen = () => {
      console.log("onopen", name);
    };
    this.pc.onaddstream = (evt) => {
      console.log("onaddstream", name);
      this.widget_manager
        .new_widget({
          model_name: "MediaStreamModel",
          model_module: "jupyter-webrtc",
          model_module_version: semver_range,
          view_name: "MediaStreamView",
          view_module: "jupyter-webrtc",
          view_module_version: semver_range,
          widget_class: "webrtc.MediaStreamModel", // ipywidgets6
        })
        .then((model) => {
          model.captureStream = () => {
            return new Promise((resolve, reject) => {
              resolve(evt.stream);
            });
          }; // TODO: not nice to just set the method...
          this.set("stream_remote", model);
          //mo
          this.save_changes();
          console.log(this.room_id, ": added stream_remote");
          return model;
        });
    };
    this.pc.onconnecting = () => {
      console.log("onconnecting", name);
    };
    this.pc.oniceconnectionstatechange = () => {
      console.log(
        this.room_id,
        "ICE connection state",
        this.pc.iceConnectionState,
      );
      if (this.pc.iceConnectionState === "disconnected") {
        this.set("connected", false);
        this.save_changes();
      }
      if (this.pc.iceConnectionState === "connected") {
        this.set("connected", true);
        this.save_changes();
      }
      // TODO: can we recover from this?
      if (this.pc.iceConnectionState === "failed") {
        this.set("connected", false);
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
    this.on("msg:custom", this.custom_msg, this);
    //this.disconnect = _.once(this.disconnect, this));
    window.addEventListener("beforeunload", () => {
      this.close();
    });
  }
  custom_msg(content) {
    console.log("custom msg", content);
    if (content.msg === "connect") {
      this.connect();
    } else if (content.msg === "close") {
      this.close();
    } else {
      this.disconnect();
    }
  }
  close() {
    //console.log('disconnect')
    this.pc.close(); // does not trigger ice conncection status changes
    this.set("connected", false);
    this.save_changes();
  }
  join() {
    this.initiator = true;
    return this.tracks_added.then(() => {
      return new Promise((resolve, reject) => {
        const room_id = this.get("room_id");
        const offer = {
          offerToReceiveAudio: 1,
          offerToReceiveVideo: 1,
        };

        this.pc
          .createOffer(offer)
          .then((sdp) => {
            console.log("set local desc");
            this.pc.setLocalDescription(sdp);
            console.log(room_id, "send sdp");
            this.send_sdp(sdp);
            resolve();
          })
          .catch((e) => {
            console.error(e);
            reject(e);
          });
        return this;
      });
    });
  }
  send_sdp(sdp) {
    this.broadcast({ sdp: sdp });
  }
  send_ice_candidate(candidate) {
    this.broadcast({ candidate: candidate });
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
    const el = document.createElement("video");
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
