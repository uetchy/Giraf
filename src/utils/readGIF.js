"use strict";

import {Stream, parseGIF}               from "src/utils/jsgif";


function url2Binary(objectURL) {
  return new Promise((resolve, reject) => {
    try {
      let xhr = new XMLHttpRequest();
      xhr.open("GET", objectURL, true);
      xhr.overrideMimeType('text/plain; charset=x-user-defined');
      xhr.onload = (e) => {
        if (xhr.status == 200) {
          setTimeout(() => {
            resolve(xhr.responseText);
          }, 0);
        }
        else {
          throw new Error("request returns a failure status.");
        }
      };
      xhr.send();
    } catch (e) {
      reject(e);
    }
  });
}

export default (objectURL) => {
  return new Promise((resolve, reject) => {

    let canvas = document.createElement("canvas");
    let context = canvas.getContext("2d");

    let frames = [];
    let frameInfo = null;
    let header = null;
    let cachedContext = null;

    const hdrCallback = (hdr) => {
      header = hdr;
      canvas.width = hdr.width;
      canvas.height = hdr.height;
    };

    const gceCallback = (gce) => {
      frameInfo = {
        disposalMethod: gce.disposalMethod,
        transparencyIndex: gce.transparencyGiven ? gce.transparencyIndex : null,
        delayTime: gce.delayTime,
      };
    };

    const imgCallback = (img) => {
      let colorTable = img.lctFlag ? img.lct : header.gct;
      let delayTime = (frameInfo && frameInfo.delayTime)
        ? frameInfo.delayTime * 10 // (1 delayTime = 10 msec)
        : null;
      let transparencyIndex = frameInfo ? frameInfo.transparencyIndex : null;

      const restore = () => {
        if (cachedContext === null) {
          let cachedCanvas = document.createElement("canvas");
          cachedCanvas.width = header.width;
          cachedCanvas.height = header.height;
          cachedContext = cachedCanvas.getContext("2d");

          let imageData = context.getImageData(0, 0, header.width, header.height);
          cachedContext.putImageData(imageData, 0, 0);
        }
        else {
          let cachedImageData = cachedContext.getImageData(0, 0, header.width, header.height);
          context.putImageData(cachedImageData, 0, 0);
        }
      };

      const draw = (fillBackground = false) => {
        let imageData = context.getImageData(img.leftPos, img.topPos, img.width, img.height);
        let cachedImageData = (fillBackground && cachedContext !== null)
          ? cachedContext.getImageData(0, 0, header.width, header.height)
          : null;

        for (let i = 0; i < img.pixels.length; i++) {
          let pixel = img.pixels[i];
          if (transparencyIndex !== pixel) {
            imageData.data[i * 4]     = colorTable[pixel][0];
            imageData.data[i * 4 + 1] = colorTable[pixel][1];
            imageData.data[i * 4 + 2] = colorTable[pixel][2];
            imageData.data[i * 4 + 3] = 255;
          }
          if (fillBackground) {
            cachedImageData.data[i * 4 + 3] = 0;
          }
        }
        context.putImageData(imageData, img.leftPos, img.topPos);
      };

      switch (frameInfo.disposalMethod) {
        case 0:     // No disposal specified
          draw();
          cachedContext = null;
          break;
        case 1:     // Do not dispose
          draw();
          cachedContext = null;
          break;
        case 2:     // Restore to background color
          restore();
          draw(true);
          break;
        case 3:     // Restore to previous
          restore();
          draw();
          break;
      }
      frames.push({
        imageData: context.getImageData(0, 0, header.width, header.height),
        delayTime: delayTime,
      });
      frameInfo = null;
    };

    const pteCallback = (pte) => {
      frameInfo = null;
    };

    const eofCallback = (eof) => {
      resolve(frames);
    };

    url2Binary(objectURL).then(
      (result) => {
        let stream = new Stream(result);

        parseGIF(stream, {
          hdr: hdrCallback,
          gce: gceCallback,
          img: imgCallback,
          pte: pteCallback,
          eof: eofCallback,
        });
      },
      (error) => {
        reject(error);
      }
    );
  });
};
