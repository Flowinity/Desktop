import {
  app,
  shell,
  BrowserWindow,
  ipcMain,
  Tray,
  Menu,
  autoUpdater
} from "electron";
import { join } from "path";
import { electronApp, optimizer, is } from "@electron-toolkit/utils";
import icon from "./assets/flowinity.png?asset";
import unreadIcon from "./assets/flowinity-unread.png?asset";
import sysTrayIcon from "./assets/flowinity-systray.png?asset";
import unreadSysTrayIcon from "./assets/flowinity-unread-systray.png?asset";
import handleNotifications from "./ipc/notifications";
import handleFlowshot from "./ipc/flowshot";
import AutoLaunch from "auto-launch";
import handleSettings from "./ipc/settings";

import Store from "electron-store";
import { Settings } from "./types/settings";
const store = new Store();
let tray: Tray | null = null;

function createWindow(): void {
  if (require("electron-squirrel-startup")) return;

  const server = "https://updates.flowinity.com";
  const url = `${server}/update/${process.platform}/${app.getVersion()}`;

  autoUpdater.setFeedURL({ url });

  setInterval(() => {
    autoUpdater.checkForUpdates();
  }, 60000);

  const autoLauncher = new AutoLaunch({
    name: "Flowinity"
  });

  if (!store.get("settings")) {
    store.set("settings", {
      startup: true,
      minimizeToTray: true,
      desktopNotifications: true,
      autoUpdate: true,
      windowBorder: true
    });

    if (!is.dev) autoLauncher.enable();
  }

  const settings = <Settings>store.get("settings");

  // Create the browser window.
  const mainWindow = new BrowserWindow({
    show: false,
    autoHideMenuBar: true,
    ...(process.platform === "linux" ? { icon } : {}),
    webPreferences: {
      preload: join(__dirname, "../preload/index.js"),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false
    },
    titleBarStyle: settings.windowBorder ? "default" : "hidden",
    frame: settings.windowBorder
  });

  autoUpdater.on("update-downloaded", (_event, releaseNotes, releaseName) => {
    mainWindow.webContents.send(
      "update-downloaded",
      process.platform === "win32" ? releaseNotes : releaseName
    );
  });

  if (!store.get("bounds")) {
    mainWindow.setSize(1366, 768);
  }

  mainWindow.removeMenu();
  mainWindow.webContents.on("before-input-event", (_, input) => {
    if (
      (input.type === "keyDown" && input.key === "F12") ||
      (input.type === "keyDown" &&
        input.key === "I" &&
        input.control &&
        input.shift)
    ) {
      mainWindow.webContents.isDevToolsOpened() ?
        mainWindow.webContents.closeDevTools()
      : mainWindow.webContents.openDevTools({ mode: "right" });
    }

    // allow ctrl r to refresh
    if (input.type === "keyDown" && input.control && input.key === "R") {
      mainWindow.webContents.reload();
    }
  });

  mainWindow.setBounds(<any>store.get("bounds"));

  mainWindow.on("close", (event) => {
    store.set("bounds", mainWindow.getBounds());

    if (settings.minimizeToTray) {
      mainWindow.hide();
      event.preventDefault();
    }
  });

  mainWindow.on("ready-to-show", () => {
    mainWindow.show();
  });

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url);
    return { action: "deny" };
  });

  if (is.dev) {
    mainWindow.loadURL("http://localhost:3000");
  } else {
    mainWindow.loadURL("https://flowinity.com");
  }

  let lastMessageCount = 0;

  // Watch for changes in message unreads and update the tray icon
  ipcMain.on("unread-messages-count", (_, count) => {
    if (lastMessageCount === count) return;
    lastMessageCount = count;
    if (tray) {
      if (count === 0) {
        tray.setToolTip("Flowinity");
        tray.setImage(sysTrayIcon);

        // update the app icon badge, only works on MacOS
        app.setBadgeCount(0);

        if (process.platform !== "darwin") {
          mainWindow.setIcon(icon);
        }
      } else {
        tray.setToolTip(`Flowinity (${count} unread)`);
        tray.setImage(unreadSysTrayIcon);

        // update the app icon badge, only works on MacOS
        app.setBadgeCount(count);

        if (process.platform !== "darwin") {
          mainWindow.setIcon(unreadIcon);
        }
      }
    }
  });

  ipcMain.on("update", () => {
    autoUpdater.quitAndInstall();
  });

  ipcMain.on("check-for-updates", () => {
    autoUpdater.checkForUpdates();
  });
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.whenReady().then(() => {
  // Set app user model id for windows
  electronApp.setAppUserModelId("com.flowinity.desktop");

  // Default open or close DevTools by F12 in development
  // and ignore CommandOrControl + R in production.
  // see https://github.com/alex8088/electron-toolkit/tree/master/packages/utils
  app.on("browser-window-created", (_, window) => {
    optimizer.watchWindowShortcuts(window);
  });

  // IPC test
  ipcMain.on("ping", () => console.log("pong"));
  handleNotifications();
  handleFlowshot();
  handleSettings();

  createWindow();

  const mainWindow = BrowserWindow.getAllWindows()[0];

  app.whenReady().then(() => {
    tray = new Tray(sysTrayIcon);
    const contextMenu = Menu.buildFromTemplate([
      { label: "Flowinity", type: "normal", enabled: false },
      { type: "separator" },
      {
        label: "Open",
        type: "normal",
        click: (): void => {
          if (mainWindow) {
            mainWindow.show();
          }
        }
      },
      {
        label: "Settings",
        type: "normal",
        click: (): void => {
          if (mainWindow) {
            mainWindow.webContents.send("open-settings");
          }
        }
      },
      {
        label: "About",
        type: "normal",
        click: (): void => {
          if (mainWindow) {
            mainWindow.webContents.send("open-about");
          }
        }
      },
      { type: "separator" },
      {
        label: "Quit",
        type: "normal",
        click: (): void => {
          if (mainWindow) {
            mainWindow.destroy();
          }
          app.quit();
        }
      }
    ]);
    tray.setToolTip("Flowinity");
    tray.on("click", () => {
      if (mainWindow) {
        mainWindow.show();
      }
    });
    tray.setContextMenu(contextMenu);
  });

  ipcMain.on("restart", () => {
    console.log("Restarting app");
    if (mainWindow) mainWindow.destroy();
    app.quit();
    app.relaunch();
  });

  app.on("activate", function () {
    // On macOS it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

// In this file you can include the rest of your app"s specific main process
// code. You can also put them in separate files and require them here.
