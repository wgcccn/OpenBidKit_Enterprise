const { ipcMain } = require('electron');

function registerBusinessBidIpc({ businessBidStore }) {
  ipcMain.handle('business-bid:load-state', () => businessBidStore.loadState());
  ipcMain.handle('business-bid:save-state', (_event, state) => businessBidStore.saveState(state));
  ipcMain.handle('business-bid:clear', () => businessBidStore.clear());
}

module.exports = {
  registerBusinessBidIpc,
};
