#!/bin/bash
# this is used by repo2docker to do labextension stuff without a dockerfile
set -ex
pushd js
npm install
popd

pip install -e .

# classic
jupyter nbextension install --py --symlink --sys-prefix ipywebrtc
jupyter nbextension enable --py --sys-prefix ipywebrtc
