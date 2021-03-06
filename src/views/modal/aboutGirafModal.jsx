"use strict";

import React                                    from "react";
import {FormattedMessage}                       from "react-intl";
import _Lang                                    from "lodash/lang";

import pkg                                      from "package.json";
import Actions                                  from "src/actions/actions";
import {Modal, ModalButtonSet}                  from "src/views/modal";

import licenses                                 from "src/views/modal/third_party_licneses.json";


// HACK: We cannot use babelify and brfs at the same time.
var fs = require("fs");
var girafLicense = fs.readFileSync(__dirname + "/../../../LICENSE", "utf8");

const AboutGirafModal = React.createClass({
  getKeyEvents() {
    return {
      "enter": () => {
        Actions.updateModal(null);
        return false;
      },
    };
  },

  render() {
    const title = <FormattedMessage id="views.modal.about_giraf_modal.title"
                                    defaultMessage="About Giraf" />;

    const buttonContent = [
      {
        text: <FormattedMessage id="views.modal.about_giraf_modal.close"
                                defaultMessage="Close" />,
        onClick: () => {
          Actions.updateModal(null);
        },
      },
    ];

    const thirdPartyLicenses = Object.keys(licenses).map((key, i) => {
      const value = licenses[key];
      const license = (_Lang.isArray(value.licenses))
                    ? value.licenses.join(" or ") : value.licenses;
      const repository = (_Lang.isString(value.repository))
                    ? value.repository.replace("git+", "") : "";
      return <div key={i}>
        <h5>{key}</h5>
        <p>
          {license} - <a href={repository} target="_blank">{repository}</a>
        </p>
      </div>
    });

    return (
      <Modal title={title}
             footer={ <ModalButtonSet content={buttonContent} /> }
             keyEvents={this.getKeyEvents()}>
        <div className="pretty">
          <img src="rsc/giraf_logo_brown.png" alt="Giraf"
               style={{height: "100px"}}/>
          <p>Version: {pkg.version}</p>
          <h2>License</h2>
          <pre>{girafLicense}</pre>
          <h2>Acknowledgement</h2>
          <p>
            <FormattedMessage id="views.modal.about_giraf_modal.acknowledgement_message"
                              defaultMessage="Giraf depends on many open source projects." />
          </p>
          {thirdPartyLicenses}
        </div>
      </Modal>
    );
  },
});

export default AboutGirafModal;
