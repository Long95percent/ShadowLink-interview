import { contextBridge } from 'electron';

contextBridge.exposeInMainWorld('shadowlink', {
  platform: process.platform,
  // Will expose: global hotkey registration, clipboard access, system tray controls
});
