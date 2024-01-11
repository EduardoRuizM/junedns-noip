const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  getConfig: () => ipcRenderer.invoke('getConfig'),
  saveCode: (c, t) => ipcRenderer.invoke('saveCode', c, t),
  sendCode: c => ipcRenderer.invoke('sendCode', c)
});
