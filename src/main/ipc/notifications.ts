import { ipcMain, Notification } from "electron";
import { MessageSubscription } from "../gql/graphql";
import functions from "../lib/functions";
import { Instance } from "../types/instance";
import Store from "electron-store";
import { Settings } from "../types/settings";
const store = new Store();

export default function handleNotifications(): void {
  const settings = <Settings>store.get("settings");
  if (!settings?.desktopNotifications) return;
  ipcMain.on(
    "new-message",
    async (_event, message: MessageSubscription & Instance) => {
      new Notification({
        title: `${message.message?.user?.username} ${
          message.chat.name ? `in ${message.chat.name}` : ""
        }`,
        body: message.message?.content || "",
        icon: await functions.cacheProfilePicture(
          message.instance.notificationIcon
        )
      }).show();
    }
  );
}
