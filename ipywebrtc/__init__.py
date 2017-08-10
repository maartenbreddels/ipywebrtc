from ._version import version_info, __version__

from .webrtc import *

def _jupyter_nbextension_paths():
    return [{
        'section': 'notebook',
        'src': 'static',
        'dest': 'jupyter-webrtc',
        'require': 'jupyter-webrtc/extension'
    }]
