import random
from IPython.display import display
import ipywidgets as widgets
from ._version import version_info, __version__
from .webrtc import *


def _jupyter_nbextension_paths():
    return [{
        'section': 'notebook',
        'src': 'static',
        'dest': 'jupyter-webrtc',
        'require': 'jupyter-webrtc/extension'
    }]


def _random_room():
    return "".join(chr(ord('0')+random.randint(0, 9)) for k in range(6))


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
    widgets.jslink((room, 'streams'), (box, 'children'))
    display(box)
    return room
