// some helper functions to quickly create widgets

export async function create_model_webrtc(
  manager,
  name: string,
  id: string,
  args = {}
) {
  return create_model(
    manager,
    "jupyter-webrtc",
    `${name}Model`,
    name,
    id,
    args
  );
}

export async function create_model(
  manager,
  module: string,
  model: string,
  view: string,
  id: string,
  args = {}
) {
  let model_widget = await manager.new_widget(
    {
      model_module: module,
      model_name: model,
      model_module_version: "*",
      view_module: module,
      view_name: view,
      view_module_version: "*",
      model_id: id,
    },
    args
  );
  return model_widget;
}

export async function create_view(manager, model, options = {}) {
  let view = await manager.create_view(model, options);
  return view;
}

declare function require(string): string;

export async function create_video_stream(manager, id: string, options = {}) {
  let video_data: any = require("arraybuffer-loader!../../../docs/source/Big.Buck.Bunny.mp4");
  // let ivideoModel = await create_model(manager, '@jupyter-widgets/controls', 'VideoModel', 'VideoView', id, {value: {buffer: new DataView((new Uint8Array(video_data)).buffer)}, format: 'mp4'});
  // let ivideoModel = await create_model(manager, '@jupyter-widgets/controls', 'VideoModel', 'VideoView', id, {value: new Uint8Array(video_data), format: 'mp4'});
  let videoModel = await create_model(
    manager,
    "@jupyter-widgets/controls",
    "VideoModel",
    "VideoView",
    id,
    { value: new DataView(new Uint8Array(video_data).buffer), format: "mp4" }
  );
  return await create_model_webrtc(manager, "VideoStream", "vs1", {
    video: `IPY_MODEL_${id}`,
  });
}

let image_data: any = require("arraybuffer-loader!../../test/jupyter.jpg");
export { image_data };

export async function create_image_stream(manager, id: string, options = {}) {
  let imageModel = await create_model(
    manager,
    "@jupyter-widgets/controls",
    "ImageModel",
    "imageView",
    `im_${id}`,
    { value: new DataView(new Uint8Array(image_data).buffer), format: "png" }
  );
  return await create_model_webrtc(manager, "ImageStream", id, {
    image: `IPY_MODEL_im_${id}`,
  });
}

/*
export
async function create_widget(manager, name: string, id: string, args: Object) {
    let model = await create_model_bqplot(manager, name, id, args)
    let view = await manager.create_view(model);
    await manager.display_view(undefined, view);
    return {model: model, view:view};
}

export
async function create_figure_scatter(manager, x, y) {
    let layout = await create_model(manager, '@jupyter-widgets/base', 'LayoutModel', 'LayoutView', 'layout_figure1', {_dom_classes: '', width: '400px', height: '500px'})
    let scale_x = await create_model_bqplot(manager, 'LinearScale', 'scale_x', {min:0, max:1, allow_padding: false})
    let scale_y = await create_model_bqplot(manager, 'LinearScale', 'scale_y', {min:2, max:3, allow_padding: false})
    let scales = {x: 'IPY_MODEL_scale_x', y: 'IPY_MODEL_scale_y'}
    let color    = null;
    let size     = {type: null, values: null};
    let opacity  = {type: null, values: null};
    let rotation = {type: null, values: null};
    let skew     = {type: null, values: null};

    let scatterModel = await create_model_bqplot(manager, 'Scatter', 'scatter1', {scales: scales,
        x: x, y: y, color: color, size: size, opacity: opacity, rotation: rotation, skew: skew,
        visible: true, default_size: 64,
        preserve_domain: {}, _view_module_version: '*', _view_module: 'bqplot'})
    let figureModel;
    try {
        figureModel = await create_model_bqplot(manager, 'Figure', 'figure1', {scale_x: scales['x'], scale_y: scales['y'],
            layout: 'IPY_MODEL_layout_figure1', _dom_classes: [],
            figure_padding_y: 0, fig_margin: {bottom: 0, left: 0, right: 0, top: 0},
            marks: ['IPY_MODEL_scatter1']})
    } catch(e) {
        console.error('error', e)
    }
    let figure  = await create_view(manager, figureModel);
    await manager.display_view(undefined, figure);
    return {figure: figure, scatter: await figure.mark_views.views[0]}
}*/
