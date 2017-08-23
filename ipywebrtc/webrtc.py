from __future__ import absolute_import
import ipywidgets as widgets
import ipywidgets
from traitlets import Unicode, Integer
import traitlets
import logging

logger = logging.getLogger("jupyter-webrtc")

import ipywebrtc._version
semver_range_frontend = "~" + ipywebrtc._version.__version_js__

class HasStream:
    pass # to indicate it has a .stream property on the JS side
@widgets.register('webrtc.MediaStream')
class MediaStream(widgets.DOMWidget, HasStream):
    """Represents a media source."""

    _model_module = Unicode('jupyter-webrtc').tag(sync=True)
    _view_module = Unicode('jupyter-webrtc').tag(sync=True)
    _view_name = Unicode('MediaStreamView').tag(sync=True)
    _model_name = Unicode('MediaStreamModel').tag(sync=True)
    _view_module_version = Unicode(semver_range_frontend).tag(sync=True)
    _model_module_version = Unicode(semver_range_frontend).tag(sync=True)

@widgets.register('webrtc.VideoStream')
class VideoStream(MediaStream):
    """Represents a media source by a video."""
    _model_name = Unicode('VideoStreamModel').tag(sync=True)

    url = Unicode('https://webrtc.github.io/samples/src/video/chrome.mp4').tag(sync=True)
    data = traitlets.Bytes(None, allow_none=True, help="The image data as a byte string.").tag(sync=True)
    play = traitlets.Bool(True).tag(sync=True)
    loop = traitlets.Bool(True).tag(sync=True)
    filename = traitlets.Unicode(help="The image filename (will set the .data property)")

    @traitlets.observe('filename')
    def _propagate_filename(self, change):
        with open(change.new, 'rb') as f:
            self.data = f.read()


@widgets.register('webrtc.CameraStream')
class CameraStream(MediaStream):
    """Represents a media source by a camera/webcam."""
    _model_name = Unicode('CameraStreamModel').tag(sync=True)

    # Specify audio constraint and video constraint as a boolean or dict.
    audio = traitlets.Bool(True).tag(sync=True)
    video = traitlets.Bool(True).tag(sync=True)

    def close(self):
        self.send({'msg': 'close'})
        super(CameraStream, self).close()

@widgets.register('webrtc.WebRTCPeer')
class WebRTCPeer(MediaStream):
    _model_module = Unicode('jupyter-webrtc').tag(sync=True)
    _view_module = Unicode('jupyter-webrtc').tag(sync=True)
    _view_name = Unicode('WebRTCPeerView').tag(sync=True)
    _model_name = Unicode('WebRTCPeerModel').tag(sync=True)
    stream_local = traitlets.Instance(object, allow_none=True).tag(sync=True, **ipywidgets.widget_serialization)
    stream_remote = traitlets.Instance(object, allow_none=True).tag(sync=True, **ipywidgets.widget_serialization)
    id_local = Unicode('lala').tag(sync=True)
    id_remote = Unicode('lala').tag(sync=True)
    connected = traitlets.Bool(False, read_only=True).tag(sync=True)
    failed = traitlets.Bool(False, read_only=True).tag(sync=True)

    def connect(self):
        self.send({'msg': 'connect'})

    def close(self):
        self.send({'msg': 'close'})
        super(WebRTCPeer, self).close()

class WebRTCRoom(widgets.DOMWidget):
    _model_module = Unicode('jupyter-webrtc').tag(sync=True)
    #_view_module = Unicode('jupyter-webrtc').tag(sync=True)
    #_view_name = Unicode('WebRTCPeerView').tag(sync=True)
    _model_name = Unicode('WebRTCRoomModel').tag(sync=True)
    #_view_module_version = Unicode(semver_range_frontend).tag(sync=True)
    _model_module_version = Unicode(semver_range_frontend).tag(sync=True)
    room = Unicode('room').tag(sync=True)
    stream = traitlets.Instance(object, allow_none=True).tag(sync=True, **ipywidgets.widget_serialization)
    id = Unicode(read_only=True).tag(sync=True)
    nickname = Unicode('anonymous').tag(sync=True)
    peers = traitlets.List(traitlets.Instance(WebRTCPeer), [], allow_none=False).tag(sync=True, **ipywidgets.widget_serialization)
    streams = traitlets.List(traitlets.Instance(MediaStream), [], allow_none=False).tag(sync=True, **ipywidgets.widget_serialization)

    def close(self):
        self.send({'msg': 'close'})
        super(WebRTCRoom, self).close()

class WebRTCRoomLocal(WebRTCRoom):
    _model_name = Unicode('WebRTCRoomLocalModel').tag(sync=True)

class WebRTCRoomMqtt(WebRTCRoom):
    _model_name = Unicode('WebRTCRoomMqttModel').tag(sync=True)
    server = Unicode('wss://iot.eclipse.org:443/ws').tag(sync=True)

@widgets.register
class MediaRecorder(widgets.Widget):
    _model_module = Unicode('jupyter-webrtc').tag(sync=True)
    _model_name = Unicode('MediaRecorderModel').tag(sync=True)
    _model_module_version = Unicode(semver_range_frontend).tag(sync=True)
    stream = traitlets.Instance(object, allow_none=True).tag(sync=True, **ipywidgets.widget_serialization)
    record = traitlets.Bool(False).tag(sync=True)
    data = traitlets.Instance(object, help="The video data as a byte string.").tag(sync=True)
    mime_type = Unicode('video/webm').tag(sync=True)
    #streaming = traitlets.Bool(False).tag(sync=True)
    filename =  Unicode('video/webm')

