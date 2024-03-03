import { ipcMain, Notification, nativeImage, NativeImage } from "electron";
import { MessageSubscription } from "../gql/graphql";
import functions from "../lib/functions";
import { Instance } from "../types/instance";
import Store from "electron-store";
import { Settings } from "../types/settings";
const store = new Store();

export default function handleNotifications(): void {
  ipcMain.on(
    "new-message",
    async (event, message: MessageSubscription & Instance) => {
      const settings = <Settings>store.get("settings");
      if (!settings?.desktopNotifications) return;

      let image: NativeImage | undefined;
      if (message.instance.notificationIcon) {
        const path =
          (await functions.cacheProfilePicture(
            message.instance.notificationIcon
          )) || "";
        image = nativeImage.createFromPath(path);
      }
      const notification = new Notification({
        title: `${message.message?.user?.username} ${
          message.chat.name ? `in ${message.chat.name}` : ""
        }`,
        body: message.message?.content || "",
        icon: image
      });
      notification.show();
      notification.on("click", () => {
        event.reply("focus-chat", message.associationId);
      });
    }
  );
}
