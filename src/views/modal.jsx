"use strict";

import React                                    from "react";
import keyMirror                                from "keymirror";
import _Lang                                    from "lodash/lang";

import Actions                                  from "src/actions/actions";
import setKeyEvnets                             from "src/utils/setKeyEvents";


export const Modal = React.createClass({
  propTypes() {
    return {
      title: React.PropTypes.string,
      footer: React.PropTypes.node,
      className: React.PropTypes.string,
      keyEvents: React.PropTypes.object,
    };
  },

  getModalKeyEvents() {
    const keyEvents = (_Lang.isObject(this.props.keyEvents))
      ? this.props.keyEvents
      : {};
    return Object.assign(keyEvents, {
      "esc": () => {
        Actions.updateModal(null);
        return false;
      },
    });
  },

  componentDidMount() {
    if (_Lang.isObject(this.props.keyEvents)) {
      setKeyEvnets(this.getModalKeyEvents());
    }
  },

  render() {
    const title = (!this.props.title)? null :
      <h3 className="modal__title">
        {this.props.title}
      </h3>;

    const footer = (!this.props.footer)? null :
      <div className="modal__footer">
        {this.props.footer}
      </div>;

    return (
      <div className="modal__wall"
           ref="modalWall"
           onClick={this._onWallClick}>
        <div className={`modal ${this.props.className}`}
             onClick={this._onBodyClick}>
          {title}
          <div className="modal__content">
            {this.props.children}
          </div>
          {footer}
        </div>
      </div>
    );
  },

  _onWallClick() {
    Actions.updateModal(null);
  },

  _onBodyClick(e) {
    e.stopPropagation();
  }
});

export const ModalButtonSet = React.createClass({
  propTypes() {
    return {
      content: React.PropTypes.arrayOf(
        React.PropTypes.shape({
          text: React.PropTypes.string.isRequired,
          onClick: React.PropTypes.func.isRequired,
          className: React.PropTypes.string,
        })
      ).isRequired,
    }
  },

  render() {
    const buttons = this.props.content.map((e, i) => {
      const className = `flat ${(e.className)? e.className : ""}`;
      return(
        <button className={className} key={i}
                onClick={e.onClick}>
          {e.text}
        </button>
      );
    });

    return (
      <div className="modal-button-set">
        {buttons}
      </div>
    );
  }
});

export default {
  Modal: Modal,
  ModalButtonSet: ModalButtonSet,
};
