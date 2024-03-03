import { Chat, User } from "../gql/graphql";
import path from "node:path";
import { app } from "electron";
import axios from "axios";
import * as fs from "fs";

export default {
  avatar(chat: Chat | User, domain: string): string | undefined {
    if (!chat) return undefined;
    if ("username" in chat) {
      if (chat.avatar && chat.avatar.length > 20) {
        return "https://colubrina.troplo.com/usercontent/" + chat.avatar;
      } else if (chat.avatar) {
        return domain + chat.avatar;
      } else {
        return undefined;
      }
    }
    if (
      chat.type === "direct" &&
      chat.recipient?.avatar &&
      chat.recipient.avatar.length > 20
    ) {
      return (
        "https://colubrina.troplo.com/usercontent/" + chat.recipient.avatar
      );
    } else if (chat.type === "direct" && chat.recipient?.avatar) {
      return domain + chat.recipient.avatar;
    } else if (chat.type === "direct" && !chat.recipient?.avatar) {
      return undefined;
    } else if (chat.type === "group" && chat.icon?.length! > 20) {
      return "https://colubrina.troplo.com/usercontent/" + chat.icon;
    } else if (chat.type === "group" && chat.icon) {
      return domain + chat.icon;
    } else {
      return undefined;
    }
  },
  async cacheProfilePicture(
    avatar: string | undefined
  ): Promise<string | undefined> {
    if (!avatar) return undefined;
    const userDataPath = app.getPath("appData");
    if (!userDataPath) return undefined;
    const attachment = avatar.split("/")[avatar.split("/").length - 1];
    const profilePicturePath = path.join(
      `${userDataPath}/flowinity/picture_cache/${attachment}`
    );
    // ensure max of 50 cached images
    // if flowinity folder doesn't exist, create it
    if (!fs.existsSync(`${userDataPath}/flowinity`)) {
      fs.mkdirSync(`${userDataPath}/flowinity`);
    }
    if (!fs.existsSync(`${userDataPath}/flowinity/picture_cache`)) {
      fs.mkdirSync(`${userDataPath}/flowinity/picture_cache`);
    }
    // now cache it and return a file:// path
    const response = await axios({
      url: avatar,
      responseType: "stream"
    });
    response.data.pipe(fs.createWriteStream(profilePicturePath));
    const files = fs.readdirSync(`${userDataPath}/flowinity/picture_cache`);
    if (files.length > 50) {
      fs.unlinkSync(`${userDataPath}/flowinity/picture_cache/${files[0]}`);
    }
    return profilePicturePath;
  }
};
