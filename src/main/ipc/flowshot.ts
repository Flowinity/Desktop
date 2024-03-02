import { ipcMain } from "electron";
import { exec } from "node:child_process";

export default function handleFlowshot(): void {
  ipcMain.on("flowshot-launch", () => {
    exec("flameshot config");
  });

  ipcMain.on("flowshot-version", (event) => {
    exec("flameshot --version", (error, stdout) => {
      if (error) {
        event.reply("flowshot-version", "Not installed");
        return;
      }
      if (
        !stdout.includes("Flowinity") &&
        !stdout.includes("PrivateUploader")
      ) {
        stdout = "Not installed";
      }
      event.reply("flowshot-version", stdout);
    });
  });
}
