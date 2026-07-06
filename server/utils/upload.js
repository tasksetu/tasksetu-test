// utils/upload.js
import multer from "multer";
import path from "path";
import fs from "fs";

// Configure multer for file uploads
const uploadStorage = multer.diskStorage({
    destination: function (req, file, cb) {
        const uploadPath = path.join(process.cwd(), 'uploads', 'task-attachments');
        if (!fs.existsSync(uploadPath)) {
            fs.mkdirSync(uploadPath, { recursive: true });
        }
        cb(null, uploadPath);
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
    }
});

import * as r2Storage from "../services/r2Storage.js";

const rawUpload = multer({
    storage: uploadStorage,
    limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
    fileFilter: function (req, file, cb) {
        // Allow common file types
        const allowedMimes = [
            'image/jpeg', 'image/png', 'image/gif',
            'application/pdf',
            'application/msword',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            'application/vnd.ms-excel',
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'text/plain',
            'text/csv'
        ];

        if (allowedMimes.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error('File type not allowed'), false);
        }
    }
});

// Create a restricted upload for comments (2MB limit)
const COMMENT_MAX_SIZE = process.env.MAX_COMMENT_ATTACHMENT_SIZE || 2 * 1024 * 1024;
const rawCommentUpload = multer({
    storage: uploadStorage,
    limits: { fileSize: parseInt(COMMENT_MAX_SIZE) },
    fileFilter: function (req, file, cb) {
        // Same file filter as standard upload
        const allowedMimes = [
            'image/jpeg', 'image/png', 'image/gif',
            'application/pdf',
            'application/msword',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            'application/vnd.ms-excel',
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'text/plain',
            'text/csv'
        ];

        if (allowedMimes.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error('File type not allowed'), false);
        }
    }
});

// Helper function to upload files to R2 after they have been parsed by multer
const uploadFilesToR2Middleware = async (req, res, next) => {
    if (!r2Storage.isR2Enabled()) {
        return next();
    }

    try {
        // Handle req.file (single upload)
        if (req.file) {
            const file = req.file;
            // R2 only uploads if the file was written to disk (has path) and exists
            if (file.path && fs.existsSync(file.path)) {
                const folder = file.path.includes('profile-pics') ? 'profile-pics' : 
                               file.path.includes('support-tickets') ? 'support-tickets' : 
                               file.path.includes('email-attachments') ? 'email-attachments' : 'task-attachments';
                const key = `${folder}/${file.filename}`;
                const buffer = fs.readFileSync(file.path);
                await r2Storage.uploadToR2(buffer, key, file.mimetype);
                
                // Delete local file
                fs.unlinkSync(file.path);
                
                // Update file properties in req.file for controller consumption
                file.path = key;
                file.url = r2Storage.getPublicUrl(key) || `/uploads/${key}`;
            }
        }

        // Handle req.files (array or fields upload)
        if (req.files) {
            const filesList = Array.isArray(req.files) ? req.files : Object.values(req.files).flat();
            for (const file of filesList) {
                if (file.path && fs.existsSync(file.path)) {
                    const folder = file.path.includes('profile-pics') ? 'profile-pics' : 
                                   file.path.includes('support-tickets') ? 'support-tickets' : 
                                   file.path.includes('email-attachments') ? 'email-attachments' : 'task-attachments';
                    const key = `${folder}/${file.filename}`;
                    const buffer = fs.readFileSync(file.path);
                    await r2Storage.uploadToR2(buffer, key, file.mimetype);
                    
                    // Delete local file
                    fs.unlinkSync(file.path);
                    
                    // Update file properties for controller consumption
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
