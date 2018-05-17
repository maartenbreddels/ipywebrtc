from __future__ import absolute_import
import os
import logging
try:
    from urllib import urlopen  # py2
except ImportError:
    from urllib.request import urlopen  # py3
from traitlets import (
    Bool, Bytes, Dict, Instance, List, Unicode
)
from ipywidgets import DOMWidget, register, widget_serialization
from ipython_genutils.py3compat import string_types
import ipywebrtc._version

logger = logging.getLogger("jupyter-webrtc")
semver_range_frontend = "~" + ipywebrtc._version.__version_js__


@register('webrtc.MediaStream')
class MediaStream(DOMWidget):
    """Represents a media source.

    See https://developer.mozilla.org/nl/docs/Web/API/MediaStream for details
    In practice this can a stream coming from an HTMLVideoElement,
    HTMLCanvasElement (could be a WebGL canvas) or a camera/webcam/microphone
    using getUserMedia.
    """

    _model_module = Unicode('jupyter-webrtc').tag(sync=True)
    _view_module = Unicode('jupyter-webrtc').tag(sync=True)
    _view_name = Unicode('MediaStreamView').tag(sync=True)
    _model_name = Unicode('MediaStreamModel').tag(sync=True)
    _view_module_version = Unicode(semver_range_frontend).tag(sync=True)
    _model_module_version = Unicode(semver_range_frontend).tag(sync=True)


@register('webrtc.VideoStream')
class VideoStream(MediaStream):
    """Represents a media source by a video.

    The `value` of this widget accepts a byte string. The byte string is the
    raw video data that you want the browser to display.  You can explicitly
    define the format of the byte string using the `format` trait (which
    defaults to 'mp4').
    If you pass `"url"` to the `"format"` trait, `value` will be interpreted
    as a URL as bytes encoded in ascii.
    """
    _model_name = Unicode('VideoStreamModel').tag(sync=True)

    format = Unicode('mp4', help="The format of the video.").tag(sync=True)
    value = Bytes(None, allow_none=True, help="The video data as a byte string.").tag(sync=True)
    play = Bool(True, help='Play video or pause it').tag(sync=True)
    loop = Bool(True, help='When true, the video will start from the beginning after finishing').tag(sync=True)

    @classmethod
    def from_file(cls, f, **kwargs):
        """Create a `VideoStream` from a local file or file object.

        Parameters
        ----------
        f: str or file
            The path or file object that will be read and its bytes assigned
            to the value trait.
        **kwargs:
            Extra keyword arguments for `VideoStream`
        Returns an `VideoStream` with the value set from the content of a file.
        """
        if isinstance(f, string_types):
            with open(f, 'rb') as f:
                return cls(value=f.read(), **kwargs)
        else:
            if 'format' not in kwargs:
                ext = os.path.splitext(f)[1]
                if ext:
                    kwargs['format'] = ext[1:]  # remove the .
            return cls(value=f.read(), **kwargs)

    @classmethod
    def from_url(cls, url, **kwargs):
        """Create a `VideoStream` from a url.
        This wil set the .value trait to the url, and the .format trait to
        'url'

        Parameters
        ----------
        url: str
            The url of the file that will be assigned to the value trait.
        **kwargs:
            Extra keyword arguments for `VideoStream`
        Returns an `VideoStream` with the value set to the url.
        """
        kwargs = dict(kwargs)
        kwargs['format'] = 'url'
        # for now we only support ascii
        return cls(value=url.encode('ascii'), **kwargs)

    @classmethod
    def from_download(cls, url, **kwargs):
        """Create a `VideoStream` from a url by downloading

        Parameters
        ----------
        url: str
            The url of the file that will be downloadeded and its bytes
            assigned to the value trait.
        **kwargs:
            Extra keyword arguments for `VideoStream`
        Returns an `VideoStream` with the value set from the content of a url.
        """
        if 'format' not in kwargs:
            ext = os.path.splitext(url)[1]
            if ext:
                kwargs = dict(kwargs)
                kwargs['format'] = ext[1:]  # remove the .
        return cls(value=urlopen(url).read(), **kwargs)


@register('webrtc.CameraStream')
class CameraStream(MediaStream):
    """Represents a media source by a camera/webcam/microphone using
    getUserMedia. See
    https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/getUserMedia
    for more detail.
    The constraints trait can be set to specify constraints for the camera or
    microphone, which is described in the documentation of getUserMedia, such
    as in the link above,
    Two convenience methods are avaiable to easily get access to the 'front'
    and 'back' camera, when present
    >>> CameraStream.facing_user(audio=False)
    >>> CameraStream.facing_environment(audio=False)
    """
    _model_name = Unicode('CameraStreamModel').tag(sync=True)

    # Specify audio constraint and video constraint
    # see https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/getUserMedia
    constraints = Dict(
        {'audio': True, 'video': True},
        help='Constraints for the camera, see https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/getUserMedia for details'
        ).tag(sync=True)

    @classmethod
    def facing_user(cls, audio=True, **kwargs):
        """Convenience method to get the camera facing the user (often front)
        Paramters
        ---------
        audio: bool
            Capture audio or not
        kwargs:
            Extra keyword arguments passed to the `CameraStream`
        """
        return cls._facing(facing_mode='user', audio=audio, **kwargs)

    @classmethod
    def facing_environment(cls, audio=True, **kwargs):
        """Convenience method to get the camera facing the environment (often the back)
        Paramters
        ---------
        audio: bool
            Capture audio or not
        kwargs:
            Extra keyword arguments passed to the `CameraStream`
        """
        return cls._facing(facing_mode='environment', audio=audio, **kwargs)

    @staticmethod
    def _facing(facing_mode, audio=True, **kwargs):
        kwargs = dict(kwargs)
        constraints = kwargs.pop('constraints', {})
        if 'audio' not in constraints:
            constraints['audio'] = audio
        if 'video' not in constraints:
            constraints['video'] = {}
        constraints['video']['facingMode'] = facing_mode
        return CameraStream(constraints=constraints, **kwargs)


@register('webrtc.WebRTCPeer')
class WebRTCPeer(MediaStream):
    _view_name = Unicode('WebRTCPeerView').tag(sync=True)
    _model_name = Unicode('WebRTCPeerModel').tag(sync=True)

    stream_local = Instance(MediaStream, allow_none=True).tag(sync=True, **widget_serialization)
    stream_remote = Instance(MediaStream, allow_none=True).tag(sync=True, **widget_serialization)
    id_local = Unicode('').tag(sync=True)
    id_remote = Unicode('').tag(sync=True)
    connected = Bool(False, read_only=True).tag(sync=True)
    failed = Bool(False, read_only=True).tag(sync=True)

    def connect(self):
        self.send({'msg': 'connect'})

    def close(self):
        self.send({'msg': 'close'})


@register('webrtc.WebRTCRoom')
class WebRTCRoom(MediaStream):
    _model_name = Unicode('WebRTCRoomModel').tag(sync=True)

    room = Unicode('room').tag(sync=True)
    stream = Instance(MediaStream, allow_none=True).tag(sync=True, **widget_serialization)
    id = Unicode(read_only=True).tag(sync=True)
    nickname = Unicode('anonymous').tag(sync=True)
    peers = List(Instance(WebRTCPeer), [], allow_none=False).tag(sync=True, **widget_serialization)
    streams = List(Instance(MediaStream), [], allow_none=False).tag(sync=True, **widget_serialization)

    def close(self):
        self.send({'msg': 'close'})


@register('webrtc.WebRTCRoomLocal')
class WebRTCRoomLocal(WebRTCRoom):
    _model_name = Unicode('WebRTCRoomLocalModel').tag(sync=True)


@register('webrtc.WebRTCRoomMqtt')
class WebRTCRoomMqtt(WebRTCRoom):
    _model_name = Unicode('WebRTCRoomMqttModel').tag(sync=True)

    server = Unicode('wss://iot.eclipse.org:443/ws').tag(sync=True)


"""
@register('webrtc.MediaRecorder')
class MediaRecorder(widgets.Widget):
    _model_module = Unicode('jupyter-webrtc').tag(sync=True)
    _model_name = Unicode('MediaRecorderModel').tag(sync=True)
    _model_module_version = Unicode(semver_range_frontend).tag(sync=True)

    stream = traitlets.Instance(object, allow_none=True).tag(
        sync=True, **ipywidgets.widget_serialization)
    record = traitlets.Bool(False).tag(sync=True)
    data = traitlets.Instance(
        object, help="The video data as a byte string.").tag(sync=True)
    mime_type = Unicode('video/webm').tag(sync=True)
    #streaming = traitlets.Bool(False).tag(sync=True)
    filename =  Unicode('video/webm')
"""
