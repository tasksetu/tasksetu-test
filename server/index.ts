import "./env.ts"; // Load environment variables first
import express from "express";
import multer from "multer";
import mongoose from "mongoose";
import cors from "cors";
import path from "path";
import fs from "fs";
import * as r2Storage from "./services/r2Storage.js";
import swaggerJSDoc from "swagger-jsdoc";
import * as swaggerUi from "swagger-ui-express";
import { setupVite, serveStatic, log } from "./vite.js";
import { registerRoutes } from "./routes.js";
import { registerUserInvitationRoutes } from "./routes/userInvitation.js";

import quickTaskRoutes from "./routes/quickTaskRoutes.js";
import milestoneTaskRoutes from "./routes/milestoneTaskRoutes.js";
import reportsRoutes from "./routes/reportsRoutes.js";
import licenseRoutes from "./routes/licenseRoutes.js";
import licensePoolRoutes from "./routes/licensePoolRoutes.js"; // 🆕 NEW
import licenseManagementRoutes from "./routes/licenseManagementRoutes.js"; // License Management
import { seatManagementRoutes } from "./routes/seatManagementRoutes.js";
import emailToTaskRoutes from "./routes/emailToTaskRoutes.js";
import supportRoutes from "./routes/supportRoutes.js";
import superAdminDashboardRoutes from "./routes/superAdminDashboardRoutes.js";
import superAdminRoutes from "./routes/superAdminRoutes.js";
import cronDebugRoutes from "./routes/cronDebugRoutes.js"; // ✅ NEW: Cron debug & test routes
// Import from centralized models.js to avoid duplicate model compilation
import { FormCategory, FormTag } from "./models.js";
import { FormVersion } from "./modals/formVersionModal.js";
import cron from "node-cron";
import { autoArchiveQuickTasks } from "./controller/quickTaskController.js";
import { emailToTaskService } from './services/emailToTaskService.js';


const app = express();


// Swagger configuration
const swaggerOptions = {
  swaggerDefinition: {
    openapi: "3.0.0",
    info: {
      title: "TaskSetu API Documentation",
      version: "1.0.0",
      description: "API documentation for TaskSetu task management system",
      contact: {
        name: "API Support",
        email: "support@tasksetu.com",
      },
    },
    servers: [
      {
        url: process.env.API_URL || "http://localhost:5003",
        description: "API Server",
      },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: "http",
          scheme: "bearer",
          bearerFormat: "JWT",
        },
      },
    },
    security: [
      {
        bearerAuth: [],
      },
    ],
  },
  apis: [
    "./server/routes/*.js",
    "./server/models/*.js",
    "./server/modals/*.js",
  ],
  failOnErrors: true, // Whether or not to throw when parsing errors
  encoding: "utf8", // Encoding for reading files
  verbose: true, // Include errors in the console
};

const swaggerSpec = swaggerJSDoc(swaggerOptions as any);

// Serve Swagger documentation with custom options
app.use(
  "/api-docs",
  swaggerUi.serve,
  swaggerUi.setup(swaggerSpec, {
    explorer: true,
    customCss: ".swagger-ui .topbar { display: none }",
    customSiteTitle: "TaskSetu API Documentation",
    customfavIcon: "/favicon.ico",
    swaggerOptions: {
      persistAuthorization: true,
      filter: true,
      displayRequestDuration: true,
      docExpansion: "none",
    },
  })
);

// Serve Swagger spec as JSON for third-party tools
app.get("/api-docs.json", (req : any, res : any) => {
  res.setHeader("Content-Type", "application/json");
  res.send(swaggerSpec);
});

// Add error handling for uncaught exceptions
process.on("uncaughtException", (error) => {
  console.error("Uncaught Exception:", error);
});

// Add error handling middleware
app.use((err : any, req : any, res : any, next : any) => {
  console.error("Error:", err);

  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(413).json({
        success: false,
        message: "File too large. Maximum size allowed is 2MB per attachment."
      });
    }
    return res.status(400).json({
      success: false,
      message: err.message
    });
  }

  res.status(err.status || 500).json({
    success: false,
    message: err.message || "Internal Server Error"
  });
});

// ✅ CORS Configuration - Allow frontend to make requests
const corsOptions = {
  origin: [
    'http://localhost:3000',     // Dev frontend (Vite)
    'http://localhost:5173',     // Alt Vite port
    'http://127.0.0.1:3000',
    'http://127.0.0.1:5173',
    'https://tasksetu.shrawantravels.com',  // Production
    'https://www.tasksetu.shrawantravels.com'
  ],
  credentials: true,              // Allow cookies/auth headers
  optionsSuccessStatus: 200,      // For legacy browsers
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  maxAge: 86400  // 24 hours
};

app.use(cors(corsOptions));
console.log("✅ CORS configured for development and production environments");

// Increase payload limit for file uploads (base64 encoded files can be large)
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: false, limit: '50mb' }));

// Serve uploaded files statically (except task-attachments and form-submissions which require auth)
// Block direct access to task-attachments - must use authenticated API routes
app.use("/uploads/task-attachments", (_req, res) => {
  res.status(403).json({ success: false, message: "Access denied. Use authenticated API to access task attachments." });
});
// Block direct access to form-submissions - must use authenticated API routes
app.use("/uploads/form-submissions", (_req, res) => {
  res.status(403).json({ success: false, message: "Access denied. Use authenticated API to access form submission files." });
});

// Serve uploaded files exclusively from Cloudflare R2 (no local storage fallback)
app.use("/uploads", async (req, res, next) => {
  const relativePath = req.path.replace(/^\//, "");
  
  // Try serving from Cloudflare R2 if enabled
  if (r2Storage.isR2Enabled()) {
    try {
      const publicUrl = r2Storage.getPublicUrl(relativePath);
      if (publicUrl) {
        return res.redirect(publicUrl);
      }
      
      // If no public URL is defined, generate a pre-signed URL and redirect
      const ext = path.extname(relativePath).toLowerCase();
      let contentType = "application/octet-stream";
      const mimeTypes: Record<string, string> = {
        ".jpg": "image/jpeg",
        ".jpeg": "image/jpeg",
        ".png": "image/png",
        ".gif": "image/gif",
        ".webp": "image/webp",
        ".svg": "image/svg+xml",
        ".pdf": "application/pdf",
        ".txt": "text/plain",
      };
      if (mimeTypes[ext]) {
        contentType = mimeTypes[ext];
      }

      try {
        const signedUrl = await r2Storage.getSignedUrlForGetObject(relativePath, {
          responseContentType: contentType,
          responseContentDisposition: "inline",
          expiresIn: 3600 // 1 hour
        });
        if (signedUrl) {
          return res.redirect(signedUrl);
        }
      } catch (signErr) {
        console.error(`[Index] Failed to generate signed URL for static file:`, signErr);
      }

      // Fallback: fetch and stream it
      const stream = await r2Storage.downloadFromR2(relativePath);
      res.setHeader("Content-Type", contentType);
      stream.pipe(res);
      return;
    } catch (err:any) {
      console.warn(`[Index] Could not fetch file from R2 fallback (${relativePath}):`, err.message);
    }
  }
  
  next();
});

// Register Super Admin Dashboard routes
app.use("/api/super-admin", superAdminDashboardRoutes);
console.log("Super Admin Dashboard routes registered");

// MongoDB connection
const connectToMongoDB = async () => {
  try {
    const mongoUri = process.env.DATABASE_URL || process.env.MONGODB_URI;
    
    if (!mongoUri) {
      throw new Error("DATABASE_URL or MONGODB_URI environment variable is not set");
    }

    console.log("Attempting to connect to MongoDB...");
    console.log("Database host:", mongoUri.split('@')[1]?.split('/')[0] || 'default');
    
    // Add MongoDB connection options with proper timeout and retry settings
    await mongoose.connect(mongoUri, {
      serverSelectionTimeoutMS: 30000, // 30 seconds timeout
      socketTimeoutMS: 45000, // 45 seconds socket timeout
      maxPoolSize: 10,
    });

    console.log("Successfully connected to Database");
    
    // Debug: Print all indexes
    // for (const [name, model] of Object.entries(mongoose.models)) {
    //   const indexes = model.schema.indexes();
    //   for (const idx of indexes) {
    //     const key = Object.keys(idx[0])[0];
    //     if (key === 'status') {
    //       console.log(`⚠️ Duplicate index: ${name} has status index:`, idx[0]);
    //     }
    //   }
    // }

    // Auto-fix FormVersion external_token index issue
    try {
      const { ensureSparseExternalTokenIndex } = await import(
        "./utils/fixFormVersionIndex.js"
      );
      await ensureSparseExternalTokenIndex();
    } catch (indexFixError : any ) {
      console.warn(
        "⚠️  Could not auto-fix FormVersion index:",
        indexFixError.message
      );
    }

    // Register routes with error handling
    try {
      await registerRoutes(app);
      // console.log("Main routes registered");

      registerUserInvitationRoutes(app);
      // console.log("User invitation routes registered");

      // Register Quick Task routes
      app.use("/api/quick-tasks", quickTaskRoutes);
      // console.log("Quick Task routes registered");

      // Register Milestone Task routes
      app.use("/api/milestone-tasks", milestoneTaskRoutes);
      // console.log("Milestone Task routes registered");

      // Register Reports routes
      app.use("/api/reports", reportsRoutes);
      // console.log("Reports routes registered");
      // Register License routes
      app.use("/api", licenseRoutes);
      // console.log("License routes registered");

      // 🆕 Register New License Pool routes
      app.use("/api", licensePoolRoutes);
      // console.log("License Pool routes registered");

      // Register License Management routes (Super Admin)
      app.use("/api/super-admin", licenseManagementRoutes);
      // console.log("License Management routes registered");

      // Register Seat Management routes
      app.use("/api/organization", seatManagementRoutes);
      // console.log("Seat Management routes registered");

      // Register Email to Task routes
      app.use("/api/email-to-task", emailToTaskRoutes);
      // console.log("Email to Task routes registered");

      // Register Support routes
      app.use("/api/support", supportRoutes);

      // ✅ NEW: Cron debug & manual trigger routes (admin only)
      app.use("/api/cron", cronDebugRoutes);
      // console.log("Support routes registered");
    } catch (routeError) {
      console.error("Error registering routes:", routeError);
      throw routeError;
    }
  } catch (error) {
    console.error("MongoDB connection error:", error);
    process.exit(1);
  }
};

(async () => {
  await connectToMongoDB();

  const server = await registerRoutes(app);

  // Initialize cron job service for notifications
  try {
    const { CronJobService } = await import("./services/cronJobService.js");
    await CronJobService.initialize();
    console.log("Notification cron jobs initialized");
  } catch (cronError) {
    console.error("Failed to initialize cron jobs:", cronError);
    // Don't exit the process, just log the error
  }

  // Initialize licensing cron jobs
  try {
    const { initializeCronJobs } = await import("./cron/licenseCronJobs.js");
    initializeCronJobs();
  } catch (licenseCronError) {
    console.error(
      "Failed to initialize licensing cron jobs:",
      licenseCronError
    );
    // Don't exit the process, just log the error
  }

  // Schedule automatic archiving of quick tasks
  cron.schedule("0 0 * * *", autoArchiveQuickTasks); // Runs every day at midnight

  // Initialize Email to Task service (check every 5 minutes)
  try {
    await emailToTaskService.start();
    console.log("Email to Task service initialized (checking every 5 minutes)");
  } catch (emailToTaskError) {
    console.error("Failed to initialize Email to Task service:", emailToTaskError);
    // Don't exit the process, just log the error
  }

  // Important: This setup is for production. In development, Vite will handle HMR.
  // Default to production if running from dist folder or NODE_ENV is not explicitly 'development'
  const isRunningFromDist = import.meta.dirname?.includes('dist') || false;
  const isProduction = process.env.NODE_ENV === "production" || isRunningFromDist;
  console.log(`🔧 Environment: NODE_ENV=${process.env.NODE_ENV}, isRunningFromDist=${isRunningFromDist}, isProduction=${isProduction}`);
  
  if (isProduction) {
    try {
      serveStatic(app);
    } catch (staticError : any) {
      console.error(
        "Static assets not found. Starting API-only mode without frontend static serving:",
        staticError?.message || staticError
      );
    }
  } else {
    await setupVite(app, server);
  }

  const PORT = Number(process.env.PORT) || 5000;
  server
    .listen(PORT, () => {
      log(`TaskSetu Server running on port ${PORT}`);
    })
    .on("error", (err) => {
      console.error(`Failed to start server on port ${PORT}:`, err);
      process.exit(1);
    });
})();

// Trigger reload to load updated env values
