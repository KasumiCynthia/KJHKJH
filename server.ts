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
const PORT = 3000; // Port 3000 is required by the infrastructure for external access.

app.use(cors());
app.use(express.json());

let COMFYUI_URL = process.env.COMFYUI_URL || "http://localhost:8188";
let WATCH_FOLDER = path.resolve(process.env.WATCH_FOLDER || "./input_images");
let SEND_FOLDERS: { path: string, filter: string }[] = Array.from({ length: 10 }, () => ({ path: "", filter: "" }));
let OUTPUT_FOLDERS: { id: string, path: string, sources: boolean[] }[] = [];

// Ensure initial folders exist
if (!fs.existsSync(WATCH_FOLDER)) fs.mkdirSync(WATCH_FOLDER, { recursive: true });

let currentScale = 2.0;
let isWatching = false;
let isTeamModeEnabled = false;
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

let LM_URL = process.env.LM_URL || "http://127.0.0.1:1234";
let LM_MODEL = process.env.LM_MODEL || "";

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
app.get("/api/status", async (req, res) => {
  let isConnected = false;
  try {
    const response = await axios.get(`${COMFYUI_URL}/system_stats`, { timeout: 1000 });
    isConnected = response.status === 200;
  } catch (e) {
    isConnected = false;
  }

  res.json({
    isWatching,
    currentScale,
    comfyUrl: COMFYUI_URL,
    watchFolder: WATCH_FOLDER,
    sendFolders: SEND_FOLDERS,
    outputFolders: OUTPUT_FOLDERS,
    isTeamModeEnabled,
    lmUrl: LM_URL,
    lmModel: LM_MODEL,
    logs,
    isConnected
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

app.get("/api/run-ai-prepare", async (req, res) => {
  const jobs: any[] = [];
  
  for (let i = 0; i < SEND_FOLDERS.length; i++) {
    const folder = SEND_FOLDERS[i];
    if (!folder.path || !fs.existsSync(folder.path)) continue;

    try {
      const files = fs.readdirSync(folder.path);
      for (const file of files) {
        if (folder.filter && file !== folder.filter) continue;
        
        const filePath = path.join(folder.path, file);
        const stat = fs.statSync(filePath);
        if (!stat.isFile()) continue;

        const ext = path.extname(file).toLowerCase();
        if (!['.txt', '.md', '.json', '.csv', '.log'].includes(ext)) {
          continue;
        }

        const content = fs.readFileSync(filePath, 'utf-8');
        
        const targets = OUTPUT_FOLDERS.filter(out => out.sources[i] && out.path).map(out => out.path);
        if (targets.length > 0) {
          jobs.push({
            sourceIndex: i,
            fileName: file,
            content: content,
            mtime: stat.mtime.toISOString(),
            mtimeMs: stat.mtimeMs,
            targets: targets
          });
        }
      }
    } catch (err: any) {
      addLog(`Error reading folder ${i + 1}: ${err.message}`, "error");
    }
  }
  
  res.json({ success: true, jobs });
});

app.post("/api/save-ai-output", (req, res) => {
  const { fileName, content, targets } = req.body;
  
  if (!targets || targets.length === 0) {
    return res.status(400).json({ success: false, error: "No targets provided" });
  }

  try {
    for (const target of targets) {
      const targetDir = path.resolve(target);
      if (!fs.existsSync(targetDir)) fs.mkdirSync(targetDir, { recursive: true });
      
      const outPath = path.join(targetDir, `AI_${fileName}`);
      fs.writeFileSync(outPath, content, 'utf-8');
      addLog(`Saved AI output to ${target}/AI_${fileName}`, "success");
    }
    res.json({ success: true });
  } catch (err: any) {
    addLog(`Error saving AI output: ${err.message}`, "error");
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post("/api/log", (req, res) => {
  const { message, type } = req.body;
  addLog(message, type || "info");
  res.json({ success: true });
});

app.post("/api/settings", (req, res) => {
  const { scale, watching, comfyUrl, watchFolder, sendFolders, outputFolders, isTeamModeEnabled: teamMode, lmUrl, lmModel } = req.body;
  
  if (scale !== undefined) currentScale = scale;
  if (comfyUrl !== undefined) COMFYUI_URL = comfyUrl;
  if (teamMode !== undefined) isTeamModeEnabled = teamMode;
  if (lmUrl !== undefined) LM_URL = lmUrl;
  if (lmModel !== undefined) LM_MODEL = lmModel;

  if (watchFolder !== undefined) {
    const newPath = path.resolve(watchFolder);
    if (newPath !== WATCH_FOLDER) {
      WATCH_FOLDER = newPath;
      if (isWatching) startWatcher();
    }
  }

  if (sendFolders !== undefined) {
    SEND_FOLDERS = sendFolders;
    SEND_FOLDERS.forEach(f => {
      if (f && f.path) {
        const p = path.resolve(f.path);
        if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true });
      }
    });
  }

  if (outputFolders !== undefined) {
    OUTPUT_FOLDERS = outputFolders;
    OUTPUT_FOLDERS.forEach(out => {
      if (out.path) {
        const p = path.resolve(out.path);
        if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true });
      }
    });
    // Output folders change might affect routing logic, but watchers stay the same
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
    watchFolder: WATCH_FOLDER,
    sendFolders: SEND_FOLDERS,
    outputFolders: OUTPUT_FOLDERS,
    isTeamModeEnabled
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
