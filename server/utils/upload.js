// utils/upload.js
import multer from "multer";
import path from "path";
import fs from "fs";

import * as r2Storage from "../services/r2Storage.js";

// Configure multer for file uploads (memory storage when R2 enabled, disk storage fallback)
const getStorage = () =>
  r2Storage.isR2Enabled()
    ? multer.memoryStorage()
    : multer.diskStorage({
        destination: function (req, file, cb) {
          const uploadPath = path.join(process.cwd(), "uploads", "task-attachments");
          if (!fs.existsSync(uploadPath)) {
            fs.mkdirSync(uploadPath, { recursive: true });
          }
          cb(null, uploadPath);
        },
        filename: function (req, file, cb) {
          const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
          cb(null, file.fieldname + "-" + uniqueSuffix + path.extname(file.originalname));
        },
      });

const rawUpload = multer({
  storage: getStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: function (req, file, cb) {
    const allowedMimes = [
      "image/jpeg",
      "image/png",
      "image/gif",
      "application/pdf",
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "application/vnd.ms-excel",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "text/plain",
      "text/csv",
    ];

    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("File type not allowed"), false);
    }
  },
});

// Create a restricted upload for comments (2MB limit)
const COMMENT_MAX_SIZE = process.env.MAX_COMMENT_ATTACHMENT_SIZE || 2 * 1024 * 1024;
const rawCommentUpload = multer({
  storage: getStorage(),
  limits: { fileSize: parseInt(COMMENT_MAX_SIZE) },
  fileFilter: function (req, file, cb) {
    const allowedMimes = [
      "image/jpeg",
      "image/png",
      "image/gif",
      "application/pdf",
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "application/vnd.ms-excel",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "text/plain",
      "text/csv",
    ];

    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("File type not allowed"), false);
    }
  },
});

// Helper function to upload files directly to R2 from memory buffer
const uploadFilesToR2Middleware = async (req, res, next) => {
  if (!r2Storage.isR2Enabled()) {
    return next();
  }

  try {
    // Handle req.file (single upload)
    if (req.file) {
      const file = req.file;
      const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
      const ext = path.extname(file.originalname || "") || ".bin";
      const filename =
        file.filename ||
        `${file.fieldname || "attachment"}-${uniqueSuffix}${ext}`;
      const folder = "task-attachments";
      const key = `${folder}/${filename}`;

      const buffer =
        file.buffer ||
        (file.path && fs.existsSync(file.path)
          ? fs.readFileSync(file.path)
          : null);

      if (buffer) {
        await r2Storage.uploadToR2(buffer, key, file.mimetype);
        if (file.path && fs.existsSync(file.path)) {
          try {
            fs.unlinkSync(file.path);
          } catch (e) {}
        }
        file.filename = filename;
        file.path = key;
        file.url = r2Storage.getPublicUrl(key) || `/uploads/${key}`;
      }
    }

    // Handle req.files (array or fields upload)
    if (req.files) {
      const filesList = Array.isArray(req.files)
        ? req.files
        : Object.values(req.files).flat();

      for (const file of filesList) {
        const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
        const ext = path.extname(file.originalname || "") || ".bin";
        const filename =
          file.filename ||
          `${file.fieldname || "attachment"}-${uniqueSuffix}${ext}`;
        const folder = "task-attachments";
        const key = `${folder}/${filename}`;

        const buffer =
          file.buffer ||
          (file.path && fs.existsSync(file.path)
            ? fs.readFileSync(file.path)
            : null);

        if (buffer) {
          await r2Storage.uploadToR2(buffer, key, file.mimetype);
          if (file.path && fs.existsSync(file.path)) {
            try {
              fs.unlinkSync(file.path);
            } catch (e) {}
          }
          file.filename = filename;
          file.path = key;
          file.url = r2Storage.getPublicUrl(key) || `/uploads/${key}`;
        }
      }
    }
  } catch (err) {
    console.error("❌ Error uploading files to R2 in upload middleware:", err.message);
  }

  next();
};

const wrapMulterMiddleware = (multerMiddleware) => {
    return (req, res, next) => {
        multerMiddleware(req, res, (err) => {
            if (err) {
                return next(err);
            }
            uploadFilesToR2Middleware(req, res, next);
        });
    };
};

const makeR2Multer = (multerInstance) => {
    const originalSingle = multerInstance.single;
    const originalArray = multerInstance.array;
    const originalFields = multerInstance.fields;
    const originalAny = multerInstance.any;

    multerInstance.single = function(...args) {
        return wrapMulterMiddleware(originalSingle.apply(multerInstance, args));
    };
    multerInstance.array = function(...args) {
        return wrapMulterMiddleware(originalArray.apply(multerInstance, args));
    };
    multerInstance.fields = function(...args) {
        return wrapMulterMiddleware(originalFields.apply(multerInstance, args));
    };
    multerInstance.any = function(...args) {
        return wrapMulterMiddleware(originalAny.apply(multerInstance, args));
    };

    return multerInstance;
};

const upload = makeR2Multer(rawUpload);
const commentUpload = makeR2Multer(rawCommentUpload);

export { upload, commentUpload, wrapMulterMiddleware };
