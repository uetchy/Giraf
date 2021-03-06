/*
 *  main.js
 *  Script that launch electron apps.
 */

const electron = require("electron");
const app = electron.app;
const BrowserWindow = electron.BrowserWindow;
const shell = require("shell");

// Report crashes to our server.
//require('crash-reporter').start();

// Keep a global reference of the window object, if you don't, the window will
// be closed automatically when the JavaScript object is GCed.
var mainWindow = null;

var osxQuitNow = false;

function launchMainWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 900,
    center: true
  });
  mainWindow.loadURL("file://" + __dirname + "/index.html");

  mainWindow.on("close", function (e) {
    if (process.platform == "darwin" && !osxQuitNow) {
      e.preventDefault();
      mainWindow.hide();
    }
  });

  // Open links on the external browser
  mainWindow.webContents.on("new-window", function(e, url) {
    e.preventDefault();
    shell.openExternal(url);
  });
}

function launch() {
  app.on("activate", function() {
    mainWindow.show();
  });

  app.on("before-quit", function() {
    osxQuitNow = true;
  });

  app.on("will-quit", function() {
    mainWindow = null;
  });

  app.on("window-all-closed", function () {
    if (process.platform != "darwin") {
      app.quit();
    }
  });

  app.on("ready", function () {
    launchMainWindow();
  });
}

launch();
