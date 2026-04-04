import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import fs from "fs";
import chokidar from "chokidar";
import axios from "axios";
import FormData from "form-data";
import cors from "cors";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json());

let COMFYUI_URL = process.env.COMFYUI_URL || "http://localhost:8188";
let WATCH_FOLDER = path.resolve(process.env.WATCH_FOLDER || "./input_images");

// Ensure initial folders exist
if (!fs.existsSync(WATCH_FOLDER)) fs.mkdirSync(WATCH_FOLDER, { recursive: true });

let currentScale = 2.0;
let isWatching = false;
let logs: any[] = [];

function addLog(message: string, type: "info" | "error" | "success" = "info") {
  const log = { id: Date.now(), message, type, timestamp: new Date().toISOString() };
  logs.unshift(log);
  if (logs.length > 100) logs.pop();
  console.log(`[${type.toUpperCase()}] ${message}`);
}

const ALLOWED_EXTENSIONS = [".jpg", ".jpeg", ".png", ".webp", ".bmp"];

async function upscaleImage(filePath: string) {
  const ext = path.extname(filePath).toLowerCase();
  if (!ALLOWED_EXTENSIONS.includes(ext)) {
    return; // Skip non-image files
  }

  const fileName = path.basename(filePath);
  addLog(`New image detected: ${fileName}. Starting upscale...`, "info");

  try {
    // 1. Upload image to ComfyUI
    const formData = new FormData();
    formData.append("image", fs.createReadStream(filePath));
    
    addLog(`Uploading ${fileName} to ${COMFYUI_URL}...`, "info");
    const uploadRes = await axios.post(`${COMFYUI_URL}/upload/image`, formData, {
      headers: formData.getHeaders(),
      timeout: 10000, // 10s timeout for upload
    });

    const comfyFileName = uploadRes.data.name;
    addLog(`Upload successful: ${comfyFileName}`, "success");

    // 2. Prepare Workflow (API Format)
    const workflow = {
      "10": {
        "inputs": { "model_name": "4x-UltraSharp.pth" },
        "class_type": "UpscaleModelLoader"
      },
      "11": {
        "inputs": {
          "upscale_model": ["10", 0],
          "image": ["14", 0]
        },
        "class_type": "ImageUpscaleWithModel"
      },
      "14": {
        "inputs": { "image": comfyFileName, "upload": "image" },
        "class_type": "LoadImage"
      },
      "15": {
        "inputs": {
          "upscale_method": "nearest-exact",
          "scale_by": currentScale / 4.0,
          "image": ["11", 0]
        },
        "class_type": "ImageScaleBy"
      },
      "13": {
        "inputs": {
          "filename_prefix": "upscaled_",
          "images": ["15", 0]
        },
        "class_type": "SaveImage"
      }
    };

    // 3. Queue Prompt
    addLog(`Queueing upscale job (Scale: ${currentScale}x)...`, "info");
    const promptRes = await axios.post(`${COMFYUI_URL}/prompt`, { prompt: workflow }, {
      timeout: 5000,
    });
    const promptId = promptRes.data.prompt_id;

    addLog(`Job queued successfully. Prompt ID: ${promptId}`, "success");

  } catch (error: any) {
    let errorMsg = error.message;
    if (error.code === 'ECONNREFUSED') {
      errorMsg = `Could not connect to ComfyUI at ${COMFYUI_URL}. Is it running?`;
    } else if (error.response) {
      errorMsg = `ComfyUI Error: ${error.response.status} - ${JSON.stringify(error.response.data)}`;
    }
    addLog(`Error processing ${fileName}: ${errorMsg}`, "error");
  }
}

let watcher: any = null;

function startWatcher() {
  if (watcher) watcher.close();
  
  if (!fs.existsSync(WATCH_FOLDER)) {
    try {
      fs.mkdirSync(WATCH_FOLDER, { recursive: true });
    } catch (e: any) {
      addLog(`Failed to create watch folder: ${e.message}`, "error");
      return;
    }
  }

  watcher = chokidar.watch(WATCH_FOLDER, {
    ignored: /(^|[\/\\])\../,
    persistent: true,
    ignoreInitial: true,
    awaitWriteFinish: {
      stabilityThreshold: 1000,
      pollInterval: 100
    }
  });

  watcher.on("add", (filePath: string) => {
    upscaleImage(filePath);
  });

  isWatching = true;
  addLog(`Watcher ACTIVE on: ${WATCH_FOLDER}`, "info");
}

function stopWatcher() {
  if (watcher) {
    watcher.close();
    watcher = null;
  }
  isWatching = false;
  addLog(`Watcher STOPPED.`, "info");
}

// API Routes
app.get("/api/status", (req, res) => {
  res.json({
    isWatching,
    currentScale,
    comfyUrl: COMFYUI_URL,
    watchFolder: WATCH_FOLDER,
    logs
  });
});

app.get("/api/discover", async (req, res) => {
  // Simple discovery: check common local IPs
  const potentialIps = ['127.0.0.1', '192.168.1.1', '192.168.1.100'];
  for (const ip of potentialIps) {
    try {
      await axios.get(`http://${ip}:8188/system_stats`, { timeout: 500 });
      return res.json({ success: true, url: `http://${ip}:8188` });
    } catch (e) {
      continue;
    }
  }
  res.status(404).json({ success: false, error: "No ComfyUI instance found" });
});

app.get("/api/test-connection", async (req, res) => {
  try {
    const response = await axios.get(`${COMFYUI_URL}/system_stats`, { timeout: 3000 });
    res.json({ success: true, stats: response.data });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post("/api/settings", (req, res) => {
  const { scale, watching, comfyUrl, watchFolder } = req.body;
  
  if (scale !== undefined) currentScale = scale;
  if (comfyUrl !== undefined) COMFYUI_URL = comfyUrl;

  if (watchFolder !== undefined) {
    const newPath = path.resolve(watchFolder);
    if (newPath !== WATCH_FOLDER) {
      WATCH_FOLDER = newPath;
      if (isWatching) startWatcher();
    }
  }
  
  if (watching === true && !isWatching) {
    startWatcher();
  } else if (watching === false && isWatching) {
    stopWatcher();
  }
  
  res.json({ 
    success: true, 
    currentScale, 
    isWatching, 
    comfyUrl: COMFYUI_URL,
    watchFolder: WATCH_FOLDER 
  });
});

async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
    startWatcher();
  });
}

startServer();
