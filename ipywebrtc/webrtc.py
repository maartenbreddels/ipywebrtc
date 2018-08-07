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
from ipywidgets import DOMWidget, Image, Video, Audio, register, widget_serialization
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
       * :class:`VideoRecorder`: To record a movie
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


@register
class ImageStream(MediaStream):
    """Represent a media stream by a static image"""
    _model_name = Unicode('ImageStreamModel').tag(sync=True)

    image = Instance(
        Image,
        help="An ipywidgets.Image instance that will be the source of the media stream."
    ).tag(sync=True, **widget_serialization)

    @classmethod
    def from_file(cls, filename, **kwargs):
        """Create a `ImageStream` from a local file.

        Parameters
        ----------
        filename: str
            The location of a file to read into the value from disk.
        **kwargs:
            Extra keyword arguments for `ImageStream`
        Returns an `ImageStream`.
        """
        return cls(image=Image.from_file(filename), **kwargs)

    @classmethod
    def from_url(cls, url, **kwargs):
        """Create a `ImageStream` from a url.
        This will create a `ImageStream` from an Image using its url

        Parameters
        ----------
        url: str
            The url of the file that will be used for the .image trait.
        **kwargs:
            Extra keyword arguments for `ImageStream`
        Returns an `ImageStream`.
        """
        return cls(image=Image.from_url(url), **kwargs)


@register
class VideoStream(MediaStream):
    """Represent a stream of a video element"""
    _model_name = Unicode('VideoStreamModel').tag(sync=True)

    video = Instance(
        Video,
        allow_none=False,
        help="An ipywidgets.Video instance that will be the source of the media stream."
    ).tag(sync=True, **widget_serialization)
    play = Bool(True, help='Plays the videostream or pauses it.').tag(sync=True)

    @classmethod
    def from_file(cls, filename, **kwargs):
        """Create a `VideoStream` from a local file.

        Parameters
        ----------
        filename: str
            The location of a file to read into the value from disk.
        **kwargs:
            Extra keyword arguments for `VideoStream`
        Returns an `VideoStream`.
        """
        autoplay = True
        if kwargs.get('play') is not None:
            autoplay = kwargs.get('play')

        video = Video.from_file(
            filename,
            autoplay=autoplay,
            controls=False
        )

        return cls(video=video, **kwargs)

    @classmethod
    def from_url(cls, url, **kwargs):
        """Create a `VideoStream` from a url.
        This will create a `VideoStream` from a Video using its url

        Parameters
        ----------
        url: str
            The url of the file that will be used for the .video trait.
        **kwargs:
            Extra keyword arguments for `VideoStream`
        Returns an `VideoStream`.
        """
        autoplay = True
        if kwargs.get('play') is not None:
            autoplay = kwargs.get('play')

        video = Video.from_url(
            url,
            autoplay=autoplay,
            controls=False
        )

        return cls(video=video, **kwargs)


@register
class AudioStream(MediaStream):
    """Represent a stream of an audio element"""
    _model_name = Unicode('AudioStreamModel').tag(sync=True)
    _view_name = Unicode('AudioStreamView').tag(sync=True)

    audio = Instance(
        Audio,
        help="An ipywidgets.Audio instance that will be the source of the media stream."
    ).tag(sync=True, **widget_serialization)
    play = Bool(True, help='Plays the audiostream or pauses it.').tag(sync=True)

    @classmethod
    def from_file(cls, filename, **kwargs):
        """Create a `AudioStream` from a local file.

        Parameters
        ----------
        filename: str
            The location of a file to read into the audio value from disk.
        **kwargs:
            Extra keyword arguments for `AudioStream`
        Returns an `AudioStream`.
        """
        autoplay = True
        if kwargs.get('play') is not None:
            autoplay = kwargs.get('play')

        audio = Audio.from_file(
            filename,
            autoplay=autoplay,
            controls=False
        )

        return cls(audio=audio, **kwargs)

    @classmethod
    def from_url(cls, url, **kwargs):
        """Create a `AudioStream` from a url.
        This will create a `AudioStream` from an Audio using its url

        Parameters
        ----------
        url: str
            The url of the file that will be used for the .audio trait.
        **kwargs:
            Extra keyword arguments for `AudioStream`
        Returns an `AudioStream`.
        """
        autoplay = True
        if kwargs.get('play') is not None:
            autoplay = kwargs.get('play')

        audio = Audio.from_url(
            url,
            autoplay=autoplay,
            controls=False
        )

        return cls(audio=audio, **kwargs)


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


class Recorder(DOMWidget):
    stream = Instance(MediaStream, allow_none=True, help="An instance of :class:`MediaStream` that is the source of the video recording.")\
                .tag(sync=True, **widget_serialization)
    data = Bytes(help='The byte object containing the video data after the recording finished.')\
                .tag(sync=True, from_json=_memoryview_to_bytes)
    filename = Unicode('recording', help='The filename used for downloading or auto saving.').tag(sync=True)
    record = Bool(False, help='(boolean) Indicator and controller of the recorder state, i.e. putting the value to True will start recording.').tag(sync=True)
    autosave = Bool(False, help='If true, will save the data to a file once the recording is finished (based on filename and format)').tag(sync=True)
    _data_src = Unicode('').tag(sync=True)

    @observe('data')
    def _check_autosave(self, change):
        if len(self.data) and self.autosave:
            self.save()

    def download(self):
        """Download the recording (usually a popup appears in the browser)"""
        self.send({'msg': 'download'})

    def save(self, filename=None):
        """Save the data to a file, if no filename is given it is based on the filename trait and the format.

        >>> recorder = Recorder(filename='test', format='mp4')
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


@register
class VideoRecorder(Recorder):
    """Creates a recorder which allows to record a MediaStream widget, play the
    record in the Notebook, and download it or turn it into a Video widget.
    """
    _model_module = Unicode('jupyter-webrtc').tag(sync=True)
    _view_module = Unicode('jupyter-webrtc').tag(sync=True)
    _model_name = Unicode('VideoRecorderModel').tag(sync=True)
    _view_name = Unicode('VideoRecorderView').tag(sync=True)
    _view_module_version = Unicode(semver_range_frontend).tag(sync=True)
    _model_module_version = Unicode(semver_range_frontend).tag(sync=True)

    format = Unicode('webm', help='The format of the recording (e.g. webm/mp4).').tag(sync=True)

    @validate('stream')
    def _valid_stream(self, proposal):
        stream = proposal['value']
        if not (isinstance(stream, VideoStream) or
                isinstance(stream, WidgetStream) or
                isinstance(stream, CameraStream) or
                isinstance(stream, ImageStream)):
            raise TraitError('Cannot record a video from {} instance'.format())
        return proposal['value']

    def get_record(self):
        #  Better to create Video "from data" instead of "from url" in case the
        #  url gets revoked
        return Video(value=self.data, format=self.format, controls=True)


# monkey patch, same as https://github.com/jupyter-widgets/ipywidgets/pull/2146
if 'from_json' not in widgets.Image.value.metadata:
    widgets.Image.value.metadata['from_json'] = lambda js, obj: None if js is None else js.tobytes()


# @register
# class MediaImageRecorder(DOMWidget):
#     """Creates a recorder which allows to grab an Image from a MediaStream widget.
#     """
#     _model_module = Unicode('jupyter-webrtc').tag(sync=True)
#     _view_module = Unicode('jupyter-webrtc').tag(sync=True)
#     _model_name = Unicode('MediaImageRecorderModel').tag(sync=True)
#     _view_name = Unicode('MediaImageRecorderView').tag(sync=True)
#     _view_module_version = Unicode(semver_range_frontend).tag(sync=True)
#     _model_module_version = Unicode(semver_range_frontend).tag(sync=True)
#
#     stream = Instance(MediaStream, allow_none=True,
#          help=MediaRecorder.stream.metadata['help'])\
#         .tag(sync=True, **widget_serialization)
#     image = Instance(Image, help='An instance of ipywidgets.Image that will receive the grabbed image.',
#         allow_none=True).tag(sync=True, **widget_serialization)
#     filename = Unicode('recording', help=MediaRecorder.filename.metadata['help']).tag(sync=True)
#     autosave = Bool(False, help=MediaRecorder.autosave.metadata['help'])
#
#     def __init__(self, **kwargs):
#         super(MediaImageRecorder, self).__init__(**kwargs)
#         self.image.observe(self._check_autosave, 'value')
#
#     @observe('image')
#     def _bind_image(self, change):
#         if change.old:
#             change.old.unobserve(self._check_autosave, 'value')
#         change.new.observe(self._check_autosave, 'value')
#
#     def _check_autosave(self, change):
#         if len(self.image.value) and self.autosave:
#             self.save()
#
#     @traitlets.default('image')
#     def _default_image(self):
#         return Image()
#
#     def grab(self):
#         self.send({'msg': 'grab'})
#
#     def download(self):
#         self.send({'msg': 'download'})
#
#     def save(self, filename=None):
#         """Save the data to a file, if no filename is given it is based on the filename trait and the image.format.
#
#         >>> recorder = MediaImageRecorder(filename='test', format='png')
#         >>> ...
#         >>> recorder.save()  # will save to test.png
#         >>> recorder.save('foo')  # will save to foo.png
#         >>> recorder.save('foo.dat')  # will save to foo.dat
#
#         """
#         filename = filename or self.filename
#         if '.' not in filename:
#             filename += '.' + self.image.format
#         if len(self.image.value) == 0:
#             raise ValueError('No data, did you record anything?')
#         with open(filename, 'wb') as f:
#             f.write(self.image.value)


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
