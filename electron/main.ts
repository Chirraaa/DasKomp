/* eslint-disable no-async-promise-executor */
/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable no-useless-escape */
/* eslint-disable prefer-const */
/* eslint-disable no-inner-declarations */
/* eslint-disable no-empty */
/* eslint-disable @typescript-eslint/no-var-requires */
/* eslint-disable no-useless-catch */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { app, BrowserWindow, ipcMain, dialog, shell } from 'electron'
import path from 'node:path'
import { readdir, lstat } from 'fs/promises';
import { join } from 'path';
import { stat } from 'fs/promises';
import ffmpeg from 'fluent-ffmpeg';
import { execSync } from 'child_process';
import os from 'os';
const fs = require('fs');


const settingsPath = path.join(app.getPath('userData'), 'settings.json');


let ffmpegPath: string;

if (app.isPackaged) {
  if (process.platform === 'win32') {
    ffmpegPath = path.join(process.resourcesPath, 'ffmpeg.exe');
  } else {
    ffmpegPath = path.join(process.resourcesPath, 'ffmpeg');
  }

  console.log('Using FFmpeg from resources:', ffmpegPath);
} else {
  // In development
  try {
    // Try system path first
    if (process.platform === 'win32') {
      execSync('where ffmpeg');
      ffmpegPath = 'ffmpeg';
    } else {
      execSync('which ffmpeg');
      ffmpegPath = 'ffmpeg';
    }
    console.log('Using system FFmpeg');
  } catch (e) {
    // Fall back to local copy
    if (process.platform === 'win32') {
      ffmpegPath = path.join(__dirname, '../resources/ffmpeg.exe');
    } else {
      ffmpegPath = path.join(__dirname, '../resources/ffmpeg');
    }
    console.log('Using local FFmpeg:', ffmpegPath);
  }
}

// Add a check to verify FFmpeg exists
if (ffmpegPath !== 'ffmpeg') {
  if (!fs.existsSync(ffmpegPath)) {
    console.error('FFmpeg binary not found at:', ffmpegPath);
  } else {
    console.log('FFmpeg binary confirmed at:', ffmpegPath);
  }
}

// Set the ffmpeg path
ffmpeg.setFfmpegPath(ffmpegPath);
console.log('Using FFmpeg path:', ffmpegPath);




// The built directory structure
//
// ├─┬─┬ dist
// │ │ └── index.html
// │ │
// │ ├─┬ dist-electron
// │ │ ├── main.js
// │ │ └── preload.js
// │
process.env.DIST = path.join(__dirname, '../dist')
process.env.VITE_PUBLIC = app.isPackaged ? process.env.DIST : path.join(process.env.DIST, '../public')


let win: BrowserWindow | null

// 🚧 Use ['ENV_NAME'] avoid vite:define plugin - Vite@2.x
const VITE_DEV_SERVER_URL = process.env['VITE_DEV_SERVER_URL']

function createWindow() {
  const isDevelopment = !app.isPackaged;

  win = new BrowserWindow({
    icon: path.join(process.env.VITE_PUBLIC, 'icon.png'),
    width: 460,
    height: 780,
    resizable: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false,
      devTools: isDevelopment,
    },
    autoHideMenuBar: !isDevelopment,
    frame: true,
  })

  win.webContents.on('did-finish-load', () => {
    win?.webContents.send('main-process-message', (new Date).toLocaleString())
  })

  if (VITE_DEV_SERVER_URL) {
    win.loadURL(VITE_DEV_SERVER_URL)
  } else {
    win.loadFile(path.join(process.env.DIST, 'index.html'))
  }

  if (!app.isPackaged) {
    win.webContents.openDevTools();
  }
}

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
    win = null
  }
})

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow()
  }
})

app.on('ready', () => {
  const logPath = path.join(app.getPath('userData'), 'error.log');
  process.on('uncaughtException', (error) => {
    fs.appendFileSync(logPath, `Uncaught Exception: ${error.toString()}\n${error.stack}\n`);
  });
});

app.whenReady().then(createWindow)




ipcMain.handle('open-external-link', (_event, url) => {
  shell.openExternal(url);
});

ipcMain.handle('open-file-dialog', async (_, options) => {
  if (!win) return { canceled: true };
  return await dialog.showOpenDialog(win, options);
});

ipcMain.handle('open-folder-dialog', async () => {
  if (!win) return { canceled: true };
  return await dialog.showOpenDialog(win, {
    properties: ['openDirectory']
  });
});

ipcMain.handle('open-output-folder-dialog', async () => {
  if (!win) return { canceled: true };
  return await dialog.showOpenDialog(win, {
    properties: ['openDirectory'],
    title: 'Select Output Folder',
    buttonLabel: 'Select'
  });
});

ipcMain.handle('get-file-sizes', async (_, filePaths: string[]) => {
  try {
    const sizes = await Promise.all(filePaths.map(async (path) => {
      const stats = await stat(path);
      return stats.size;
    }));
    return sizes;
  } catch (error) {
    console.error('Error getting file sizes:', error);
    return filePaths.map(() => 0);
  }
});

ipcMain.handle('get-folder-size', async (_, folderPath: string) => {
  try {
    let totalSize = 0;

    async function calculateFolderSize(folderPath: string): Promise<number> {
      let size = 0;
      const items = await readdir(folderPath);

      for (const item of items) {
        const itemPath = join(folderPath, item);
        const stats = await lstat(itemPath);

        if (stats.isFile()) {
          size += stats.size;
        } else if (stats.isDirectory()) {
          size += await calculateFolderSize(itemPath);
        }
      }

      return size;
    }

    totalSize = await calculateFolderSize(folderPath);
    return totalSize;
  } catch (error) {
    console.error('Error calculating folder size:', error);
    return 0;
  }
});


ipcMain.handle('compress-files', async (_, options) => {
  try {
    const { files, outputFolder, targetSize, format, compressionType, videoCodec } = options;

    console.log('Compressing files with options:', options);

    if (files.length === 1 && files[0].endsWith('.mp4')) {
      const inputPath = files[0];
      const fileName = inputPath.split(/[\\\/]/).pop()?.split('.')[0] || 'compressed';
      const outputPath = join(outputFolder, `${fileName}_compressed.${format}`);

      // Create a temporary pass log file path based on platform
      const passLogPath = process.platform === 'win32'
        ? path.join(os.tmpdir(), 'ffmpeg2pass')
        : path.join('/tmp', 'ffmpeg2pass');

      // Create a promise to handle the ffmpeg process
      return new Promise(async (resolve, reject) => {
        // Get video duration to calculate bitrate
        try {
          const videoInfo = await getVideoInfo(inputPath);
          const durationSec = videoInfo.duration;
          const audioInfo = videoInfo.audioInfo;

          // If duration couldn't be determined, fall back to a default approach
          if (!durationSec) {
            console.warn('Could not determine video duration, using default compression approach');
            return fallbackCompression(inputPath, outputPath, targetSize, compressionType, videoCodec, resolve, reject);
          }

          // Calculate target bitrate based on file size and duration
          // Target size is in MB, convert to kilobits
          // Reserve ~10% for audio (or use detected audio bitrate if available)
          const targetSizeKilobits = targetSize * 8 * 1024;
          const audioBitrateKbps = audioInfo?.bitrate ? (audioInfo.bitrate / 1000) : 128;
          const audioBitrateBudget = audioBitrateKbps * durationSec;
          const videoBitrateBudget = targetSizeKilobits - audioBitrateBudget;
          const targetVideoBitrateKbps = Math.max(100, Math.floor(videoBitrateBudget / durationSec));

          console.log(`Video duration: ${durationSec}s, Calculated video bitrate: ${targetVideoBitrateKbps}kbps, Audio bitrate: ${audioBitrateKbps}kbps`);

          // Select codec based on user choice
          const videoCodecName = videoCodec === 'h265' ? 'libx265' : 'libx264';

          if (compressionType === 'auto') {
            // For best results, use two-pass encoding with calculated bitrate
            // First pass
            let firstPass = ffmpeg(inputPath)
              .videoCodec(videoCodecName)
              .videoBitrate(targetVideoBitrateKbps)
              .addOption('-pass', '1')
              .addOption('-f', 'null');

            // Add codec-specific options
            if (videoCodecName === 'libx265') {
              firstPass.addOption('-x265-params', `pass=1:log-level=error`);
            } else {
              firstPass.addOption('-passlogfile', passLogPath);
            }

            // Add different null output based on platform
            if (process.platform === 'win32') {
              firstPass.output('NUL');
            } else {
              firstPass.output('/dev/null');
            }

            // Progress handler for first pass
            firstPass.on('progress', (progress) => {
              if (win) {
                const percent = (progress.percent || 0) / 2; // First pass is 50% of total
                win.webContents.send('compression-progress', percent);
              }
            });

            firstPass.on('end', () => {
              console.log('First pass completed');

              // Second pass with calculated bitrate
              const secondPass = ffmpeg(inputPath)
                .videoCodec(videoCodecName)
                .videoBitrate(targetVideoBitrateKbps)
                .addOption('-pass', '2')
                .addOption('-maxrate', `${targetVideoBitrateKbps * 1.5}k`)
                .addOption('-bufsize', `${targetVideoBitrateKbps * 3}k`);

              // Add codec-specific options
              if (videoCodecName === 'libx265') {
                secondPass.addOption('-x265-params', `pass=2:log-level=error`);
              } else {
                secondPass.addOption('-passlogfile', passLogPath);
              }

              // Set audio options
              secondPass.audioCodec('aac')
                .audioBitrate(`${audioBitrateKbps}k`);

              secondPass.output(outputPath);

              // Progress handler for second pass
              secondPass.on('progress', (progress) => {
                if (win) {
                  // Second pass starts at 50%
                  const percent = 50 + (progress.percent || 0) / 2;
                  win.webContents.send('compression-progress', percent);
                }
              });

              secondPass.on('end', () => {
                if (win) {
                  win.webContents.send('compression-complete');
                }
                resolve({ success: true, outputPath });
              });

              secondPass.on('error', (err) => {
                console.error('FFmpeg second pass error:', err);
                reject(err);
              });

              secondPass.run();
            });

            firstPass.on('error', (err) => {
              console.error('FFmpeg first pass error:', err);
              reject(err);
            });

            firstPass.run();
          } else {
            // Other compression types with codec selection
            let command = ffmpeg(inputPath);

            // Apply the selected video codec
            command = command.videoCodec(videoCodecName);

            // Add codec-specific options
            if (videoCodecName === 'libx265') {
              // H.265 generally needs a lower CRF value for equivalent quality
              switch (compressionType) {
                case 'fast':
                  command = command
                    .addOption('-preset', 'superfast')
                    .addOption('-crf', '28');
                  break;
                case 'balanced':
                  command = command
                    .addOption('-preset', 'medium')
                    .addOption('-crf', '23');
                  break;
                case 'quality':
                  command = command
                    .addOption('-preset', 'slow')
                    .addOption('-crf', '18');
                  break;
              }
            } else {
              // H.264 settings
              switch (compressionType) {
                case 'fast':
                  command = command
                    .addOption('-preset', 'ultrafast')
                    .addOption('-crf', '28');
                  break;
                case 'balanced':
                  command = command
                    .addOption('-preset', 'medium')
                    .addOption('-crf', '23');
                  break;
                case 'quality':
                  command = command
                    .addOption('-preset', 'slow')
                    .addOption('-crf', '18');
                  break;
              }
            }

            command.audioCodec('aac')
              .audioBitrate(`${audioBitrateKbps}k`)
              .output(outputPath);

            // Add progress handling
            command.on('progress', (progress) => {
              if (win) {
                const percent = progress.percent || 0;
                win.webContents.send('compression-progress', percent);
              }
            });

            command.on('end', () => {
              if (win) {
                win.webContents.send('compression-complete');
              }
              resolve({ success: true, outputPath });
            });
            

            command.on('error', (err) => {
              console.error('FFmpeg error:', err);
              reject(err);
            });

            // Run the command
            command.run();
          }
        } catch (error) {
          console.error('Error getting video info:', error);
          return fallbackCompression(inputPath, outputPath, targetSize, compressionType, videoCodec, resolve, reject);
        }
      });
    }

    return { success: true };
  } catch (error) {
    console.error('Compression error:', error);
    throw error;
  }
});

// Helper function to get video information including duration
function getVideoInfo(inputPath: string): Promise<{ duration: number; audioInfo?: { bitrate: number } }> {
  return new Promise((resolve, _reject) => {
    // First try using ffprobe if available
    ffmpeg.ffprobe(inputPath, (err, metadata) => {
      if (err) {
        console.log('FFprobe failed, using FFmpeg for duration extraction instead');

        // Fallback to using ffmpeg directly to extract duration
        let durationOutput = '';

        const command = ffmpeg(inputPath)
          .outputOptions(['-hide_banner'])
          // Get format information only
          .outputOptions(['-f', 'null'])
          .output('-');

        // Capture stderr output which contains duration info
        command.on('stderr', (stderrLine) => {
          durationOutput += stderrLine + '\n';
        });

        command.on('end', () => {
          console.log('FFmpeg info extraction completed');

          // Try to extract duration from the output
          let duration = 60; // Default fallback duration (1 minute)

          // Regular expression to match duration
          const durationMatch = durationOutput.match(/Duration: (\d{2}):(\d{2}):(\d{2})\.(\d{2})/);
          if (durationMatch) {
            const hours = parseInt(durationMatch[1]);
            const minutes = parseInt(durationMatch[2]);
            const seconds = parseInt(durationMatch[3]);
            const centiseconds = parseInt(durationMatch[4]);

            duration = hours * 3600 + minutes * 60 + seconds + centiseconds / 100;
            console.log(`Extracted duration: ${duration} seconds`);
          }

          // Try to extract audio bitrate from the output
          let audioBitrate = 128000; // Default fallback bitrate (128kbps)

          // Regular expression to match audio bitrate
          const audioMatch = durationOutput.match(/Audio: .+, (\d+) kb\/s/);
          if (audioMatch) {
            audioBitrate = parseInt(audioMatch[1]) * 1000;
            console.log(`Extracted audio bitrate: ${audioBitrate} bps`);
          }

          resolve({
            duration: duration,
            audioInfo: {
              bitrate: audioBitrate
            }
          });
        });

        command.on('error', (ffmpegErr) => {
          console.error('Error running FFmpeg for info extraction:', ffmpegErr);
          // If all fails, provide default values
          resolve({
            duration: 60, // Default to 1 minute
            audioInfo: {
              bitrate: 128000 // Default to 128kbps
            }
          });
        });

        // Run the command
        command.run();
      } else {
        // Successfully got metadata from ffprobe
        const duration = metadata.format.duration || 0;
        let audioInfo;

        // Try to find audio stream info
        const audioStream = metadata.streams.find(stream => stream.codec_type === 'audio');
        if (audioStream && audioStream.bit_rate) {
          audioInfo = {
            bitrate: typeof audioStream.bit_rate === 'string'
              ? parseInt(audioStream.bit_rate)
              : audioStream.bit_rate
          };
        } else if (metadata.format.bit_rate) {
          // Fallback to format bitrate if stream bitrate is not available
          // Assume audio is roughly 10% of total bitrate
          const totalBitrate = typeof metadata.format.bit_rate === 'string'
            ? parseInt(metadata.format.bit_rate)
            : metadata.format.bit_rate;
          audioInfo = {
            bitrate: Math.floor(totalBitrate * 0.1)
          };
        } else {
          // Default audio bitrate if none found
          audioInfo = {
            bitrate: 128000 // 128kbps
          };
        }

        resolve({ duration, audioInfo });
      }
    });
  });
}

// Fallback compression when we can't determine video duration
function fallbackCompression(
  inputPath: string,
  outputPath: string,
  targetSize: number,
  compressionType: string,
  videoCodec: string,
  resolve: (value: any) => void,
  reject: (reason?: any) => void
) {
  const videoCodecName = videoCodec === 'h265' ? 'libx265' : 'libx264';
  let command = ffmpeg(inputPath);

  // For target size, use a combination of crf and maxrate as a fallback
  if (compressionType === 'auto') {
    const maxrateBitrate = targetSize * 8 * 1024 / 60; // Assume 1 minute for calculation
    command = command
      .videoCodec(videoCodecName)
      .addOption('-crf', videoCodecName === 'libx265' ? '28' : '23')
      .addOption('-maxrate', `${maxrateBitrate}k`)
      .addOption('-bufsize', `${maxrateBitrate * 2}k`);
  } else {
    // Use the standard presets for other compression types
    if (videoCodecName === 'libx265') {
      switch (compressionType) {
        case 'fast':
          command = command
            .videoCodec(videoCodecName)
            .addOption('-preset', 'superfast')
            .addOption('-crf', '28');
          break;
        case 'balanced':
          command = command
            .videoCodec(videoCodecName)
            .addOption('-preset', 'medium')
            .addOption('-crf', '23');
          break;
        case 'quality':
          command = command
            .videoCodec(videoCodecName)
            .addOption('-preset', 'slow')
            .addOption('-crf', '18');
          break;
      }
    } else {
      switch (compressionType) {
        case 'fast':
          command = command
            .videoCodec(videoCodecName)
            .addOption('-preset', 'ultrafast')
            .addOption('-crf', '28');
          break;
        case 'balanced':
          command = command
            .videoCodec(videoCodecName)
            .addOption('-preset', 'medium')
            .addOption('-crf', '23');
          break;
        case 'quality':
          command = command
            .videoCodec(videoCodecName)
            .addOption('-preset', 'slow')
            .addOption('-crf', '18');
          break;
      }
    }
  }

  command.audioCodec('aac')
    .audioBitrate('128k')
    .output(outputPath);

  // Add progress handling
  command.on('progress', (progress) => {
    if (win && progress.percent !== undefined) {
      const percent = Math.round(progress.percent);
      console.log('About to send progress update:', percent);
      win.webContents.send('compression-progress', percent);
    }
  });

  command.on('end', () => {
    if (win) {
      win.webContents.send('compression-complete');
    }
    resolve({ success: true, outputPath });
  });

  command.on('error', (err) => {
    console.error('FFmpeg error:', err);
    reject(err);
  });

  // Run the command
  command.run();
}


ipcMain.handle('load-settings', async () => {
  try {
    if (fs.existsSync(settingsPath)) {
      const data = fs.readFileSync(settingsPath, 'utf8');
      return JSON.parse(data);
    }
    return {}; // Return empty object if settings file doesn't exist yet
  } catch (error) {
    console.error('Error loading settings:', error);
    return {}; // Return empty object on error
  }
});

ipcMain.handle('save-settings', async (_event, settings) => {
  try {
    fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2), 'utf8');
    return true;
  } catch (error) {
    console.error('Error saving settings:', error);
    return false;
  }
});

ipcMain.handle('open-folder', (_, folderPath) => {
  try {
    shell.openPath(folderPath);
    return true;
  } catch (error) {
    console.error('Error opening folder:', error);
    return false;
  }
});

ipcMain.handle('open-file-location', (_, filePath) => {
  try {
    if (process.platform === 'darwin') {
      // macOS: reveal in Finder
      shell.showItemInFolder(filePath);
    } else {
      // Windows/Linux: open containing folder
      const folderPath = path.dirname(filePath);
      shell.openPath(folderPath);
    }
    return true;
  } catch (error) {
    console.error('Error opening file location:', error);
    return false;
  }
});