const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  // Exporter le workspace avec dialogue de sauvegarde
  exportWorkspace: (data) => ipcRenderer.invoke('export-workspace', data),
  // Importer le workspace avec dialogue de sélection
  importWorkspace: () => ipcRenderer.invoke('import-workspace'),
  // Mise à jour
  checkForUpdates: () => ipcRenderer.invoke('check-for-updates'),
  downloadUpdate: () => ipcRenderer.invoke('download-update'),
  installUpdate: () => ipcRenderer.invoke('install-update'),
  // Écouter les événements de mise à jour
  onUpdateStatus: (callback) => {
    ipcRenderer.on('update-status', (event, data) => callback(data));
  },
  onUpdateProgress: (callback) => {
    ipcRenderer.on('update-progress', (event, data) => callback(data));
  }
});

