# ipywebrtc

[![Travis](https://travis-ci.org/maartenbreddels/ipywebrtc.svg?branch=master)](https://travis-ci.org/maartenbreddels/ipywebrtc)
[![Documentation](https://readthedocs.org/projects/ipywebrtc/badge/?version=latest)](https://ipywebrtc.readthedocs.io/en/latest/)
[![Binder](https://mybinder.org/badge.svg)](https://mybinder.org/v2/gh/maartenbreddels/ipywebrtc/master?filepath=docs/source)
[![Chat](https://badges.gitter.im/Join%20Chat.svg)](https://gitter.im/jupyter-widgets/Lobby)

WebRTC and MediaStream API exposed in the Jupyter notebook/lab.

[See this tweet](https://twitter.com/maartenbreddels/status/1027995865024262144) for a demo screencast.


# Why use ipywebrtc?

Using ipywebrtc you can create a [MediaStream](api.html#ipywebrtc.webrtc.MediaStream) out of:
 * [Any ipywidget](https://ipywebrtc.readthedocs.io/en/latest/api.html#ipywebrtc.webrtc.WidgetStream).
 * A [video](https://ipywebrtc.readthedocs.io/en/latest/api.html#ipywebrtc.webrtc.VideoStream) file.
 * An [image](https://ipywebrtc.readthedocs.io/en/latest/api.html#ipywebrtc.webrtc.ImageStream) file.
 * An [audio](https://ipywebrtc.readthedocs.io/en/latest/api.html#ipywebrtc.webrtc.AudioStream) file.
 * Your [webcam/camera](https://ipywebrtc.readthedocs.io/en/latest/api.html#ipywebrtc.webrtc.CameraStream).

From this MediaStream you can:

 * [Record a movie](https://ipywebrtc.readthedocs.io/en/latest/api.html#ipywebrtc.webrtc.VideoRecorder).
 * [Record an image snapshot](https://ipywebrtc.readthedocs.io/en/latest/api.html#ipywebrtc.webrtc.ImageRecorder).
 * [Record an audio fragment](https://ipywebrtc.readthedocs.io/en/latest/api.html#ipywebrtc.webrtc.AudioRecorder).
 * Stream it to peers using the simple [chat function](https://ipywebrtc.readthedocs.io/en/latest/api.html#ipywebrtc.chat)
 * [Use it as a texture in ipyvolume](https://twitter.com/maartenbreddels/status/894983501996584961) 


# Demos

## WebRTC and [ipyvolume](https://github.com/maartenbreddels/ipyvolume/)
Use remote MediaStreams and show them in 3d using [ipyvolume](https://github.com/maartenbreddels/ipyvolume/).

![webrtc](https://user-images.githubusercontent.com/1765949/43977008-03dbfac0-9ce3-11e8-9bb9-4a5f8f2cc79a.gif)

## ImageRecorder

Record and image from *any* stream for postprocessing.

![recorder](https://user-images.githubusercontent.com/1765949/43978560-fe0bf500-9ce7-11e8-81b9-9d30d26d7492.gif)

## WidgetStream

Turn *any* widget into a MediaStream.

![widget-stream](https://user-images.githubusercontent.com/1765949/43977992-1668d534-9ce6-11e8-8fab-783105476e98.gif)

# Installation


To install:

```
$ pip install ipywebrtc                             # will auto enable for notebook >= 5.3
$ jupyter labextension install jupyter-webrtc       # for jupyter lab
```

For a development installation (requires npm),

```
$ git clone https://github.com/maartenbreddels/ipywebrtc
$ cd ipywebrtc
$ pip install -e .
$ jupyter nbextension install --py --symlink --sys-prefix ipywebrtc
$ jupyter nbextension enable --py --sys-prefix ipywebrtc
$ jupyter labextension link js
$ jupyter lab --watch  # for quick rebuilds
```
