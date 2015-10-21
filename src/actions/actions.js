"use strict";

import Dispatcher                     from "src/dispatcher";
import ActionConst                    from "src/actions/const";
import GenUUID                        from "src/utils/genUUID";
import SelectFile                     from "src/utils/selectFile";
import {hasTrait}                     from "src/utils/traitUtils";
import createLayerAsync               from "src/utils/createLayerAsync";
import _Selectable                    from "src/stores/model/_selectable";
import {Composition}                  from "src/stores/model/composition";
import {Layer}                        from "src/stores/model/layer";
//import {Footage}                      from "src/stores/model/footage";
import F                              from "src/stores/model/footage";
import {DragAction, DragActionType}   from "src/stores/model/dragAction";
import {Point}                        from "src/stores/model/point";
import {Transform}                    from "src/stores/model/transform"


export default {
  importFile(file = null) {
    if (file) {
      Dispatcher.dispatch({
        actionType: ActionConst.IMPORT_FILE,
        file: file
      });
    }
    else {
      SelectFile.run((f) => {
        let files = [];
        for (let i=0; i < f.length; i++) files.push(f[i]);
        Dispatcher.dispatch({
          actionType: ActionConst.IMPORT_FILE,
          file: files
        })
      });
    }
  },

  updateFootage(footage) {
    Dispatcher.dispatch({
      actionType: ActionConst.UPDATE_FOOTAGE,
      footage: footage
    });
  },

  changeSelectingItem(item) {
    if (item === null || hasTrait(item, _Selectable)) {
      Dispatcher.dispatch({
        actionType: ActionConst.CHANGE_SELECTING_ITEM,
        item: item
      })
    }
  },

  createComposition(composition = null) {
    let comp = (composition !== null)? composition
      : new Composition(GenUUID(), "new composition", 400, 300, 48, 12);
    if (comp instanceof Composition) {
      Dispatcher.dispatch({
        actionType: ActionConst.CREATE_COMPOSITION,
        composition: comp
      });
    }
  },

  updateComposition(composition) {
    if (composition instanceof Composition) {
      Dispatcher.dispatch({
        actionType: ActionConst.UPDATE_COMPOSITION,
        composition: composition
      });
    }
  },

  changeEditingComposition(composition) {
    if (composition === null || composition instanceof Composition) {
      Dispatcher.dispatch({
        actionType: ActionConst.CHANGE_EDITING_COMPOSITION,
        composition: composition
      });
    }
  },

  changeEditingLayer(layer) {
    if (layer === null || layer instanceof Layer) {
      Dispatcher.dispatch({
        actionType: ActionConst.CHANGE_EDITING_LAYER,
        layer: layer
      });
    }
  },

  createLayer(parentComp, index = 0, entity = null) {
    if (entity instanceof Layer) {
      Dispatcher.dispatch({
        actionType: ActionConst.CREATE_LAYER,
        layer: entity,
        index: index,
      });
    }
    else {
      createLayerAsync(parentComp, entity).then(
        (result) => {
          Dispatcher.dispatch({
            actionType: ActionConst.CREATE_LAYER,
            layer: result,
            index: index,
          });
        },
        (error) => {
          console.error(error);
          console.warn("Failed to create layer");
        }
      );
    }
  },

  updateLayer(layer) {
    if (layer instanceof Layer) {
      Dispatcher.dispatch({
        actionType: ActionConst.UPDATE_LAYER,
        layer: layer
      });
    }
  },

  startDrag(dragObj) {
    let dragAction = (dragObj instanceof DragAction)? dragObj : null;
    if (!dragAction) {
      let type = (dragObj instanceof F.Footage) ? DragActionType.FOOTAGE
        : (dragObj instanceof Composition) ? DragActionType.COMPOSITION
        : (dragObj instanceof Layer) ?       DragActionType.LAYER
        : null;
      if (type) {
        dragAction = new DragAction(type, dragObj);
      }
    }
    if (dragAction) {
      Dispatcher.dispatch({
        actionType: ActionConst.START_DRAG,
        dragAction: dragAction
      });
    }
  },

  endDrag() {
    Dispatcher.dispatch({
      actionType: ActionConst.END_DRAG
    });
  },

  updateCurrentFrame(frame) {
    if (frame === null || typeof(frame) === "number") {
      Dispatcher.dispatch({
        actionType: ActionConst.UPDATE_CURRENT_FRAME,
        currentFrame: frame
      });
    }
  },

  renderComposition(composition) {

  },

  renderFrame(composition, frame) {
    if (composition instanceof Composition
    && frame !== null
    && frame >= 0
    && frame < composition.frame) {
      let canvas = document.createElement("canvas");
      canvas.width = composition.width;
      canvas.height = composition.height;
      let ctx = canvas.getContext("2d");

      composition.render(frame).then(
        (result) => {
          ctx.drawImage(result, 0, 0);
          Dispatcher.dispatch({
            actionType: ActionConst.RENDER_FRAME,
            canvas: canvas,
            composition: composition,
            frame: frame,
          });
        },
        (error) => {
          console.error(error);
          console.warn("Rendering failed : " + composition.name);
        }
      );
    }
  },
  clearFrameCache(composition, frames=null) {
    let _frames = frames;
    if (frames === null) {
      _frames = [];
      for (let i=0; i < compostion.frame; i++) {
        _frames.push(i);
      }
    }
    if (typeof(frames) === "number") {
      _frames = [frames];
    }
    if (_frames instanceof Array) {
      Dispatcher.dispatch({
        actionType: ActionConst.CLEAR_FRAME_CACHE,
        composition: composition,
        frames: frames.filter((e) => e >= 0 && e < composition.frame),
      })
    }
  },
};
