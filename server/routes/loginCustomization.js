import { storage } from "../mongodb-storage.js";
import { authenticateToken } from "../middleware/roleAuth.js";
import { requireSuperAdmin } from "../middleware/superAdminAuth.js";
import { LoginSettings } from "../modals/loginSettingsModal.js";
import multer from "multer";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configure multer for image uploads

// Use memory storage to read file directly into database
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: (req, file, cb) => {
    // Check if file MIME type is an image
    const mimetypeRegex = /^image\/(jpeg|png|gif|webp)$/;
    if (mimetypeRegex.test(file.mimetype)) {
      return cb(null, true);
    } else {
      cb(new Error("Only image files are allowed! Please upload JPEG, PNG, GIF, or WebP images."));
    }
  },
});

export const registerLoginCustomizationRoutes = (app) => {
  // Get current login customization settings
  app.get("/api/super-admin/login-settings", authenticateToken, requireSuperAdmin, async (req, res) => {
    try {
      let settings = await LoginSettings.findOne().sort({ createdAt: -1 });

      if (!settings) {
        // Create default settings if none exist
        settings = await LoginSettings.create({
          backgroundColor: "#f3f4f6",
          gradientFrom: "#e5e7eb",
          gradientTo: "#d1d5db",
          useGradient: true,
          backgroundImage: "",
          overlayOpacity: 0.5,
        });
      }

      // Remove binary imageData from response to avoid payload size issues
      const settingsObj = settings.toObject ? settings.toObject() : settings;
      delete settingsObj.imageData;

      res.json(settingsObj);
    } catch (error) {
      console.error("Get login settings error:", error);
      res.status(500).json({ message: "Failed to fetch login settings" });
    }
  });

  // Update login customization settings
  app.post("/api/super-admin/login-settings", authenticateToken, requireSuperAdmin, async (req, res) => {
    try {
      const { backgroundColor, gradientFrom, gradientTo, useGradient, backgroundImage, overlayOpacity } = req.body;

      let settings = await LoginSettings.findOne().sort({ createdAt: -1 });

      if (settings) {
        // If switching to gradient mode, delete old background image
        if (useGradient === true && settings.backgroundImage && settings.backgroundImage.startsWith('/uploads/')) {
          const oldImagePath = path.join(__dirname, "../..", settings.backgroundImage);
          if (fs.existsSync(oldImagePath)) {
            fs.unlinkSync(oldImagePath);
          }
        }

        // Update existing settings
        if (backgroundColor !== undefined) settings.backgroundColor = backgroundColor;
        if (gradientFrom !== undefined) settings.gradientFrom = gradientFrom;
        if (gradientTo !== undefined) settings.gradientTo = gradientTo;
        if (useGradient !== undefined) settings.useGradient = useGradient;
        if (backgroundImage !== undefined) settings.backgroundImage = backgroundImage;
        if (overlayOpacity !== undefined) settings.overlayOpacity = overlayOpacity;
        if (req.user?.id) {
          settings.updatedBy = req.user.id;
        }

        await settings.save();
      } else {
        // Create new settings
        settings = await LoginSettings.create({
          backgroundColor: backgroundColor || "#f3f4f6",
          gradientFrom: gradientFrom || "#e5e7eb",
          gradientTo: gradientTo || "#d1d5db",
          useGradient: useGradient !== undefined ? useGradient : true,
          backgroundImage: backgroundImage || "",
          overlayOpacity: overlayOpacity !== undefined ? overlayOpacity : 0.5,
          updatedBy: req.user?.id,
        });
      }

      // Remove binary imageData from response to avoid payload size issues
      const settingsObj = settings.toObject ? settings.toObject() : settings;
      delete settingsObj.imageData;

      res.json({
        message: "Login settings updated successfully",
        settings: settingsObj
      });
    } catch (error) {
      console.error("Update login settings error:", error);
      res.status(500).json({ message: "Failed to update login settings" });
    }
  });

  // Upload background image
  app.post(
    "/api/super-admin/upload-background",
    authenticateToken,
    requireSuperAdmin,
    (req, res, next) => {
      // Multer error handler middleware
      upload.single("backgroundImage")(req, res, (err) => {
        if (err) {
          console.error("❌ Multer error:", err.message);
          return res.status(400).json({
            message: "File upload error",
            details: err.message
          });
        }
        next();
      });
    },
    async (req, res) => {
      try {
        if (!req.file) {
          return res.status(400).json({ message: "No file uploaded" });
        }

        console.log("📤 Upload Details:");
        console.log("   File name:", req.file.originalname);
        console.log("   File size:", req.file.size, "bytes");
        console.log("   Content type:", req.file.mimetype);

        // Store image directly in database
        console.log("🔍 Debug Info:");
        console.log("   req.user:", req.user);
        console.log("   req.user.id:", req.user?.id);

        let settings = await LoginSettings.findOne().sort({ createdAt: -1 });
        console.log("   Found existing settings:", !!settings);

        if (settings) {
          // Clear old image data from database
          if (settings.imageData) {
            console.log("🗑️  Removing old image data from database");
          }

          settings.imageData = req.file.buffer;
          settings.imageContentType = req.file.mimetype;
          settings.imageFileName = req.file.originalname;
          settings.backgroundImage = "db"; // marker that image is in database
          if (req.user?.id) {
            settings.updatedBy = req.user.id;
          }
          await settings.save();
          console.log("✅ Image stored in database");
          console.log("💾 Database updated with image data");
        } else {
          settings = await LoginSettings.create({
            imageData: req.file.buffer,
            imageContentType: req.file.mimetype,
            imageFileName: req.file.originalname,
            backgroundImage: "db", // marker that image is in database
            updatedBy: req.user?.id,
          });
          console.log("💾 New settings created in database with image");
        }

        // Remove binary imageData from response to avoid payload size issues
        const settingsObj = settings.toObject ? settings.toObject() : settings;
        delete settingsObj.imageData;

        res.json({
          message: "Background image uploaded successfully and stored in database",
          imageUrl: "/api/public/login-image",
          hasImage: true,
          fileName: req.file.originalname,
          settings: settingsObj
        });
      } catch (error) {
        console.error("❌ Upload background error:", error);
        console.error("Error stack:", error.stack);
        console.error("Error name:", error.name);
        console.error("Error message:", error.message);
        res.status(500).json({
          message: "Failed to upload background image",
          details: error.message || error.toString(),
          errorName: error.name
        });
      }
    }
  );

  // Delete background image
  app.delete("/api/super-admin/delete-background", authenticateToken, requireSuperAdmin, async (req, res) => {
    try {
      let settings = await LoginSettings.findOne().sort({ createdAt: -1 });

      if (settings && settings.imageData) {
        console.log("🗑️  Deleting image from database");
        settings.imageData = null;
        settings.imageContentType = null;
        settings.imageFileName = "";
        settings.backgroundImage = "";
        settings.updatedBy = req.user.id;
        await settings.save();

        // Remove binary imageData from response to avoid payload size issues
        const settingsObj = settings.toObject ? settings.toObject() : settings;
        delete settingsObj.imageData;

        res.json({
          message: "Background image deleted successfully",
          settings: settingsObj
        });
      } else {
        res.status(404).json({ message: "No background image to delete" });
      }
    } catch (error) {
      console.error("Delete background error:", error);
      res.status(500).json({ message: "Failed to delete background image" });
    }
  });

  // Public endpoint to get login settings (no auth required)
  app.get("/api/public/login-settings", async (req, res) => {
    try {
      let settings = await LoginSettings.findOne().sort({ createdAt: -1 });

      if (!settings) {
        // Return default settings if none exist
        settings = {
          backgroundColor: "#f3f4f6",
          gradientFrom: "#e5e7eb",
          gradientTo: "#d1d5db",
          useGradient: true,
          backgroundImage: "",
          overlayOpacity: 0.5,
        };
      } else {
        const settingsObj = settings.toObject();

        // Update backgroundImage to point to the image endpoint if image exists in database
        if (settingsObj.imageData && settingsObj.backgroundImage === "db") {
          settingsObj.backgroundImage = "/api/public/login-image";
        }

        // Don't send binary imageData through JSON
        delete settingsObj.imageData;

        settings = settingsObj;
      }

      res.json(settings);
    } catch (error) {
      console.error("Get public login settings error:", error);
      // Return default settings on error
      res.json({
        backgroundColor: "#f3f4f6",
        gradientFrom: "#e5e7eb",
        gradientTo: "#d1d5db",
        useGradient: true,
        backgroundImage: "",
        overlayOpacity: 0.5,
      });
    }
  });

  // Public endpoint to get login background image (no auth required)
  app.get("/api/public/login-image", async (req, res) => {
    try {
      const settings = await LoginSettings.findOne().sort({ createdAt: -1 });

      if (!settings || !settings.imageData) {
        console.log("❌ No image found in database");
        return res.status(404).json({ message: "No background image configured" });
      }

      console.log("✅ Serving image from database");
      console.log("   Content-Type:", settings.imageContentType);
      console.log("   File name:", settings.imageFileName);
      console.log("   Data size:", settings.imageData.length, "bytes");

      // Set proper response headers
      res.set("Content-Type", settings.imageContentType || "image/jpeg");
      res.set("Cache-Control", "public, max-age=31536000"); // Cache for 1 year
      res.set("Content-Disposition", `inline; filename="${settings.imageFileName || 'login-bg.jpg'}"`);

      // Send the image buffer
      res.send(settings.imageData);
    } catch (error) {
      console.error("Get login image error:", error);
      res.status(500).json({ message: "Failed to retrieve login image" });
    }
  });

  // Debug endpoint to check database image storage status (no auth)
  app.get("/api/debug/login-uploads", async (req, res) => {
    try {
      const settings = await LoginSettings.findOne().sort({ createdAt: -1 });

      const stats = {
        databaseStorage: true,
        hasImage: !!settings?.imageData,
        imageDetails: null,
        error: null
      };

      if (settings?.imageData) {
        stats.imageDetails = {
          size: settings.imageData.length,
          contentType: settings.imageContentType,
          fileName: settings.imageFileName,
          updatedAt: settings.updatedAt,
          createdAt: settings.createdAt,
          endpointUrl: "/api/public/login-image",
          status: "✅ Image stored in database and accessible"
        };
      } else {
        stats.imageDetails = {
          status: "⚠️ No background image configured"
        };
      }

      res.json(stats);
    } catch (error) {
      res.status(500).json({
        error: "Debug check failed",
        details: error.message
      });
    }
  });
};