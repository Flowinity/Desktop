export interface Settings {
  startup: boolean;
  minimizeToTray: boolean;
  desktopNotifications: boolean;
  autoUpdate: boolean;
  windowBorder: boolean;
  restartRequired?: boolean;
  startMinimized: boolean;
  instance: null | string;
}
