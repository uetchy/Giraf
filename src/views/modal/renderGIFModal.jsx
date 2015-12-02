"use strict";

import React                                    from "react";
import keyMirror                                from "keymirror";

import Actions                                  from "src/actions/actions";
import {Composition}                            from "src/stores/model/composition";
import {Modal, ModalButtonSet}                  from "src/views/modal";
import {Number, Progress}                       from "src/views/forms";
import {renderFrameAsync}                       from "src/utils/renderUtils";
import formatByte                               from "src/utils/formatByte";
import writeGIF                                 from "src/utils/writeGIF";
import dataURLToBlob                            from "src/utils/dataURLToBlob";


const MODAL_SCENE = keyMirror({
  SETTING: null,
  RENDERING: null,
  RENDERED: null,
});

const createImgAsync = (blob) => {
  return new Promise((resolve, reject) => {
    try {
      const img = document.createElement("img");
      img.onload = () => {
        resolve(img);
      };
      img.src = blob;
    } catch (e) {
      reject(e);
    }
  });
};

const RenderGIFModal = React.createClass({

  // When this component is unmounted, it will become false.
  alive: true,

  propTypes() {
    return {
      composition:      React.PropTypes.instanceOf(Composition).isRequired,
      onCancelClicked:  React.PropTypes.func,
      onDoneClicked:    React.PropTypes.func,
    };
  },

  getInitialState() {
    return {
      modalScene: MODAL_SCENE.SETTING,
      gifFPS: this.props.composition.fps,
      gifSize: this.props.composition.width,
      gifStart: 0,
      gifEnd: this.props.composition.frame,
      previewFrame: 0,
      renderedCanvases: {},
      renderAborted: false,
      progress: 0,
      resultGIF: null,
      resultGIFImg: null,
    };
  },

  componentDidMount() {
    const composition = this.props.composition;

    // Render frame on background
    const render = (frame) => {
      return new Promise((resolve, reject) => {
        if (!this.alive) {
          return reject();
        }
        renderFrameAsync(composition, frame).then(
          (result) => {
            const r = {};
            r[frame] = result;
            this.setState({
              renderedCanvases: Object.assign(this.state.renderedCanvases, r),
              progress: (frame + 1) / composition.frame,
            });
            if (frame + 1 < composition.frame) {
              resolve(frame + 1);
            }
            else {
              reject();
            }
          },
          (error) => {
            this.setState({
              renderAborted: true,
            });
            console.error(error);
            console.warn("Failed to render frame : " + frame);
            reject();
          }
        )
      });
    };
    render(0).then(
      function loop(frame) {
        return render(frame).then(
          loop,
          (error) => {
            // stopped
          }
        );
      }
    );

    // Frame timer
    const timer = (frame) => {
      return new Promise((resolve, reject) => {
        if (!this.alive) {
          return reject();
        }
        new Promise((resolve_) => {
          setTimeout(resolve_, 1000 / this.state.gifFPS);
        }).then(() => {
          this.setState({
            previewFrame: frame,
          });
          const nextFrame = (frame + 1 >= this.state.gifStart
                          && frame + 1 <  this.state.gifEnd)
              ? frame + 1
              : this.state.gifStart;
          resolve(nextFrame);
        });
      });
    };
    timer(this.state.gifStart).then(
      function loop(frame) {
        return timer(frame).then(
          loop,
          (error) => {
            // stopped
          }
        )
      }
    )
  },

  componentDidUpdate() {
    const composition = this.props.composition;
    const flush = (dom) => {
      while (dom.firstChild) {
        dom.removeChild(dom.firstChild);
      }
    };

    // update preview DOM
    const previewCanvasDOM = this.refs.previewCanvasContainer;
    if (previewCanvasDOM) {
      flush(previewCanvasDOM);
      const canvas = this.state.renderedCanvases[this.state.previewFrame];
      if (canvas) {
        previewCanvasDOM.appendChild(canvas);
        const width = this.state.gifSize;
        const height = Math.round(composition.height * this.state.gifSize / composition.width);
        previewCanvasDOM.style.width = `${width}px`;
        previewCanvasDOM.style.height = `${height}px`;
      }
    }
    const previewGIFDOM = this.refs.previewGIFContainer;
    if (previewGIFDOM) {
      if (!previewGIFDOM.firstChild
      ||  previewGIFDOM.firstChild !== this.state.resultGIFImg) {
        flush(previewGIFDOM);
        previewGIFDOM.appendChild(this.state.resultGIFImg);
      }
    }
  },

  componentWillUnmount() {
    // out of control
    this.alive = false;
  },

  render() {
    const title = "GIFを作成";

    const footer = (
      <div className="render-gif-modal-footer-content">
        <Progress value={this.state.progress} max={1} />
        <ModalButtonSet content={this._buttonContent()} />
      </div>
    );

    return (
      <Modal title={title}
             footer={footer}>
        {this._modalContent()}
      </Modal>
    )
  },

  _buttonContent() {
    switch (this.state.modalScene) {
      case (MODAL_SCENE.SETTING):
        return (this._canCreateGIF())
          ? [
              {
                text: "キャンセル",
                className: "sub",
                onClick: this._onCancelClicked,
              },
              {
                text: "GIFを作成",
                onClick: this._onCreateClicked,
              },
            ]
          : [
              {
                text: "キャンセル",
                className: "sub",
                onClick: this._onCancelClicked,
              },
              {
                text: "レンダリング中...",
                className: "disabled",
              },
            ];
      case (MODAL_SCENE.RENDERING):
        return [
          {
            text: "キャンセル",
            className: "sub",
            onClick: this._onCancelClicked,
          },
          {
            text: "GIF作成中...",
            className: "disabled",
          },
        ];
      case (MODAL_SCENE.RENDERED):
        return [
          {
            text: "もう一度作成",
            onClick: this._onReRenderClicked,
          },
          {
            text: "終了",
            onClick: this._onDoneClicked,
          },
        ];
    }
  },

  _modalContent() {
    const previewGIF = (() => {
      switch (this.state.modalScene) {
        case (MODAL_SCENE.SETTING):
          return (
            <div className="render-gif-modal__preview">
              <div className="render-gif-modal__preview__canvas-container"
                   ref="previewCanvasContainer">
              </div>
              <div className="render-gif-modal__preview__frame">
                {this.state.previewFrame + 1}
              </div>
            </div>
          );
        case (MODAL_SCENE.RENDERING):
          return (
            <div className="render-gif-modal__preview">
              <div className="render-gif-modal__preview__canvas-container"
                   ref="previewCanvasContainer">
              </div>
              <div className="render-gif-modal__preview__gif-description">
                Rendering Now...
              </div>
            </div>
          );
        case (MODAL_SCENE.RENDERED):
          return (
            <div className="render-gif-modal__preview">
              <div className="render-gif-modal__preview__gif-container"
                   ref="previewGIFContainer">
              </div>
              <div className="render-gif-modal__preview__gif-description">
                Rendering Finished : {formatByte(this.state.resultGIF.size)}
              </div>
            </div>
          );
      }
    })();

    switch (this.state.modalScene) {

      case (MODAL_SCENE.SETTING):
        return (
          <div className="render-gif-modal">
            {previewGIF}
            <div className="render-gif-modal__settings">
              <div className="render-gif-modal__input">
                <div className="render-gif-modal__input__left">
                  GIFの開始フレーム
                </div>
                <div className="render-gif-modal__input__right">
                  <Number value={this.state.gifStart + 1}
                          min={1}
                          max={this.state.gifEnd}
                          step={1}
                          onChange={this._onGIFStartChanged} />
                </div>
              </div>
              <div className="render-gif-modal__input">
                <div className="render-gif-modal__input__left">
                  GIFの終了フレーム
                </div>
                <div className="render-gif-modal__input__right">
                  <Number value={this.state.gifEnd}
                          min={this.state.gifStart + 1}
                          max={this.props.composition.frame}
                          step={1}
                          onChange={this._onGIFEndChanged} />
                </div>
              </div>
              <div className="render-gif-modal__input">
                <div className="render-gif-modal__input__left">
                  GIFのフレームレート
                </div>
                <div className="render-gif-modal__input__right">
                  <Number value={this.state.gifFPS}
                          min={1}
                          max={30}
                          step={1}
                          suffixString="fps"
                          onChange={this._onGIFFPSChanged} />
                </div>
              </div>
              <div className="render-gif-modal__input">
                <div className="render-gif-modal__input__left">
                  GIFの大きさ
                </div>
                <div className="render-gif-modal__input__right">
                  <Number value={this.state.gifSize}
                          min={10}
                          max={1000}
                          step={1}
                          suffixString="px"
                          onChange={this._onGIFSizeChanged} />
                </div>
              </div>
            </div>
          </div>
        );

      case (MODAL_SCENE.RENDERING):
      case (MODAL_SCENE.RENDERED):
        return (
          <div className="render-gif-modal">
            {previewGIF}
            <div className="render-gif-modal__settings">
              <div className="render-gif-modal__input">
                <div className="render-gif-modal__input__left">
                  GIFの開始フレーム
                </div>
                <div className="render-gif-modal__input__right">
                  {this.state.gifStart + 1}
                </div>
              </div>
              <div className="render-gif-modal__input">
                <div className="render-gif-modal__input__left">
                  GIFの終了フレーム
                </div>
                <div className="render-gif-modal__input__right">
                  {this.state.gifEnd}
                </div>
              </div>
              <div className="render-gif-modal__input">
                <div className="render-gif-modal__input__left">
                  GIFのフレームレート
                </div>
                <div className="render-gif-modal__input__right">
                  {this.state.gifFPS} fps
                </div>
              </div>
              <div className="render-gif-modal__input">
                <div className="render-gif-modal__input__left">
                  GIFの大きさ
                </div>
                <div className="render-gif-modal__input__right">
                  {this.state.gifSize} px
                </div>
              </div>
            </div>
          </div>
        );
    }
  },

  _onCancelClicked() {
    Actions.updateModal(null);
    if (this.props.onCancelClicked) {
      this.props.onCancelClicked();
    }
  },

  _onCreateClicked() {
    if (!this._canCreateGIF()) {
      return;
    }
    this.setState({
      modalScene: MODAL_SCENE.RENDERING,
      progress: 0,
    });

    let canvases = [];
    for (let i = this.state.gifStart; i < this.state.gifEnd; i++) {
      canvases.push(this.state.renderedCanvases[i]);
    }

    const width = this.state.gifSize;
    const height = Math.round(this.props.composition.height
                              * this.state.gifSize
                              / this.props.composition.width);
    const interval = 1 / this.state.gifFPS;

    writeGIF(canvases, width, height, interval, {
      progressCallback: (captureProgress) => {
        this.setState({
          progress: captureProgress,
        });
      },
    }).then(
      (result) => {
        this.setState({
          resultGIF: dataURLToBlob(result.image),
        });
        return createImgAsync(result.image);
      },
      (error) => {
        console.error(error);
        console.warn("Failed to write GIF.");
        this.setState({
          modalScene: MODAL_SCENE.SETTING,
        });
      }
    ).then(
      (result) => {
        this.setState({
          modalScene: MODAL_SCENE.RENDERED,
          resultGIFImg: result,
        });
      },
      (error) => {
        console.error(error);
        this.setState({
          modalScene: MODAL_SCENE.SETTING,
        });
      }
    );
  },

  _onDoneClicked() {
    Actions.updateModal(null);
    if (this.props.onDoneClicked) {
      this.props.onDoneClicked();
    }
  },

  _onReRenderClicked() {
    this.setState({
      modalScene: MODAL_SCENE.SETTING,
      resultGIF: null,
      resultGIFImg: null,
    });
  },

  _onGIFStartChanged(value) {
    if (this.state.modalScene === MODAL_SCENE.SETTING) {
      this.setState({
        gifStart: value - 1,
      });
    }
  },

  _onGIFEndChanged(value) {
    if (this.state.modalScene === MODAL_SCENE.SETTING) {
      this.setState({
        gifEnd: value,
      });
    }
  },

  _onGIFFPSChanged(value) {
    if (this.state.modalScene === MODAL_SCENE.SETTING) {
      this.setState({
        gifFPS: value,
      });
    }
  },

  _onGIFSizeChanged(value) {
    if (this.state.modalScene === MODAL_SCENE.SETTING) {
      this.setState({
        gifSize: value,
      });
    }
  },

  _canCreateGIF() {
    return this.props.composition.frame
           === Object.keys(this.state.renderedCanvases).length;
  },
});

export default RenderGIFModal;
