from releash import *
import glob
# these objects only tag when they are exe
gitpush = ReleaseTargetGitPush()


filenames_python = glob.glob('*')
filenames_python.remove('js')
# filenames_python.remove('notebooks')
package_python = add_package(".", "py", distribution_name='ipywebrtc', filenames=filenames_python)

version_python = VersionSource(package_python, '{path}/ipywebrtc/_version.py')
gittag = ReleaseTargetGitTagVersion(version_source=version_python)

package_python.version_source = version_python
package_python.version_targets.append(VersionTarget(package_python, '{path}/ipywebrtc/_version.py'))

package_python.release_targets.append(gittag)
package_python.release_targets.append(ReleaseTargetSourceDist(package_python))
#core.release_targets.append(gitpush)
#package_python.release_targets.append(ReleaseTargetCondaForge(package_python, '../feedstocks/ipywebrtc-feedstock'))


# js part
package_js = add_package("js", "js", distribution_name='ipywebrtc')

version_js = VersionSource(package_js, '{path}/../ipywebrtc/_version.py', tuple_variable_name='__version_tuple_js__')

package_js.version_source = version_js
package_js.version_targets.append(VersionTarget(package_js, '{path}/../ipywebrtc/_version.py',
                                  tuple_variable_name='__version_tuple_js__',
                                  string_variable_name='__version_js__'))
package_js.version_targets.append(VersionTargetJson(package_js, '{path}/package.json'))

gittag_js = ReleaseTargetGitTagVersion(version_source=version_js, postfix='_js')
package_js.release_targets.append(gittag_js)
package_js.release_targets.append(ReleaseTargetNpm(package_js))
#core.release_targets.append(gitpush)
#package_python.release_targets.append(ReleaseTargetCondaForge(package_python, '../feedstocks/ipyvolume-feedstock'))

