from __future__ import absolute_import
import os
import logging
try:
    from urllib import urlopen  # py2
except ImportError:
    from urllib.request import urlopen  # py3
from traitlets import (
    observe,
    Bool, Bytes, Dict, Instance, Int, List, TraitError, Unicode, validate
)
from ipywidgets import DOMWidget, Image, register, widget_serialization
from ipython_genutils.py3compat import string_types
import ipywebrtc._version
import traitlets
import ipywidgets as widgets

logger = logging.getLogger("jupyter-webrtc")
semver_range_frontend = "~" + ipywebrtc._version.__version_js__


@register
class MediaStream(DOMWidget):
    """Represents a media source.

    See https://developer.mozilla.org/nl/docs/Web/API/MediaStream for details
    In practice this can a stream coming from an HTMLVideoElement,
    HTMLCanvasElement (could be a WebGL canvas) or a camera/webcam/microphone
    using getUserMedia.

    The currently supported MediaStream (subclasses) are:
       * :class:`VideoStream`: A video file/data as media stream.
       * :class:`CameraStream`: Webcam/camera as media stream.
       * :class:`ImageStream`: An image as a static stream.
       * :class:`WidgetStream`: Arbitrary DOMWidget as stream.

    A MediaStream can be used with:
       * :class:`MediaRecorder`: To record a movie
       * :class:`MediaImageRecorder`: To create images/snapshots.
       * :class:`WebRTCRoom` (or rather :class:`WebRTCRoomMqtt`): To stream a media stream to a (set of) peers.
    """

    _model_module = Unicode('jupyter-webrtc').tag(sync=True)
    _view_module = Unicode('jupyter-webrtc').tag(sync=True)
    _view_name = Unicode('MediaStreamView').tag(sync=True)
    _model_name = Unicode('MediaStreamModel').tag(sync=True)
    _view_module_version = Unicode(semver_range_frontend).tag(sync=True)
    _model_module_version = Unicode(semver_range_frontend).tag(sync=True)

# for backwards compatibility with ipyvolume
HasStream = MediaStream


@register
class WidgetStream(MediaStream):
    """Represents a widget media source.
    """
    _model_name = Unicode('WidgetStreamModel').tag(sync=True)
    _view_name = Unicode('WidgetStreamView').tag(sync=True)

    widget = Instance(DOMWidget, allow_none=False, help='An instance of ipywidgets.DOMWidget that will be the source of the MediaStream.')\
                .tag(sync=True, **widget_serialization)
    max_fps = Int(None, allow_none=True,
                help="(int, default None) The maximum amount of frames per second to capture, or only on new data when the valeus is None.")\
                .tag(sync=True)

    @validate('max_fps')
    def _valid_fps(self, proposal):
        if proposal['value'] is not None and proposal['value'] < 0:
            raise TraitError('max_fps attribute must be a positive integer')
        return proposal['value']


class ImageStream(MediaStream):
    """Represent a media stream by a static image"""
    _model_name = Unicode('ImageStreamModel').tag(sync=True)

    image = Instance(Image, help="An ipywidgets.Image instance that will be the source of the media stream.")\
            .tag(sync=True, **widget_serialization)


@register
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
    play = Bool(True, help='Plays the video or pauses it.').tag(sync=True)
    loop = Bool(True, help='When true, the video will start from the beginning after finishing.').tag(sync=True)

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


@register
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
        help='Constraints for the camera, see https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/getUserMedia for details.'
        ).tag(sync=True)

    @classmethod
    def facing_user(cls, audio=True, **kwargs):
        """Convenience method to get the camera facing the user (often front)

        Parameters
        ----------
        audio: bool
            Capture audio or not
        kwargs:
            Extra keyword arguments passed to the `CameraStream`
        """
        return cls._facing(facing_mode='user', audio=audio, **kwargs)

    @classmethod
    def facing_environment(cls, audio=True, **kwargs):
        """Convenience method to get the camera facing the environment (often the back)

        Parameters
        ----------
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

def _memoryview_to_bytes(value, widget=None):
    return bytes(value)


@register
class MediaRecorder(DOMWidget):
    """Creates a recorder which allows to record a MediaStream widget, play the
    record in the Notebook, and download it.
    """
    _model_module = Unicode('jupyter-webrtc').tag(sync=True)
    _view_module = Unicode('jupyter-webrtc').tag(sync=True)
    _model_name = Unicode('MediaRecorderModel').tag(sync=True)
    _view_name = Unicode('MediaRecorderView').tag(sync=True)
    _view_module_version = Unicode(semver_range_frontend).tag(sync=True)
    _model_module_version = Unicode(semver_range_frontend).tag(sync=True)

    stream = Instance(MediaStream, allow_none=True, help="An instance of :class:`MediaStream` that is the source of the video recording.")\
                .tag(sync=True, **widget_serialization)
    data = Bytes(help='The byte object containing the video data after the recording finished.')\
                .tag(sync=True, from_json=_memoryview_to_bytes)
    filename = Unicode('recording', help='The filename used for downloading or auto saving.').tag(sync=True)
    format = Unicode('webm', help='The format of the recording (e.g. webm/mp4).').tag(sync=True)
    record = Bool(False, help='(boolean) Indicator and controller of the recorder state, i.e. putting the value to True will start recording.').tag(sync=True)
    autosave = Bool(False, help='If true, will save the data to a file once the recording is finished (based on filename and format)').tag(sync=True)

    @observe('data')
    def _check_autosave(self, change):
        if len(self.data) and self.autosave:
            self.save()


    def play(self):
        """Play the recording"""
        self.send({'msg': 'play'})

    def download(self):
        """Download the recording (usually a popup appears in the browser)"""
        self.send({'msg': 'download'})

    def save(self, filename=None):
        """Save the data to a file, if no filename is given it is based on the filename trait and the format.

        >>> recorder = MediaRecorder(filename='test', format='mp4')
        >>> ...
        >>> recorder.save()  # will save to test.mp4
        >>> recorder.save('foo')  # will save to foo.mp4
        >>> recorder.save('foo.dat')  # will save to foo.dat

        """
        filename = filename or self.filename
        if '.' not in filename:
            filename += '.' + self.format
        if len(self.data) == 0:
            raise ValueError('No data, did you record anything?')
        with open(filename, 'wb') as f:
            f.write(self.data)

    _video_src = Unicode('').tag(sync=True)



# monkey patch, same as https://github.com/jupyter-widgets/ipywidgets/pull/2146
if 'from_json' not in widgets.Image.value.metadata:
    widgets.Image.value.metadata['from_json'] = lambda js, obj: None if js is None else js.tobytes()

@register
class MediaImageRecorder(DOMWidget):
    """Creates a recorder which allows to grab an Image from a MediaStream widget.
    """
    _model_module = Unicode('jupyter-webrtc').tag(sync=True)
    _view_module = Unicode('jupyter-webrtc').tag(sync=True)
    _model_name = Unicode('MediaImageRecorderModel').tag(sync=True)
    _view_name = Unicode('MediaImageRecorderView').tag(sync=True)
    _view_module_version = Unicode(semver_range_frontend).tag(sync=True)
    _model_module_version = Unicode(semver_range_frontend).tag(sync=True)

    stream = Instance(MediaStream, allow_none=True,
         help=MediaRecorder.stream.metadata['help'])\
        .tag(sync=True, **widget_serialization)
    image = Instance(Image, help='An instance of ipywidgets.Image that will receive the grabbed image.',
        allow_none=True).tag(sync=True, **widget_serialization)
    filename = Unicode('recording', help=MediaRecorder.filename.metadata['help']).tag(sync=True)
    autosave = Bool(False, help=MediaRecorder.autosave.metadata['help'])

    def __init__(self, **kwargs):
        super(MediaImageRecorder, self).__init__(**kwargs)
        self.image.observe(self._check_autosave, 'value')

    @observe('image')
    def _bind_image(self, change):
        if change.old:
            change.old.unobserve(self._check_autosave, 'value')
        change.new.observe(self._check_autosave, 'value')

    def _check_autosave(self, change):
        if len(self.image.value) and self.autosave:
            self.save()

    @traitlets.default('image')
    def _default_image(self):
        return Image()

    def grab(self):
        self.send({'msg': 'grab'})

    def download(self):
        self.send({'msg': 'download'})

    def save(self, filename=None):
        """Save the data to a file, if no filename is given it is based on the filename trait and the image.format.

        >>> recorder = MediaImageRecorder(filename='test', format='png')
        >>> ...
        >>> recorder.save()  # will save to test.png
        >>> recorder.save('foo')  # will save to foo.png
        >>> recorder.save('foo.dat')  # will save to foo.dat

        """
        filename = filename or self.filename
        if '.' not in filename:
            filename += '.' + self.image.format
        if len(self.image.value) == 0:
            raise ValueError('No data, did you record anything?')
        with open(filename, 'wb') as f:
            f.write(self.image.value)


@register
class WebRTCPeer(DOMWidget):
    """A peer-to-peer webrtc connection"""
    _model_module = Unicode('jupyter-webrtc').tag(sync=True)
    _view_module = Unicode('jupyter-webrtc').tag(sync=True)
    _view_name = Unicode('WebRTCPeerView').tag(sync=True)
    _model_name = Unicode('WebRTCPeerModel').tag(sync=True)
    _view_module_version = Unicode(semver_range_frontend).tag(sync=True)
    _model_module_version = Unicode(semver_range_frontend).tag(sync=True)

    stream_local = Instance(MediaStream, allow_none=True).tag(sync=True, **widget_serialization)
    stream_remote = Instance(MediaStream, allow_none=True).tag(sync=True, **widget_serialization)
    id_local = Unicode('').tag(sync=True)
    id_remote = Unicode('').tag(sync=True)
    connected = Bool(False, read_only=True).tag(sync=True)
    failed = Bool(False, read_only=True).tag(sync=True)

    def connect(self):
        self.send({'msg': 'connect'})


@register
class WebRTCRoom(DOMWidget):
    """A 'chatroom', which consists of a list of :`WebRTCPeer` connections
    """
    _model_module = Unicode('jupyter-webrtc').tag(sync=True)
    _view_module = Unicode('jupyter-webrtc').tag(sync=True)
    _model_name = Unicode('WebRTCRoomModel').tag(sync=True)
    _view_module_version = Unicode(semver_range_frontend).tag(sync=True)
    _model_module_version = Unicode(semver_range_frontend).tag(sync=True)

    room = Unicode('room').tag(sync=True)
    stream = Instance(MediaStream, allow_none=True).tag(sync=True, **widget_serialization)
    id = Unicode(read_only=True).tag(sync=True)
    nickname = Unicode('anonymous').tag(sync=True)
    peers = List(Instance(WebRTCPeer), [], allow_none=False).tag(sync=True, **widget_serialization)
    streams = List(Instance(MediaStream), [], allow_none=False).tag(sync=True, **widget_serialization)


@register
class WebRTCRoomLocal(WebRTCRoom):
    _model_name = Unicode('WebRTCRoomLocalModel').tag(sync=True)


@register
class WebRTCRoomMqtt(WebRTCRoom):
    """Use a mqtt server to connect to other peers"""
    _model_name = Unicode('WebRTCRoomMqttModel').tag(sync=True)

    server = Unicode('wss://iot.eclipse.org:443/ws').tag(sync=True)

# add all help strings to the __doc__ for the api docstrings
for name, cls in list(vars().items()):
    try:
        if issubclass(cls, traitlets.HasTraits):
            for trait_name, trait in cls.class_traits().items():
                if 'help' in trait.metadata:
                    trait.__doc__ = trait.metadata['help']
    except TypeError:
        pass
