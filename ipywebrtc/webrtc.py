from __future__ import absolute_import
import os
import logging
try:
    from urllib import urlopen  # py2
except ImportError:
    from urllib.request import urlopen  # py3
from traitlets import (
    observe,
    Bool, Bytes, Dict, Instance, Int, List, TraitError, Unicode, validate,
    Undefined
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
       * :class:`ImageRecorder`: To create images/snapshots.
       * :class:`AudioRecorder`: To record audio.
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
    _html2canvas_start_streaming = Bool(False).tag(sync=True)

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

    @classmethod
    def from_download(cls, url, **kwargs):
        """Create a `ImageStream` from a url by downloading
        Parameters
        ----------
        url: str
            The url of the file that will be downloadeded and its bytes
            assigned to the value trait of the video trait.
        **kwargs:
            Extra keyword arguments for `ImageStream`
        Returns an `ImageStream` with the value set from the content of a url.
        """
        ext = os.path.splitext(url)[1]
        if ext:
            format = ext[1:]
        image = Image(value=urlopen(url).read(), format=format)
        return cls(image=image, **kwargs)


@register
class VideoStream(MediaStream):
    """Represent a stream of a video element"""
    _model_name = Unicode('VideoStreamModel').tag(sync=True)

    video = Instance(
        Video,
        allow_none=False,
        help="An ipywidgets.Video instance that will be the source of the media stream."
    ).tag(sync=True, **widget_serialization)
    playing = Bool(True, help='Plays the videostream or pauses it.').tag(sync=True)

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
        video = Video.from_file(filename, autoplay=False, controls=False)
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
        video = Video.from_url(url, autoplay=False, controls=False)
        return cls(video=video, **kwargs)

    @classmethod
    def from_download(cls, url, **kwargs):
        """Create a `VideoStream` from a url by downloading
        Parameters
        ----------
        url: str
            The url of the file that will be downloadeded and its bytes
            assigned to the value trait of the video trait.
        **kwargs:
            Extra keyword arguments for `VideoStream`
        Returns an `VideoStream` with the value set from the content of a url.
        """
        ext = os.path.splitext(url)[1]
        if ext:
            format = ext[1:]
        video = Video(value=urlopen(url).read(), format=format, autoplay=False, controls=False)
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
    playing = Bool(True, help='Plays the audiostream or pauses it.').tag(sync=True)

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
        audio = Audio.from_file(filename, autoplay=False, controls=False)
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
        audio = Audio.from_url(url, autoplay=False, controls=False)
        return cls(audio=audio, **kwargs)

    @classmethod
    def from_download(cls, url, **kwargs):
        """Create a `AudioStream` from a url by downloading
        Parameters
        ----------
        url: str
            The url of the file that will be downloadeded and its bytes
            assigned to the value trait of the video trait.
        **kwargs:
            Extra keyword arguments for `AudioStream`
        Returns an `AudioStream` with the value set from the content of a url.
        """
        ext = os.path.splitext(url)[1]
        if ext:
            format = ext[1:]
        audio = Audio(value=urlopen(url).read(), format=format, autoplay=False, controls=False)
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


class Recorder(DOMWidget):
    _model_module = Unicode('jupyter-webrtc').tag(sync=True)
    _view_module = Unicode('jupyter-webrtc').tag(sync=True)
    _view_module_version = Unicode(semver_range_frontend).tag(sync=True)
    _model_module_version = Unicode(semver_range_frontend).tag(sync=True)

    stream = Instance(MediaStream, allow_none=True, help="An instance of :class:`MediaStream` that is the source for recording.")\
                .tag(sync=True, **widget_serialization)
    filename = Unicode('record', help='The filename used for downloading or auto saving.').tag(sync=True)
    format = Unicode('webm', help='The format of the recording.').tag(sync=True)
    recording = Bool(False, help='(boolean) Indicator and controller of the recorder state, i.e. putting the value to True will start recording.').tag(sync=True)
    autosave = Bool(False, help='If true, will save the data to a file once the recording is finished (based on filename and format)').tag(sync=True)
    _data_src = Unicode('').tag(sync=True)

    def download(self):
        """Download the recording (usually a popup appears in the browser)"""
        self.send({'msg': 'download'})


@register
class ImageRecorder(Recorder):
    """Creates a recorder which allows to grab an Image from a MediaStream widget.
    """
    _model_name = Unicode('ImageRecorderModel').tag(sync=True)
    _view_name = Unicode('ImageRecorderView').tag(sync=True)

    image = Instance(Image).tag(sync=True, **widget_serialization)
    format = Unicode('png', help='The format of the image.').tag(sync=True)
    _width = Unicode().tag(sync=True)
    _height = Unicode().tag(sync=True)

    def __init__(self, format='png', filename=Recorder.filename.default_value, recording=False, autosave=False, **kwargs):
        super(ImageRecorder, self).__init__(
            format=format, filename=filename, recording=recording, autosave=autosave, **kwargs)
        if 'image' not in kwargs:
            # Set up initial observer on child:
            self.image.observe(self._check_autosave, 'value')

    @traitlets.default('image')
    def _default_image(self):
        return Image(width=self._width, height=self._height, format=self.format)

    @observe('_width')
    def _update_image_width(self, change):
        self.image.width = self._width

    @observe('_height')
    def _update_image_height(self, change):
        self.image.height = self._height

    @observe('format')
    def _update_image_format(self, change):
        self.image.format = self.format

    @observe('image')
    def _bind_image(self, change):
        if change.old:
            change.old.unobserve(self._check_autosave, 'value')
        change.new.observe(self._check_autosave, 'value')

    def _check_autosave(self, change):
        if len(self.image.value) and self.autosave:
            self.save()

    def save(self, filename=None):
        """Save the image to a file, if no filename is given it is based on the filename trait and the format.

        >>> recorder = ImageRecorder(filename='test', format='png')
        >>> ...
        >>> recorder.save()  # will save to test.png
        >>> recorder.save('foo')  # will save to foo.png
        >>> recorder.save('foo.dat')  # will save to foo.dat

        """
        filename = filename or self.filename
        if '.' not in filename:
            filename += '.' + self.format
        if len(self.image.value) == 0:
            raise ValueError('No data, did you record anything?')
        with open(filename, 'wb') as f:
            f.write(self.image.value)


@register
class VideoRecorder(Recorder):
    """Creates a recorder which allows to record a MediaStream widget, play the
    record in the Notebook, and download it or turn it into a Video widget.

    For help on supported values for the "codecs" attribute, see
    https://stackoverflow.com/questions/41739837/all-mime-types-supported-by-mediarecorder-in-firefox-and-chrome
    """
    _model_name = Unicode('VideoRecorderModel').tag(sync=True)
    _view_name = Unicode('VideoRecorderView').tag(sync=True)

    video = Instance(Video).tag(sync=True, **widget_serialization)
    codecs = Unicode('', help='Optional codecs for the recording, e.g. "vp8" or "vp9, opus".').tag(sync=True)

    def __init__(self, format='webm', filename=Recorder.filename.default_value, recording=False, autosave=False, **kwargs):
        super(VideoRecorder, self).__init__(
            format=format, filename=filename, recording=recording, autosave=autosave, **kwargs)
        if 'video' not in kwargs:
            # Set up initial observer on child:
            self.video.observe(self._check_autosave, 'value')

    @traitlets.default('video')
    def _default_video(self):
        return Video(format=self.format, controls=True)

    @observe('format')
    def _update_video_format(self, change):
        self.video.format = self.format

    @observe('video')
    def _bind_video(self, change):
        if change.old:
            change.old.unobserve(self._check_autosave, 'value')
        change.new.observe(self._check_autosave, 'value')

    def _check_autosave(self, change):
        if len(self.video.value) and self.autosave:
            self.save()

    def save(self, filename=None):
        """Save the video to a file, if no filename is given it is based on the filename trait and the format.

        >>> recorder = VideoRecorder(filename='test', format='mp4')
        >>> ...
        >>> recorder.save()  # will save to test.mp4
        >>> recorder.save('foo')  # will save to foo.mp4
        >>> recorder.save('foo.dat')  # will save to foo.dat

        """
        filename = filename or self.filename
        if '.' not in filename:
            filename += '.' + self.format
        if len(self.video.value) == 0:
            raise ValueError('No data, did you record anything?')
        with open(filename, 'wb') as f:
            f.write(self.video.value)


@register
class AudioRecorder(Recorder):
    """Creates a recorder which allows to record the Audio of a MediaStream widget, play the
    record in the Notebook, and download it or turn it into an Audio widget.

    For help on supported values for the "codecs" attribute, see
    https://stackoverflow.com/questions/41739837/all-mime-types-supported-by-mediarecorder-in-firefox-and-chrome
    """
    _model_name = Unicode('AudioRecorderModel').tag(sync=True)
    _view_name = Unicode('AudioRecorderView').tag(sync=True)

    audio = Instance(Audio).tag(sync=True, **widget_serialization)
    codecs = Unicode('', help='Optional codecs for the recording, e.g. "opus".').tag(sync=True)

    def __init__(self, format='webm', filename=Recorder.filename.default_value, recording=False, autosave=False, **kwargs):
        super(AudioRecorder, self).__init__(
            format=format, filename=filename, recording=recording, autosave=autosave, **kwargs)
        if 'audio' not in kwargs:
            # Set up initial observer on child:
            self.audio.observe(self._check_autosave, 'value')

    @traitlets.default('audio')
    def _default_audio(self):
        return Audio(format=self.format, controls=True)

    @observe('format')
    def _update_audio_format(self, change):
        self.audio.format = self.format

    @observe('audio')
    def _bind_audio(self, change):
        if change.old:
            change.old.unobserve(self._check_autosave, 'value')
        change.new.observe(self._check_autosave, 'value')

    def _check_autosave(self, change):
        if len(self.audio.value) and self.autosave:
            self.save()

    def save(self, filename=None):
        """Save the audio to a file, if no filename is given it is based on the filename trait and the format.

        >>> recorder = AudioRecorder(filename='test', format='mp3')
        >>> ...
        >>> recorder.save()  # will save to test.mp3
        >>> recorder.save('foo')  # will save to foo.mp3
        >>> recorder.save('foo.dat')  # will save to foo.dat

        """
        filename = filename or self.filename
        if '.' not in filename:
            filename += '.' + self.format
        if len(self.audio.value) == 0:
            raise ValueError('No data, did you record anything?')
        with open(filename, 'wb') as f:
            f.write(self.audio.value)


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
    room_id = Unicode(read_only=True).tag(sync=True)
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
