import playwright.sync_api
from IPython.display import display


def test_stream(ipywidgets_runner, page_session: playwright.sync_api.Page, assert_solara_snapshot):
    def kernel_code():
        from ipywebrtc import VideoStream

        videoStream = VideoStream.from_file("./Big.Buck.Bunny.mp4")
        display(videoStream)

    ipywidgets_runner(kernel_code)
    vid = page_session.locator(".video-stream").wait_for()
    playwright.sync_api.expect(vid).to_be_visible().wait_for()
