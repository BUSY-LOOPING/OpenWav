import express from "express";
import cors from "cors";
import helmet from "helmet";
import path from "path";
import {logger} from "./config/logger.js";
import errorHandler from "./middleware/errorHandler.js";
import rateLimiter from "./middleware/rateLimiter.js";
import { Server as socketIo } from "socket.io";
import http from 'http';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);


import routes from "./routes/index.js";

const app = express();

const server = http.createServer(app);
const io = new socketIo(server, {
  cors: {
    origin: "*", 
    methods: ["GET", "POST"],
  },
});


app.set('io', io);
io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);
  
  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
  });
}); 

import downloadService from "./services/downloadService.js";
import chartService from './services/chartService.js';

downloadService.initialize(io);
chartService.setSocketIO(io);

app.set("trust proxy", 1);

app.use(helmet());

app.use(
  cors({
    origin:
      process.env.NODE_ENV === "production"
        ? process.env.FRONTEND_URL
        : [
            "http://localhost:3000",
            "http://localhost:3001",
            "http://localhost:8080",
          ],
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "Range"],
  })
);

app.use((req, res, next) => {
  res.setHeader(
    'Content-Security-Policy',
    "script-src 'self' 'unsafe-inline' https://cdn.socket.io; object-src 'none';"
  );
  next();
});

app.use(rateLimiter);

app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

app.use((req, res, next) => {
  logger.info(`${req.method} ${req.path} - ${req.ip}`);
  next();
});

app.get("/health", (req, res) => {
  res.status(200).json({
    status: "OK",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || "development",
  });
});

app.use("/api", routes);

app.use(
  "/media",
  express.static(path.join(__dirname, "../media"), {
    maxAge: "1d",
    etag: true,
    lastModified: true,
  })
);

app.use(express.static('public'));

app.use("/api/*", (req, res) => {
  res.status(404).json({
    success: false,
    message: "API endpoint not found",
    path: req.path,
  });
});

app.get("/", (req, res) => {
  res.json({
    message: "Media Streaming API",
    version: "1.0.0",
    status: "running",
    endpoints: {
      health: "/health",
      api: "/api",
      auth: "/api/auth",
      media: "/api/media",
      downloads: "/api/downloads",
      admin: "/api/admin",
    },
  });
});

app.use(errorHandler);

export {server as server_app};