.. ipywebrtc documentation master file, created by
   sphinx-quickstart on Thu Aug 10 19:59:03 2017.
   You can adapt this file completely to your liking, but it should at least
   contain the root `toctree` directive.

Welcome to IPyWebRTC's documentation!
=====================================

IPyWebRTC gives you WebRTC IPython widgets in the Jupyter notebook.

.. ipywidgets-display::
    import ipywebrtc
    video = ipywebrtc.VideoStream(url='https://webrtc.github.io/samples/src/video/chrome.mp4', play=True)
    video


Since video is a widget, we can control the play property using a toggle button.

.. ipywidgets-display::
    import ipywebrtc
    import ipywidgets as widgets
    video = ipywebrtc.VideoStream(url='https://webrtc.github.io/samples/src/video/chrome.mp4', play=True)
    play_button = widgets.ToggleButton(description="Play")
    widgets.jslink((play_button, 'value'), (video, 'play'))
    widgets.VBox(children=[video, play_button])

Camera stream:

.. ipywidgets-display::
    import ipywebrtc
    ipywebrtc.CameraStream()

Making a 'chat room'

.. ipywidgets-display::
    import ipywebrtc
    import ipywidgets as widgets
    camera = ipywebrtc.CameraStream()
    room = ipywebrtc.WebRTCRoomMqtt(stream=camera, room='readthedocs')
    room.stream

.. toctree::
   :maxdepth: 2
   :caption: Contents:




Indices and tables
==================

* :ref:`genindex`
* :ref:`modindex`
* :ref:`search`
