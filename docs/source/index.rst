.. ipywebrtc documentation master file, created by
   sphinx-quickstart on Thu Aug 10 19:59:03 2017.
   You can adapt this file completely to your liking, but it should at least
   contain the root `toctree` directive.

Welcome to IPyWebRTC's documentation!
=====================================

WebRTC and MediaStream API exposed in the Jupyter notebook/lab.

Using ipywebrtc you can create a `MediaStream <api.html#ipywebrtc.webrtc.MediaStream>`_ out of:
 * `Any ipywidget <https://ipywebrtc.readthedocs.io/en/latest/api.html#ipywebrtc.webrtc.WidgetStream>`_.
 * A `video <https://ipywebrtc.readthedocs.io/en/latest/api.html#ipywebrtc.webrtc.VideoStream>`_ file.
 * An `image <https://ipywebrtc.readthedocs.io/en/latest/api.html#ipywebrtc.webrtc.ImageStream>`_ file.
 * An `audio <https://ipywebrtc.readthedocs.io/en/latest/api.html#ipywebrtc.webrtc.AudioStream>`_ file.
 * Your `webcam/camera <https://ipywebrtc.readthedocs.io/en/latest/api.html#ipywebrtc.webrtc.CameraStream>`_.

From this MediaStream you can:

 * `Record a movie <https://ipywebrtc.readthedocs.io/en/latest/api.html#ipywebrtc.webrtc.VideoRecorder>`_.
 * `Record an image snapshot <https://ipywebrtc.readthedocs.io/en/latest/api.html#ipywebrtc.webrtc.ImageRecorder>`_.
 * `Record an audio fragment <https://ipywebrtc.readthedocs.io/en/latest/api.html#ipywebrtc.webrtc.AudioRecorder>`_.
 * Stream it to peers using the simple `chat function <https://ipywebrtc.readthedocs.io/en/latest/api.html#ipywebrtc.chat>`_.
 * `Use it as a texture in ipyvolume <https://twitter.com/maartenbreddels/status/894983501996584961>`_.


Installation
============

Pip users::

  $ pip install ipywebrtc                             # will auto enable for notebook >= 5.3
  $ jupyter labextension install jupyterlab-webrtc    # for jupyter lab


Conda users::

  $ conda install -c conda-forge ipywebrtc
  $ jupyter labextension install jupyterlab-webrtc    # for jupyter lab





.. toctree::
   :maxdepth: 2
   :caption: Examples and API docs:

   VideoStream.ipynb
   CameraStream.ipynb
   AudioStream.ipynb
   WidgetStream.ipynb
   VideoRecorder.ipynb
   ImageRecorder.ipynb
   AudioRecorder.ipynb
   api



Indices and tables
==================

* :ref:`genindex`
* :ref:`modindex`
* :ref:`search`
