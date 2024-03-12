import {
  app,
  shell,
  BrowserWindow,
  ipcMain,
  Tray,
  Menu,
  autoUpdater,
  protocol,
  powerMonitor
} from "electron";
import { join } from "path";
import { electronApp, optimizer, is } from "@electron-toolkit/utils";
import icon from "./assets/flowinity.png?asset";
import unreadIcon from "./assets/flowinity-unread.png?asset";
import sysTrayIcon from "./assets/flowinity-systray.png?asset";
import unreadSysTrayIcon from "./assets/flowinity-unread-systray.png?asset";
import sysTrayDarwinIcon from "./assets/flowinity-systray-darwin.png?asset";
import unreadSysTrayDarwinIcon from "./assets/flowinity-unread-systray-darwin.png?asset";
import handleNotifications from "./ipc/notifications";
import handleFlowshot from "./ipc/flowshot";
import AutoLaunch from "auto-launch";
import handleSettings from "./ipc/settings";

import Store from "electron-store";
import { Settings } from "./types/settings";
import path from "node:path";
const store = new Store();
let tray: Tray | null = null;

protocol.registerSchemesAsPrivileged([
  {
    scheme: "flowinity",
    privileges: {
      standard: true,
      secure: true
    }
  },
  {
    scheme: "flowinity-internal",
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true
    }
  }
]);

function createWindow(): void {
  if (require("electron-squirrel-startup")) return;

  if (process.defaultApp) {
    if (process.argv.length >= 2) {
      app.setAsDefaultProtocolClient("flowinity", process.execPath, [
        path.resolve(process.argv[1])
      ]);
    }
  } else {
    app.setAsDefaultProtocolClient("flowinity");
  }

  const gotTheLock = app.requestSingleInstanceLock();

  if (!gotTheLock) {
    console.info("Another instance of Flowinity is already running.");
    app.quit();
    return;
  } else {
    app.on("second-instance", () => {
      const mainWindow = BrowserWindow.getAllWindows()[0];
      if (mainWindow) {
        if (mainWindow.isMinimized()) mainWindow.restore();
        mainWindow.focus();
        mainWindow.show();
      }
    });
  }

  const server = "https://updates.flowinity.com";
  const url = `${server}/update/${process.platform}/${app.getVersion()}`;
  console.log(url);

  autoUpdater.setFeedURL({ url });

  autoUpdater.on("error", (error) => {
    console.error("Auto updater error:", error);
  });

  setInterval(() => {
    autoUpdater.checkForUpdates();
  }, 60000);

  let settings = <Settings>store.get("settings");

  const autoLauncher = new AutoLaunch({
    name: "Flowinity",
    isHidden:
      settings?.startMinimized === undefined ? true : settings.startMinimized,
    path: process.env.APPIMAGE || app.getPath("exe")
  });

  if (!store.get("settings")) {
    store.set("settings", {
      startup: true,
      minimizeToTray: true,
      desktopNotifications: true,
      autoUpdate: true,
      windowBorder: true,
      startMinimized: true
    });

    if (!is.dev) autoLauncher.enable();
  }

  autoLauncher
    .isEnabled()
    .then((isEnabled) => {
      console.log("Auto launch enabled:", isEnabled);
    })
    .catch((err) => {
      console.error("Error checking auto launch:", err);
    });

  settings = <Settings>store.get("settings");

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

    const ctrl = input.control || input.meta;

    // allow ctrl r to refresh
    if (input.type === "keyDown" && ctrl && input.key === "R") {
      mainWindow.webContents.reload();
    }

    // allow zooming
    if (input.type === "keyDown" && ctrl && input.key === "=") {
      mainWindow.webContents.zoomFactor += 0.1;
    }

    if (input.type === "keyDown" && ctrl && input.key === "-") {
      mainWindow.webContents.zoomFactor -= 0.1;
    }

    if (input.type === "keyDown" && ctrl && input.key === "0") {
      mainWindow.webContents.zoomFactor = 1;
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

        if (process.platform === "darwin") {
          tray.setImage(sysTrayDarwinIcon);
        } else {
          tray.setImage(sysTrayIcon);
        }

        // update the app icon badge, only works on MacOS
        app.setBadgeCount(0);

        if (process.platform !== "darwin") {
          mainWindow.setIcon(icon);
        }
      } else {
        tray.setToolTip(`Flowinity (${count} unread)`);

        if (process.platform === "darwin") {
          tray.setImage(unreadSysTrayDarwinIcon);
        } else {
          tray.setImage(unreadSysTrayIcon);
        }

        // update the app icon badge, only works on MacOS
        app.setBadgeCount(count);

        if (process.platform !== "darwin") {
          mainWindow.setIcon(unreadIcon);
        }
      }
    }
  });

  ipcMain.on("update", () => {
    mainWindow.destroy();
    autoUpdater.quitAndInstall();
  });

  ipcMain.on("check-for-updates", () => {
    autoUpdater.checkForUpdates();
  });

  ipcMain.on("focus-window", () => {
    mainWindow.show();
  });

  ipcMain.handle("get-idle-time", () => {
    return powerMonitor.getSystemIdleTime();
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

  // We need a separate tray icon for MacOS since unlike KDE and Windows, it isn't scaled by the system.
  tray = new Tray(
    process.platform === "darwin" ? sysTrayDarwinIcon : sysTrayIcon
  );

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
    {
      label: "Check for Updates",
      type: "normal",
      click: (): void => {
        if (process.platform !== "linux") {
          autoUpdater.checkForUpdates();
        } else {
          mainWindow.webContents.send("check-for-updates");
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

  process.on("SIGINT", () => {
    console.info("SIGINT received, quitting...");
    if (mainWindow) mainWindow.destroy();
    app.quit();
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
