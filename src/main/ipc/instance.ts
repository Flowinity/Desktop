import { ipcMain } from "electron";
import Store from "electron-store";
import { Settings } from "../types/settings";
const store = new Store();

export default function handleInstance(): void {
  ipcMain.on("instance", async (_, message: string) => {
    const settings = <Settings>store.get("settings");
    console.log("Instance:", message);
    store.set("settings", {
      ...settings,
      instance: message,
      minimizeToTray: false
    });
    ipcMain.emit("restart");
  });
}
