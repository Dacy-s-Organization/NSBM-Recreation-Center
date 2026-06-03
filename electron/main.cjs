const { app, BrowserWindow, shell } = require("electron");
const path = require("path");

const DEFAULT_URL = "https://nsbm-recreation-center.netlify.app";
const ICON_PATH = path.join(__dirname, "icons", "icon.png");

function createWindow() {
  const win = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1100,
    minHeight: 700,
    title: "NSBM Recreation Center",
    icon: ICON_PATH,
    autoHideMenuBar: true,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      devTools: true,
    },
  });

  const targetUrl = process.env.ELECTRON_START_URL || DEFAULT_URL;
  win.loadURL(targetUrl);

  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: "deny" };
  });
}

app.whenReady().then(() => {
  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
