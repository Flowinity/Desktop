import { ElectronAPI } from "@electron-toolkit/preload";
import { Chat, PartialUserFriend } from "./gql/graphql";

declare global {
  interface Window {
    tpuInternals: {
      processLink: (link: string) => void;
      readChat: () => void;
      lookupUser: (id: number) => PartialUserFriend;
      lookupChat: (id: number) => Chat;
      openUser: (id: number) => void;
      setChat: (id: number) => void;
      lookupCollection: (id: number) => any;
      openCollection: (id: number) => void;
      openEmoji: (...args) => void;
      imageDomain: string | undefined;
    };
    _paq: {
      push: (args: any[]) => void;
    };
    _cordovaNative: any;
    cordova?: any;
    central: {
      user: any;
      emit: (platform: string, event: string, data: any) => void;
    };
    __TROPLO_INTERNALS_EDITOR_SAVE: (args: any) => any;
    __TROPLO_INTERNALS_UPDATE_COUNT: (args: any) => any;
    __TROPLO_INTERNALS_EDITOR_UPLOAD: (args: any) => any;
    __TROPLO_INTERNALS_NOTE_ID: number;
    __NOTE_DATA: any;
    electron: ElectronAPI | undefined;
  }
}
