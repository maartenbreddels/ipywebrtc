ipywebrtc
===============================

WebRTC for Jupyter notebook/lab

Installation
------------

To install use pip:

    $ pip install ipywebrtc
    $ jupyter nbextension enable --py --sys-prefix ipywebrtc


For a development installation (requires npm),

    $ git clone https://github.com/maartenbreddels/ipywebrtc.git
    $ cd ipywebrtc
    $ pip install -e .
    $ jupyter nbextension install --py --symlink --sys-prefix ipywebrtc
    $ jupyter nbextension enable --py --sys-prefix ipywebrtc
