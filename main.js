const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const dbConnect = require('./dbConnect');

// SET ENV
// process.env.NODE_ENV = 'production';
process.env.ELECTRON_DISABLE_SECURITY_WARNINGS = 'true';

let mainWindow;
let workerWindow;
let progressWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 1000,
    x: 100,
    y: 100,
    icon: path.join(__dirname, '/images/sspu_icon.png'),
    webPreferences: { nodeIntegration: true },
    show: true
  });

  // mainWindow.webContents.openDevTools();
  mainWindow.loadFile('index.html');

  mainWindow.on('closed', () => {
    mainWindow = null;
    workerWindow = null;
    progressWindow = null;
  });

  mainWindow.webContents.on('did-finish-load', () => {
    // eslint-disable-next-line no-use-before-define
    // createProgressWindow('test');
    // mainWindow.show();
  });
}

// WORKER WINDOW
function createWorkerWindow(command) {
  if (process.env.NODE_ENV === 'production') {
    workerWindow = new BrowserWindow({
      show: false,
      webPreferences: {
        nodeIntegration: true
      }
    });
  } else {
    workerWindow = new BrowserWindow({
      width: 1600,
      height: 1080,
      x: 1200,
      y: 50,
      webPreferences: {
        nodeIntegration: true
      }
    });
  }

  workerWindow.loadFile('worker.html');

  if (process.env.NODE_ENV !== 'production') {
    workerWindow.once('ready-to-show', () => {
      workerWindow.show();
    });
  }

  // once worker is ready we send command to execute action
  workerWindow.webContents.on('did-finish-load', () => {
    workerWindow.webContents.send(command);
    // progressWindow.show();
  });

  workerWindow.webContents.openDevTools();
  workerWindow.on('close', function() {
    workerWindow = null;
  });
}

// ACTION WINDOW is used to display current activty and progress
function createProgressWindow(command) {
  // create browser window
  progressWindow = new BrowserWindow({
    parent: mainWindow,
    webPreferences: {
      nodeIntegration: true
    },
    modal: true,
    // frame: false,
    // resizable: false,
    width: 600,
    height: 250,
    x: 200,
    y: 200,
    title: 'Current activity',
    icon: path.join(__dirname, '/images/sspu_icon.png'),
    show: false
  });

  if (process.env.NODE_ENV === 'production') {
    progressWindow.setMenu(null);
  }

  // progressWindow.webContents.openDevTools();
  progressWindow.loadFile('progress.html');
  // progressWindow.once('ready-to-show', () => {
  //   progressWindow.show();
  // });
  progressWindow.on('close', function() {
    progressWindow = null;
    workerWindow.close();
    workerWindow = null;
  });

  // once action window is ready we create worker window
  progressWindow.webContents.on('did-finish-load', () => {
    createWorkerWindow(command);
  });
}

ipcMain.on('import-files', () => {
  createProgressWindow('import-files');
});

ipcMain.on('get-partsurfer-data', () => {
  createProgressWindow('get-partsurfer-data');
});

ipcMain.on('generate-reports', () => {
  createProgressWindow('generate-reports');
});

// forward set-progress events from worker to progress window
ipcMain.on('set-progress', (e, progressStatus) => {
  progressWindow.webContents.send('set-progress', progressStatus);
  if (!progressWindow.isVisible()) {
    progressWindow.show();
  }
});

ipcMain.on('finishedTask', () => {
  progressWindow.close(); // action window should handle worker
  // mainWindow.webContents.send('rebuild-data');
});

app.on('ready', async () => {
  try {
    await dbConnect();
    createWindow();
  } catch (err) {
    app.exit(-1);
  }
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', async () => {
  if (mainWindow === null) {
    try {
      await dbConnect();
      createWindow();
    } catch (err) {
      app.exit(-1);
    }
  }
});
