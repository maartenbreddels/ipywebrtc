.. ipywebrtc documentation master file, created by
   sphinx-quickstart on Thu Aug 10 19:59:03 2017.
   You can adapt this file completely to your liking, but it should at least
   contain the root `toctree` directive.

Welcome to IPyWebRTC's documentation!
=====================================

IPyWebRTC gives you WebRTC IPython widgets in the Jupyter notebook.

Making a stream out of a video `ipyvolume.mp4 <ipyvolume.mp4>`_ (can be a same origin file for firefox only)


.. ipywidgets-display::
    from ipywebrtc import VideoStream
    video = VideoStream.from_file('ipyvolume.mp4', play=True)
    video


Since video is a widget, we can control the play property using a toggle button.

.. ipywidgets-display::
    from ipywebrtc import VideoStream
    import ipywidgets as widgets
    video = VideoStream.from_file('ipyvolume.mp4', play=True)
    play_button = widgets.ToggleButton(description="Play")
    widgets.jslink((play_button, 'value'), (video, 'play'))
    widgets.VBox(children=[video, play_button])

Media recorder:

.. ipywidgets-display::
    from ipywebrtc import VideoStream, MediaRecorder
    video = VideoStream.from_file('ipyvolume.mp4', play=True)
    recorder = MediaRecorder(source=video)
    recorder

Camera stream (we can use camera facing user or facing environment):

.. ipywidgets-display::
    from ipywebrtc import CameraStream
    CameraStream.facing_user()

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
    video = ipywebrtc.VideoStream.from_file('ipyvolume.mp4', play=True)
    room = ipywebrtc.WebRTCRoomMqtt(stream=video, room='readthedocs')
    box = widgets.HBox(children=[])
    widgets.jslink((room, 'streams'), (box, 'children'))
    box

.. toctree::
   :maxdepth: 2
   :caption: Contents:

   VideoStream.ipynb
   CameraStream.ipynb
   MediaRecorder.ipynb
   MediaImageRecorder.ipynb
   api



Indices and tables
==================

* :ref:`genindex`
* :ref:`modindex`
* :ref:`search`
