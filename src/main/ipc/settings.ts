import { app, ipcMain } from "electron";
import Store from "electron-store";
import { Settings } from "../types/settings";
import AutoLaunch from "auto-launch";
const store = new Store();

export default function handleSettings(): void {
  ipcMain.on("get-settings", (event) => {
    const settings = <Settings>store.get("settings");

    event.reply("get-settings", {
      ...settings,
      restartRequired: false
    });
  });

  ipcMain.on("set-settings", (event, args) => {
    const newSettings = JSON.parse(args);
    const settings = <Settings>store.get("settings");

    if (newSettings.startup !== undefined) {
      const autoLauncher = new AutoLaunch({
        name: "Flowinity"
      });

      if (newSettings.startup) {
        autoLauncher.enable();
      } else {
        autoLauncher.disable();
      }
    }

    store.set("settings", {
      ...settings,
      ...newSettings,
      restartRequired: true
    });

    event.reply("get-settings", {
      ...settings,
      ...newSettings,
      restartRequired: true
    });
  });

  ipcMain.on("restart", () => {
    console.log("Restarting app");
    app.quit();
    app.relaunch();
  });

  ipcMain.handle("get-version", () => {
    return app.getVersion();
  });
}
