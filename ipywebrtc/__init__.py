import random

import ipywidgets as widgets
from IPython.display import display

from ._version import __version__, version_info
from .webrtc import (
    AudioRecorder,
    AudioStream,
    CameraStream,
    ImageRecorder,
    ImageStream,
    VideoRecorder,
    VideoStream,
    WebRTCPeer,
    WebRTCRoom,
    WebRTCRoomLocal,
    WebRTCRoomMqtt,
    WidgetStream,
)


def _prefix():
    import sys
    from pathlib import Path

    prefix = sys.prefix
    here = Path(__file__).parent
    # for when in dev mode
    if (here.parent / "share/jupyter/nbextensions/jupyter-webrtc").parent.exists():
        prefix = here.parent
    return prefix


def _jupyter_labextension_paths():
    return [
        {
            "src": f"{_prefix()}/share/jupyter/labextensions/jupyter-webrtc/",
            "dest": "jupyter-webrtc",
        }
    ]


def _jupyter_nbextension_paths():
    return [
        {
            "section": "notebook",
            "src": f"{_prefix()}/share/jupyter/nbextensions/jupyter-webrtc/",
            "dest": "jupyter-webrtc",
            "require": "jupyter-webrtc/extension",
        }
    ]


def _random_room():
    return "".join(chr(ord("0") + random.randint(0, 9)) for k in range(6))


def chat(room=None, stream=None, **kwargs):
    """Quick setup for a chatroom.

    :param str room: Roomname, if not given, a random sequence is generated and printed.
    :param MediaStream stream: The media stream to share, if not given a CameraStream will be created.
    :rtype: WebRTCRoom

    """
    if room is None:
        room = _random_room()
        print("room =", room)
    if stream is None:
        stream = CameraStream()
    room = WebRTCRoomMqtt(stream=stream, room=room)
    box = widgets.HBox(children=[])
    widgets.jslink((room, "streams"), (box, "children"))
    display(box)
    return room
