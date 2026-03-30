import express, { Request, Response } from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import multer from "multer";
import ffmpeg from "fluent-ffmpeg";
import { createWorker } from "tesseract.js";
import { createCanvas, loadImage } from "canvas";
import fs from "fs";

interface MulterRequest extends Request {
  file?: Express.Multer.File;
}

const app = express();
const PORT = 3000;

// Ensure directories exist
const UPLOADS_DIR = path.join(process.cwd(), "uploads");
const TEMP_DIR = path.join(process.cwd(), "temp");
if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR);
if (!fs.existsSync(TEMP_DIR)) fs.mkdirSync(TEMP_DIR);

const storage = multer.diskStorage({
  destination: UPLOADS_DIR,
  filename: (req, file, cb) => {
    cb(null, `${Date.now()}-${file.originalname}`);
  },
});
const upload = multer({ storage });

// Simple DHash implementation for frame deduplication
async function getDHash(imagePath: string): Promise<string> {
  const img = await loadImage(imagePath);
  const canvas = createCanvas(9, 8);
  const ctx = canvas.getContext("2d");
  ctx.drawImage(img, 0, 0, 9, 8);
  const data = ctx.getImageData(0, 0, 9, 8).data;
  
  let hash = "";
  for (let y = 0; y < 8; y++) {
    for (let x = 0; x < 8; x++) {
      const left = (y * 9 + x) * 4;
      const right = (y * 9 + x + 1) * 4;
      const leftGray = (data[left] + data[left + 1] + data[left + 2]) / 3;
      const rightGray = (data[right] + data[right + 1] + data[right + 2]) / 3;
      hash += leftGray > rightGray ? "1" : "0";
    }
  }
  return hash;
}

function hammingDistance(h1: string, h2: string): number {
  let dist = 0;
  for (let i = 0; i < h1.length; i++) {
    if (h1[i] !== h2[i]) dist++;
  }
  return dist;
}

app.use(express.json());

// API: Process Video
app.post("/api/process", upload.single("video"), async (req: MulterRequest, res: Response) => {
  const file = req.file;
  if (!file) return res.status(400).json({ error: "No video uploaded" });

  const { roi, interval = 1 } = req.body; // roi: { x, y, w, h }, interval in seconds
  const parsedRoi = typeof roi === 'string' ? JSON.parse(roi) : roi;

  const videoPath = file.path;
  const outputPrefix = path.join(TEMP_DIR, `frame-${Date.now()}`);
  
  try {
    const worker = await createWorker('eng');
    const results: { timestamp: number; text: string; confidence: number }[] = [];
    let lastHash = "";

    // Extract frames using FFmpeg with ROI cropping and preprocessing
    // Preprocessing: grayscale and thresholding (using ffmpeg filters)
    const cropFilter = parsedRoi 
      ? `crop=${parsedRoi.w}:${parsedRoi.h}:${parsedRoi.x}:${parsedRoi.y},` 
      : "";
    const preprocessFilter = `${cropFilter}format=gray,threshold=128`;

    ffmpeg(videoPath)
      .outputOptions([
        "-vf", `fps=1/${interval},${preprocessFilter}`,
        "-vsync", "0"
      ])
      .output(`${outputPrefix}-%04d.png`)
      .on("end", async () => {
        const frames = fs.readdirSync(TEMP_DIR).filter(f => f.startsWith(path.basename(outputPrefix)));
        
        for (let i = 0; i < frames.length; i++) {
          const framePath = path.join(TEMP_DIR, frames[i]);
          const currentHash = await getDHash(framePath);
          
          // Only OCR if frame is significantly different (5% threshold as requested)
          // 64 bits hash, 5% is ~3 bits
          if (!lastHash || hammingDistance(lastHash, currentHash) > 3) {
            const { data: { text, confidence } } = await worker.recognize(framePath);
            if (text.trim()) {
              results.push({
                timestamp: i * interval * 1000,
                text: text.trim(),
                confidence
              });
            }
            lastHash = currentHash;
          }
          
          fs.unlinkSync(framePath); // Cleanup frame
        }

        await worker.terminate();
        fs.unlinkSync(videoPath); // Cleanup video

        res.json({ results });
      })
      .on("error", (err) => {
        console.error(err);
        res.status(500).json({ error: "FFmpeg processing failed" });
      })
      .run();

  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Processing failed" });
  }
});

async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { 
        middlewareMode: true,
        hmr: false,
      },
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
    console.log(`Hardsub-Killer Server running on http://localhost:${PORT}`);
  });
}

startServer();
