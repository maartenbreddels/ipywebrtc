export function download(data, filename) {
  let a = document.createElement("a");
  a.download = filename;
  a.href = data;
  // see https://stackoverflow.com/questions/18480474/how-to-save-an-image-from-canvas
  if (document.createEvent) {
    let e = document.createEvent("MouseEvents");
    e.initMouseEvent(
      "click",
      true,
      true,
      window,
      0,
      0,
      0,
      0,
      0,
      false,
      false,
      false,
      false,
      0,
      null
    );

    a.dispatchEvent(e);
  } else if (lnk.fireEvent) {
    a.fireEvent("onclick");
  }
}

export function downloadBlob(blob, filename) {
  let url = window.URL.createObjectURL(blob);
  download(url, filename);
  setTimeout(function () {
    window.URL.revokeObjectURL(url);
  }, 100);
}

export async function onCanPlay(videoElement) {
  // wait till a video element is ready to play, and can be drawn on a canvas
  return new Promise((resolve, reject) => {
    // see https://github.com/webrtc/samples/pull/853
    if (videoElement.readyState >= 3) {
      resolve();
    } else {
      videoElement.addEventListener("canplay", resolve);
      videoElement.addEventListener("error", (event) =>
        reject(new Error("cannot play video stream"))
      );
    }
  });
}

export async function onLoadedMetaData(videoElement) {
  // before the event is fired, videoHeight might be 0
  // see https://stackoverflow.com/questions/4129102/html5-video-dimensions
  return new Promise((resolve, reject) => {
    if (videoElement.videoHeight > 0) resolve();
    else videoElement.addEventListener("loadedmetadata", resolve);
  });
}

export async function canvasToBlob(canvas, mimeType) {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => resolve(blob), mimeType);
  });
}
export async function blobToBytes(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsArrayBuffer(blob);
    reader.onloadend = () => {
      const bytes = new Uint8Array(reader.result);
      resolve(bytes);
    };
  });
}
export async function imageWidgetToCanvas(widget, canvas) {
  // this code should move to jupyter-widgets's ImageModel widget, so all this logic is in one place
  // returns when the image is drawn on the canvas
  let url;
  let format = widget.get("format");
  let value = widget.get("value");
  if (format !== "url") {
    let blob = new Blob([value], { type: `image/${widget.get("format")}` });
    url = URL.createObjectURL(blob);
  } else {
    url = new TextDecoder("utf-8").decode(value.buffer);
  }

  let el = document.createElement("img");
  el.src = url;
  let width = widget.get("width");
  if (width !== undefined && width.length > 0) {
    el.setAttribute("width", width);
  } else {
    el.removeAttribute("width");
  }

  let height = widget.get("height");
  if (height !== undefined && height.length > 0) {
    el.setAttribute("height", height);
  } else {
    el.removeAttribute("height");
  }
  let context = canvas.getContext("2d");
  context.drawImage(el, 0, 0);
  return new Promise((resolve, reject) => {
    el.onload = () => {
      canvas.width = el.width;
      canvas.height = el.height;
      context.drawImage(el, 0, 0);
      if (typeof oldurl !== "string") {
        URL.revokeObjectURL(url);
      }
      resolve();
    };
  });
}
