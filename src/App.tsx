/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable react-hooks/exhaustive-deps */
/* eslint-disable no-useless-escape */
/* eslint-disable @typescript-eslint/no-unused-vars */
import React, { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Trash2, Github, Twitter, Settings, Upload, FileVideo, Folder, File, LoaderCircle } from 'lucide-react';
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";

const App: React.FC = () => {
  const [files, setFiles] = useState<{ name: string; size: number; type: string; path: string }[]>([]);
  const [outputSize, setOutputSize] = useState<number>(10); // Target size in MB
  const [compressionType, setCompressionType] = useState<string>("fast");
  const [outputFormat, setOutputFormat] = useState<string>("mp4");
  const [isCompressing, setIsCompressing] = useState<boolean>(false);
  const [showSettings, setShowSettings] = useState<boolean>(false);
  const [darkMode, setDarkMode] = useState<boolean>(true);
  const [outputFolder, setOutputFolder] = useState<string>("");
  const [videoCodec, setVideoCodec] = useState<string>("h265");

  const [isCompressionComplete, setIsCompressionComplete] = useState<boolean>(false);
  const [compressionMode, setCompressionMode] = useState<string>("target"); // "target" or "percentage"
  const [compressionPercentage, setCompressionPercentage] = useState<number>(10); // 10% by default
  const [lastOutputPath,] = useState<string>(""); // Store the last output path

  // Compression formats based on file type
  const videoFormats = ["mp4", "webm", "mov", "avi", "mkv"];
  const imageFormats = ["jpg", "png", "webp"];
  const archiveFormats = ["zip", "7z", "tar.gz"];


  // Load saved settings when component mounts
  useEffect(() => {
    const loadSettings = async () => {
      try {
        // Load saved settings from Electron's store
        const savedSettings = await window.ipcRenderer.invoke('load-settings');

        if (savedSettings) {
          // If there's a saved output folder, use it
          if (savedSettings.outputFolder) {
            setOutputFolder(savedSettings.outputFolder);
          }

          // You can also load other settings here if needed
          if (savedSettings.darkMode !== undefined) {
            setDarkMode(savedSettings.darkMode);
          }

          if (savedSettings.outputSize !== undefined) {
            setOutputSize(savedSettings.outputSize);
          }

          if (savedSettings.compressionType) {
            setCompressionType(savedSettings.compressionType);
          }

          if (savedSettings.videoCodec) {
            setVideoCodec(savedSettings.videoCodec);
          }

          if (savedSettings.compressionMode) {
            setCompressionMode(savedSettings.compressionMode);
          }
          if (savedSettings.compressionPercentage !== undefined) {
            setCompressionPercentage(savedSettings.compressionPercentage);
          }

          // Update the save settings function
          await window.ipcRenderer.invoke('save-settings', {
            outputFolder,
            darkMode,
            outputSize,
            compressionType,
            videoCodec,
            compressionMode,
            compressionPercentage
          });
        }
      } catch (error) {
        console.error('Error loading settings:', error);
      }
    };

    loadSettings();
  }, []);

  // Save settings whenever they change
  useEffect(() => {
    const saveSettings = async () => {
      try {
        await window.ipcRenderer.invoke('save-settings', {
          outputFolder,
          darkMode,
          outputSize,
          compressionType,
          videoCodec
        });
      } catch (error) {
        console.error('Error saving settings:', error);
      }
    };

    // Don't save on initial load (empty string is the default state)
    if (outputFolder !== "" || darkMode !== true) {
      saveSettings();
    }
  }, [outputFolder, darkMode, outputSize, compressionType, videoCodec]);

  const handleOpenLink = (url: string) => {
    window.ipcRenderer.invoke('open-external-link', url);
  };

  const handleFileSelect = async () => {
    try {
      const result = await window.ipcRenderer.invoke('open-file-dialog', {
        properties: ['openFile', 'multiSelections'],
        filters: [
          { name: 'Media Files', extensions: ['mp4', 'mov', 'avi', 'jpg', 'png', 'pdf'] },
          { name: 'All Files', extensions: ['*'] }
        ]
      });

      if (result.canceled) return;

      const selectedFiles = result.filePaths.map((path: string) => {
        const name = path.split(/[\\\/]/).pop() || '';
        const extension = name.split('.').pop()?.toLowerCase() || '';
        let type = 'file';

        if (['mp4', 'mov', 'avi', 'webm', 'mkv'].includes(extension)) {
          type = 'video';
          setOutputFormat('mp4');
        } else if (['jpg', 'png', 'webp', 'gif'].includes(extension)) {
          type = 'image';
          setOutputFormat('jpg');
        } else {
          setOutputFormat('zip');
        }

        return {
          name,
          size: 0, // This would be populated by electron's fs module
          type,
          path
        };
      });

      setFiles(prev => [...prev, ...selectedFiles]);

      // Get file sizes asynchronously
      const sizes = await window.ipcRenderer.invoke('get-file-sizes', result.filePaths);
      setFiles(prev => prev.map((file, i) => ({
        ...file,
        size: sizes[i] || 0
      })));
    } catch (error) {
      console.error('Error selecting files:', error);
    }
  };

  const handleFolderSelect = async () => {
    try {
      const result = await window.ipcRenderer.invoke('open-folder-dialog');
      if (result.canceled) return;

      const folderPath = result.filePaths[0];
      const folderName = folderPath.split(/[\\\/]/).pop() || 'Folder';

      setFiles(prev => [...prev, {
        name: folderName,
        size: 0, // This would be populated by electron's fs module
        type: 'folder',
        path: folderPath
      }]);

      // Get folder size asynchronously
      const size = await window.ipcRenderer.invoke('get-folder-size', folderPath);
      setFiles(prev => prev.map(file =>
        file.path === folderPath ? { ...file, size } : file
      ));
    } catch (error) {
      console.error('Error selecting folder:', error);
    }
  };

  const handleOutputFolderSelect = async () => {
    try {
      const result = await window.ipcRenderer.invoke('open-output-folder-dialog');
      if (!result.canceled) {
        setOutputFolder(result.filePaths[0]);
        // We'll save this automatically through the useEffect
      }
    } catch (error) {
      console.error('Error selecting output folder:', error);
    }
  };

  const handleRemoveFile = (index: number) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleStartCompression = async () => {
    if (files.length === 0 || !outputFolder) return;

    setIsCompressing(true);

    try {
      let targetSizeToUse = outputSize;
      if (compressionMode === "percentage") {
        // Calculate total size of files
        const totalSize = files.reduce((acc, file) => acc + file.size, 0);
        // Convert bytes to MB and apply percentage
        targetSizeToUse = (totalSize / 1024 / 1024) * (compressionPercentage / 100);
      }

      // Update the compress-files call
      await window.ipcRenderer.invoke('compress-files', {
        files: files.map(f => f.path),
        outputFolder,
        targetSize: targetSizeToUse,
        format: outputFormat,
        compressionType,
        videoCodec
      });
    } catch (error) {
      console.error('Compression error:', error);
      setIsCompressing(false);
    }
  };

  useEffect(() => {
    if (isCompressing) {
      // We no longer need to check progress >= 100
      return;
    }
  }, [isCompressing]);

  useEffect(() => {
    // We can simplify this since we don't need progress updates anymore
    const handleCompressionComplete = () => {
      setIsCompressing(false);
      setIsCompressionComplete(true);
      setFiles([]);
    };

    // Listen for completion instead of progress
    const cleanup = window.ipcRenderer.on('compression-complete', handleCompressionComplete);

    return () => {
      if (cleanup) cleanup();
    };
  }, []);

  const handleOpenOutputFolder = () => {
    // For individual files, open the containing folder and possibly select the file
    if (lastOutputPath) {
      window.ipcRenderer.invoke('open-file-location', lastOutputPath);
    } else {
      window.ipcRenderer.invoke('open-folder', outputFolder);
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const getFileIcon = (type: string) => {
    switch (type) {
      case 'video': return <FileVideo className="mr-2" size={16} />;
      case 'folder': return <Folder className="mr-2" size={16} />;
      default: return <File className="mr-2" size={16} />;
    }
  };


  useEffect(() => {
    // Apply dark mode
    if (darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [darkMode]);

  useEffect(() => {
    // Define the event handler function
    const handleCompressionComplete = () => {
      console.log('Compression complete event received');
      setIsCompressing(false);
      setIsCompressionComplete(true);
      setFiles([]);
    };

  
    // Add event listeners and store their cleanup functions
    const completeCleanup = window.ipcRenderer.on('compression-complete', handleCompressionComplete);
  
    // Return a cleanup function that calls both cleanup functions
    return () => {
      if (completeCleanup) completeCleanup();
    };
  }, []);

  
  return (
    <div className="p-4 max-w-md mx-auto">
      <Card className="mb-4">
        <CardHeader className="pb-2">
          <div className="flex justify-between items-center">
            <CardTitle className="text-xl">DasKomp</CardTitle>
            <Button variant="ghost" size="icon" onClick={() => setShowSettings(!showSettings)}>
              <Settings size={20} />
            </Button>
          </div>
        </CardHeader>

        {showSettings && (
          <CardContent className="pb-2 pt-0">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label htmlFor="dark-mode">Dark Mode</Label>
                <Switch
                  id="dark-mode"
                  checked={darkMode}
                  onCheckedChange={setDarkMode}
                />
              </div>

              <div className="space-y-1">
                <Label htmlFor="output-folder">Output Folder</Label>
                <div className="flex gap-2">
                  <Input
                    id="output-folder"
                    value={outputFolder}
                    placeholder="Select output location"
                    readOnly
                    className="flex-1"
                  />
                  <Button variant="outline" onClick={handleOutputFolderSelect}>
                    Browse
                  </Button>
                </div>
              </div>
            </div>
          </CardContent>
        )}

        <CardContent>
          <Tabs defaultValue="options" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="options">Compression Options</TabsTrigger>
              <TabsTrigger value="files">Files ({files.length})</TabsTrigger>
            </TabsList>

            <TabsContent value="options" className="mt-4 space-y-4">
              <div className="space-y-2">
                <Label>Compression Mode</Label>
                <div className="flex space-x-4">
                  <div className="flex items-center space-x-2">
                    <input
                      type="radio"
                      id="target-mode"
                      name="compression-mode"
                      checked={compressionMode === "target"}
                      onChange={() => setCompressionMode("target")}
                    />
                    <Label htmlFor="target-mode">Target Size</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <input
                      type="radio"
                      id="percentage-mode"
                      name="compression-mode"
                      checked={compressionMode === "percentage"}
                      onChange={() => setCompressionMode("percentage")}
                    />
                    <Label htmlFor="percentage-mode">Percentage</Label>
                  </div>
                </div>
              </div>

              {/* Show different controls based on compression mode */}
              {compressionMode === "target" ? (
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <Label htmlFor="output-size">Target Size: {outputSize} MB</Label>
                  </div>
                  <Slider
                    id="output-size"
                    min={1}
                    max={100}
                    step={1}
                    value={[outputSize]}
                    onValueChange={(value) => setOutputSize(value[0])}
                  />
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <Label htmlFor="compression-percentage">
                      Compression: {compressionPercentage}%
                      {files.length > 0 && (
                        <span className="text-xs text-muted-foreground ml-2">
                          (Approx. {Math.round((files.reduce((acc, file) => acc + file.size, 0) / 1024 / 1024) * (compressionPercentage / 100))} MB)
                        </span>
                      )}
                    </Label>
                  </div>
                  <Slider
                    id="compression-percentage"
                    min={1}
                    max={100}
                    step={1}
                    value={[compressionPercentage]}
                    onValueChange={(value) => setCompressionPercentage(value[0])}
                  />
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="compression-type">Compression Method</Label>
                <Select value={compressionType} onValueChange={setCompressionType}>
                  <SelectTrigger id="compression-type">
                    <SelectValue placeholder="Select compression method" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="auto">Auto (Recommended)</SelectItem>
                    <SelectItem value="fast">Fast (Lower Quality)</SelectItem>
                    <SelectItem value="balanced">Balanced</SelectItem>
                    <SelectItem value="quality">High Quality (Slower)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="output-format">Output Format</Label>
                <Select value={outputFormat} onValueChange={setOutputFormat}>
                  <SelectTrigger id="output-format">
                    <SelectValue placeholder="Select output format" />
                  </SelectTrigger>
                  <SelectContent>
                    {files.length > 0 && files[0].type === 'video' ? (
                      videoFormats.map(format => (
                        <SelectItem key={format} value={format}>{format.toUpperCase()}</SelectItem>
                      ))
                    ) : files.length > 0 && files[0].type === 'image' ? (
                      imageFormats.map(format => (
                        <SelectItem key={format} value={format}>{format.toUpperCase()}</SelectItem>
                      ))
                    ) : (
                      archiveFormats.map(format => (
                        <SelectItem key={format} value={format}>{format.toUpperCase()}</SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="video-codec">Video Codec</Label>
                <Select value={videoCodec} onValueChange={setVideoCodec}>
                  <SelectTrigger id="video-codec">
                    <SelectValue placeholder="Select video codec" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="h264">H.264 (More Compatible)</SelectItem>
                    <SelectItem value="h265">H.265/HEVC (Better Compression)</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  H.265 provides better compression but may be slower and less compatible with some devices.
                </p>
              </div>
            </TabsContent>

            <TabsContent value="files" className="mt-4">
              {files.length > 0 ? (
                <ScrollArea className="h-48">
                  <div className="space-y-2">
                    {files.map((file, index) => (
                      <div key={index} className="flex items-center justify-between bg-muted p-2 rounded-md">
                        <div className="flex items-center overflow-hidden">
                          {getFileIcon(file.type)}
                          <div className="truncate">
                            <div className="truncate text-sm font-medium">{file.name}</div>
                            <div className="text-xs text-muted-foreground">{formatFileSize(file.size)}</div>
                          </div>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleRemoveFile(index)}
                          disabled={isCompressing}
                        >
                          <Trash2 size={16} />
                        </Button>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              ) : (
                <div className="flex flex-col items-center justify-center py-8 text-center">
                  <Upload size={40} className="text-muted-foreground mb-2" />
                  <p className="text-muted-foreground mb-4">No files selected</p>
                </div>
              )}
            </TabsContent>
          </Tabs>

          <div className="mt-4 space-y-4">
            {isCompressing ? (
              <div className="space-y-4 py-8 flex flex-col items-center">
                <div className="animate-spin text-primary">
                  <LoaderCircle size={35} />
                </div>
                <p className="text-center text-sm mt-2">
                  Compressing your files... This may take several minutes depending on file size.
                </p>
                <p className="text-center text-xs text-muted-foreground">
                  Please don't close the application during compression.
                </p>
              </div>
            ) : isCompressionComplete ? (
              <div className="space-y-4">
                <p className="text-center text-sm text-green-500">Compression completed successfully!</p>
                <Button onClick={handleOpenOutputFolder} className="w-full">
                  <Folder className="mr-2" size={16} />
                  Open Output Location
                </Button>
                <Button onClick={() => {
                  setIsCompressionComplete(false);
                  setFiles([]);
                }} variant="outline" className="w-full">
                  Compress Another File
                </Button>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-2 gap-2">
                  <Button onClick={handleFileSelect} variant="outline" className="w-full">
                    <File className="mr-2" size={16} />
                    Select Files
                  </Button>
                  <Button onClick={handleFolderSelect} variant="outline" className="w-full">
                    <Folder className="mr-2" size={16} />
                    Select Folder
                  </Button>
                </div>

                <Button
                  onClick={handleStartCompression}
                  className="w-full"
                  disabled={files.length === 0 || !outputFolder}
                >
                  Start Compression
                </Button>
              </>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Social Links */}
      <div className="flex justify-center mt-4 space-x-4">
        <button
          onClick={() => handleOpenLink('https://github.com/Chirraaa/DasKomp')}
          className="hover:opacity-75 transition-opacity"
        >
          <Github size={24} />
        </button>
        <button
          onClick={() => handleOpenLink('https://twitter.com/ChirraaaB')}
          className="hover:opacity-75 transition-opacity"
        >
          <Twitter size={24} />
        </button>
      </div>
    </div>
  );
}

export default App;