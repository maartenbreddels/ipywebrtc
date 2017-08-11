.. ipywebrtc documentation master file, created by
   sphinx-quickstart on Thu Aug 10 19:59:03 2017.
   You can adapt this file completely to your liking, but it should at least
   contain the root `toctree` directive.

Welcome to IPyWebRTC's documentation!
=====================================

IPyWebRTC gives you WebRTC IPython widgets in the Jupyter notebook.

Making a stream out of a video `ipyvolume.mp4 <ipyvolume.mp4>`_ (can be a same origin file for firefox only)


.. ipywidgets-display::
    import ipywebrtc
    video = ipywebrtc.VideoStream(url='ipyvolume.mp4', play=True)
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
    box = widgets.HBox(children=[])
    widgets.jslink((room, 'streams'), (box, 'children'))
    box

Using a video as source stream instead of the camera (joining the same room)

.. ipywidgets-display::
    import ipywebrtc
    import ipywidgets as widgets
    video = ipywebrtc.VideoStream(url='ipyvolume.mp4', play=True)
    room = ipywebrtc.WebRTCRoomMqtt(stream=video, room='readthedocs')
    box = widgets.HBox(children=[])
    widgets.jslink((room, 'streams'), (box, 'children'))
    box

.. toctree::
   :maxdepth: 2
   :caption: Contents:




Indices and tables
==================

* :ref:`genindex`
* :ref:`modindex`
* :ref:`search`
