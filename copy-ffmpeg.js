/* eslint-disable @typescript-eslint/no-var-requires */
/* eslint-disable no-undef */
// In copy-ffmpeg.js
const fs = require('fs');
const path = require('path');

function copyFFmpegBinary() {
  const platform = process.platform;
  let sourcePath;
  let destPath;
  
  // Get environment

  
  if (platform === 'win32') {
    sourcePath = path.join(__dirname, 'node_modules', '@ffmpeg-installer', 'win32-x64', 'ffmpeg.exe');
    destPath = path.join(__dirname, 'resources', 'ffmpeg.exe');
  } else if (platform === 'darwin') {
    sourcePath = path.join(__dirname, 'node_modules', '@ffmpeg-installer', 'darwin-x64', 'ffmpeg');
    destPath = path.join(__dirname, 'resources', 'ffmpeg');
  } else {
    sourcePath = path.join(__dirname, 'node_modules', '@ffmpeg-installer', 'linux-x64', 'ffmpeg');
    destPath = path.join(__dirname, 'resources', 'ffmpeg');
  }
  
  console.log(`Copying FFmpeg from ${sourcePath} to ${destPath}`);
  console.log('Current directory:', process.cwd());
  
  // Create directory if it doesn't exist
  const destDir = path.dirname(destPath);
  if (!fs.existsSync(destDir)) {
    fs.mkdirSync(destDir, { recursive: true });
  }
  
  // Check if source exists
  if (!fs.existsSync(sourcePath)) {
    throw new Error(`Source FFmpeg not found at: ${sourcePath}`);
  }
  
  // Copy the file
  fs.copyFileSync(sourcePath, destPath);
  
  // On non-Windows platforms, make the binary executable
  if (platform !== 'win32') {
    fs.chmodSync(destPath, '755');
  }
  
  console.log('FFmpeg binary copied successfully');
}

try {
  copyFFmpegBinary();
} catch (error) {
  console.error('Error copying FFmpeg binary:', error);
  process.exit(1);
}