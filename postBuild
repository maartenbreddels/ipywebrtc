#!/bin/bash
# this is used by repo2docker to do labextension stuff without a `Dockerfile`.
#
# it will run after a successful installation of `environment.yml`

set -ex
pushd js
npm install
popd

pip install -e .

# classic
jupyter nbextension install ipywebrtc --py --sys-prefix --symlink
jupyter nbextension enable ipywebrtc --py --sys-prefix
