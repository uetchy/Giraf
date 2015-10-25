"use strict";

import { EventEmitter } from "events";

import ActionConst          from "src/actions/const";
import GenUUID              from "src/utils/genUUID";
import FileLoader           from "src/utils/fileLoader";
import Store                from "src/stores/store";
import {Footage}            from "src/stores/model/footage";


const CHANGE_EVENT = "change";

function dispatcherCallback(action) {

  const searchById = (list) => (id) => list.filter((e) => e.id === id)[0];

  if (action.actionType === ActionConst.IMPORT_FILE) {
    action.file.forEach((e) => {
      let f = new Footage(GenUUID(), e.name, e.size, e.type);
      if (FileLoader.check(f)) {
        Store.get("footages").push(f);
        FileLoader.run(f, e);
      }
      else {
        console.warn("File load failed : " + e.name);
      }
    });
    Store.emitChange();
  }

  else if (action.actionType === ActionConst.UPDATE_FOOTAGE) {
    if (searchById(Store.get("footages"))(action.footage.id)) {
      Store.set("footages")(Store.get("footages").map((e) => {
        return (e.id === action.footage.id)? action.footage : e;
      }));
      Store.emitChange();
    }
  }

  else if (action.actionType === ActionConst.CHANGE_SELECTING_ITEM) {
    Store.set("selectingItem")(action.item);
    Store.set("isPlaying")(false);
    Store.emitChange();
  }

  else if (action.actionType === ActionConst.CHANGE_EDITING_COMPOSITION) {
    Store.set("editingComposition")(action.composition);
    Store.set("editingLayer")(null);
    Store.set("isPlaying")(false);
    Store.emitChange();
  }

  else if (action.actionType === ActionConst.CHANGE_EDITING_LAYER) {
    Store.set("editingLayer")(action.layer);
    Store.set("isPlaying")(false);
    Store.emitChange();
  }

  else if (action.actionType === ActionConst.CREATE_COMPOSITION) {
    Store.get("compositions").push(action.composition);
    Store.emitChange();
  }

  else if (action.actionType === ActionConst.UPDATE_COMPOSITION) {
    if (searchById(Store.get("compositions"))(action.composition.id)) {
      Store.set("compositions")(Store.get("compositions").map((e) => {
        return (e.id === action.composition.id)? action.composition : e;
      }));
      Store.emitChange();
    }
  }

  else if (action.actionType === ActionConst.CREATE_LAYER) {
    let comp = searchById(Store.get("compositions"))(action.layer.parentCompId);
    if (comp) {
      comp.layers.splice(action.index, 0, action.layer);
      Store.emitChange();
    }
  }

  else if (action.actionType === ActionConst.UPDATE_LAYER) {
    let comp = searchById(Store.get("compositions"))(action.layer.parentCompId);
    if (comp && searchById(comp.layers)(action.layer.id)) {
      comp.layers = comp.layers.map((e) => {
        return (e.id === action.layer.id)? action.layer : e;
      });
      Store.emitChange();
    }
  }

  else if (action.actionType === ActionConst.START_DRAG) {
    Store.set("dragging")(action.dragAction);
    Store.emitChange();
  }

  else if (action.actionType === ActionConst.END_DRAG) {
    if (Store.get("dragging")) {
      Store.set("dragging")(null);
      Store.emitChange();
    }
  }

  else if (action.actionType === ActionConst.UPDATE_CURRENT_FRAME) {
    if (Store.get("currentFrame") !== action.currentFrame) {
      Store.set("currentFrame")(action.currentFrame);
      Store.emitChange();
    }
  }

  else if (action.actionType === ActionConst.RENDER_FRAME) {
    Store.set("compositionFrameCache", action.composition.id, action.frame)
             (action.canvas);
    Store.emitChange();
  }

  else if (action.actionType === ActionConst.CLEAR_FRAME_CACHE) {
    action.frames.forEach((e) => {
      Store.remove("compositionFrameCache", action.composition.id, e);
    });
    Store.emitChange();
  }

  else if (action.actionType === ActionConst.PLAY) {
    if (action.play !== Store.get("isPlaying")) {
      Store.set("isPlaying")(action.play);
      Store.emitChange();
    }
  }
}

export default dispatcherCallback;
