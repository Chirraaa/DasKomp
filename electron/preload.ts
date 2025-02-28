/* eslint-disable @typescript-eslint/no-explicit-any */
import { ipcRenderer, contextBridge, IpcRendererEvent } from 'electron'

// --------- Expose some API to the Renderer process ---------
contextBridge.exposeInMainWorld('ipcRenderer', {
  invoke: (channel: string, ...args: any) => {
    const validChannels = [
      'open-external-link',
      'open-file-dialog',
      'open-folder-dialog',
      'open-output-folder-dialog',
      'get-file-sizes',
      'get-folder-size',
      'compress-files',
      'save-settings',
      'load-settings',
      'open-folder',
      'open-file-location'
    ];
    if (validChannels.includes(channel)) {
      return ipcRenderer.invoke(channel, ...args);
    }
    return Promise.reject(new Error(`Unauthorized IPC channel: ${channel}`));
  },
  on: (channel: string, callback: (...args: any[]) => void) => {
    const validChannels = ['compression-progress', 'compression-complete'];
    if (validChannels.includes(channel)) {
      // Create properly typed subscription function
      const subscription = (_event: IpcRendererEvent, ...args: any[]) => callback(...args);
      ipcRenderer.on(channel, subscription);

      // Return a function that properly removes the event listener
      return () => {
        ipcRenderer.removeListener(channel, subscription);
      };
    }
    return undefined;
  },
  removeListener: (channel: string, callback: (...args: any[]) => void) => {
    const validChannels = ['compression-complete', 'compression-progress'];
    if (validChannels.includes(channel)) {
      ipcRenderer.removeListener(channel, callback);
    }
  }
});