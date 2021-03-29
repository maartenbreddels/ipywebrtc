from __future__ import print_function
from setuptools import setup, find_packages
import os
from os.path import join as pjoin

from jupyter_packaging import (
    create_cmdclass,
    install_npm,
    ensure_targets,
    combine_commands,
    get_version,
    skip_if_exists,
)

name = 'ipywebrtc'
here = os.path.dirname(os.path.abspath(__file__))
node_root = os.path.join(here, 'js')
is_repo = os.path.exists(os.path.join(here, '.git'))

npm_path = os.pathsep.join([
    os.path.join(node_root, 'node_modules', '.bin'),
                os.environ.get('PATH', os.defpath),
])


LONG_DESCRIPTION = 'WebRTC for Jupyter notebook/lab'
version = get_version(pjoin(name, '_version.py'))

js_dir = pjoin(here, 'js')

# Representative files that should exist after a successful build
jstargets = [
    pjoin('share', 'jupyter', 'nbextensions', 'jupyter-webrtc', 'index.js'),
    pjoin('share', 'jupyter', 'labextensions', 'jupyter-webrtc', 'package.json'),
]

data_files_spec = [
    ('share/jupyter/nbextensions/jupyter-webrtc', 'share/jupyter/nbextensions/jupyter-webrtc', '*.js'),
    ('share/jupyter/labextensions/jupyter-webrtc/', 'share/jupyter/labextensions/jupyter-webrtc/', '**'),
    ('etc/jupyter/nbconfig/notebook.d', 'etc/jupyter/nbconfig/notebook.d', 'jupyter-webrtc.json'),
]

js_command = combine_commands(
    install_npm(js_dir, build_dir='share/jupyter/', source_dir='js/src', build_cmd='build'), ensure_targets(jstargets),
)

cmdclass = create_cmdclass('jsdeps', data_files_spec=data_files_spec)
is_repo = os.path.exists(os.path.join(here, '.git'))
if is_repo:
    cmdclass['jsdeps'] = js_command
else:
    cmdclass['jsdeps'] = skip_if_exists(jstargets, js_command)

setup(
    name='ipywebrtc',
    version=version,
    description='WebRTC for Jupyter notebook/lab',
    long_description=LONG_DESCRIPTION,
    license='MIT',
    include_package_data=True,
    install_require=[
        'ipywidgets>=7.4.0',
    ],
    packages=find_packages(),
    zip_safe=False,
    cmdclass=cmdclass,
    author='Maarten Breddels',
    author_email='maartenbreddels@gmail.com',
    url='https://github.com/maartenbreddels/ipywebrtc',
    keywords=[
        'ipython',
        'jupyter',
        'widgets',
    ],
    classifiers=[
        'Development Status :: 4 - Beta',
        'Framework :: IPython',
        'Intended Audience :: Developers',
        'Intended Audience :: Science/Research',
        'Topic :: Multimedia :: Graphics',
        'Programming Language :: Python :: 2',
        'Programming Language :: Python :: 2.7',
        'Programming Language :: Python :: 3',
        'Programming Language :: Python :: 3.3',
        'Programming Language :: Python :: 3.4',
        'Programming Language :: Python :: 3.5',
    ],
)
