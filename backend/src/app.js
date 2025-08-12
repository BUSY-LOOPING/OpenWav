import express from "express";
import cors from "cors";
import helmet from "helmet";
import path from "path";
import { fileURLToPath } from "url";
import http from "http";
import { Server as SocketIo } from "socket.io";
import { logger } from "./config/logger.js";
import errorHandler from "./middleware/errorHandler.js";
import rateLimiter from "./middleware/rateLimiter.js";
import routes from "./routes/index.js";

import downloadService from "./services/downloadService.js";
import chartService from "./services/chartService.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const getAllowedOrigins = () => {
  if (process.env.NODE_ENV === "production" && process.env.FRONTEND_URL) {
    return [process.env.FRONTEND_URL];
  }
  return [
    "http://localhost:3000",
    "http://localhost:3001",
    "http://localhost:8080",
    "http://localhost:6330"
  ];
};

const allowedOrigins = getAllowedOrigins();

const app = express();
const server = http.createServer(app);

const io = new SocketIo(server, {
  cors: {
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, origin);
      } else {
        callback(new Error("Not allowed by CORS"));
      }
    },
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    credentials: true
  }
});

// Attach socket.io instance to app
app.set("io", io);

io.on("connection", (socket) => {
  console.log("Client connected:", socket.id);
  socket.on("disconnect", () => {
    console.log("Client disconnected:", socket.id);
  });
});

// Initialize services with socket
downloadService.initialize(io);
chartService.setSocketIO(io);

// Trust proxy
app.set("trust proxy", 1);

// Helmet security configuration
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" },
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        imgSrc: ["'self'", "data:", "blob:", ...allowedOrigins],
        scriptSrc: ["'self'", "'unsafe-inline'", "https://cdn.socket.io"],
        objectSrc: ["'none'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        fontSrc: ["'self'", "data:", ...allowedOrigins],
        connectSrc: ["'self'", ...allowedOrigins]
      }
    },
    crossOriginEmbedderPolicy: false,
    crossOriginOpenerPolicy: false
  })
);

// Unified CORS config for all routes
const corsOptions = {
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, origin);
    } else {
      callback(new Error("Not allowed by CORS"));
    }
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "Range"]
};

// Apply cors to all routes + handle preflight
app.use(cors(corsOptions));
app.options("*", cors(corsOptions));

// Rate limiting
// app.use(rateLimiter);

// Body parsers
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// Request logger
app.use((req, res, next) => {
  logger.info(`${req.method} ${req.path} - ${req.ip}`);
  next();
});

// Health check endpoint
app.get("/health", (req, res) => {
  res.status(200).json({
    status: "OK",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || "development"
  });
});

// API routes
app.use("/api", routes);

// Static media with basic CORS headers
app.use(
  "/media",
  (req, res, next) => {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Methods", "GET");
    res.header("Access-Control-Allow-Headers", "Range");
    next();
  },
  express.static(path.join(__dirname, "../media"), {
    maxAge: "1d",
    etag: true,
    lastModified: true
  })
);

// Public folder
app.use(express.static("public"));

// 404 for API
app.use("/api/*", (req, res) => {
  res.status(404).json({
    success: false,
    message: "API endpoint not found",
    path: req.path
  });
});

// Root route
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
      admin: "/api/admin"
    }
  });
});

// Error handler
app.use(errorHandler);

export { server as server_app };
