import mongoose from "mongoose";
import crypto from "crypto";

/**
 * File Store Schema
 * Manages file uploads from form submissions
 * Supports both local storage and S3/object store
 * Spec: Module 5 - Custom Forms - Storage, security & compliance
 */

const fileStoreSchema = new mongoose.Schema(
  {
    file_id: {
      type: mongoose.Schema.Types.ObjectId,
      auto: true,
    },
    // Reference to the form submission this file belongs to
    submission_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "FormSubmission",
      required: true,
      index: true,
    },
    // Which form field this file was uploaded for
    field_id: {
      type: String,
      required: true,
    },
    // Reference to the form template (for easier querying)
    form_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "FormTemplate",
      required: true,
      index: true,
    },
    // Original filename as uploaded by user
    original_filename: {
      type: String,
      required: true,
    },
    // Stored filename (unique, hashed)
    stored_filename: {
      type: String,
      required: true,
      unique: true,
    },
    // File storage location
    storage_type: {
      type: String,
      enum: ["LOCAL", "S3", "AZURE", "GCP"],
      default: "LOCAL",
    },
    // File path/URL
    file_path: {
      type: String,
      required: true,
    },
    // S3 bucket name (if using S3)
    s3_bucket: {
      type: String,
      default: null,
    },
    // S3 key (if using S3)
    s3_key: {
      type: String,
      default: null,
    },
    // File metadata
    file_size: {
      type: Number,
      required: true,
    },
    mime_type: {
      type: String,
      required: true,
    },
    file_extension: {
      type: String,
      required: true,
    },
    // Upload information
    uploaded_by: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null, // null for anonymous submissions
      index: true,
    },
    uploaded_at: {
      type: Date,
      default: Date.now,
      index: true,
    },
    uploaded_from_ip: {
      type: String,
      default: null,
    },
    // Signed URL for secure access (temporary)
    signed_url: {
      type: String,
      default: null,
    },
    signed_url_expiry: {
      type: Date,
      default: null,
    },
    // Security
    is_encrypted: {
      type: Boolean,
      default: false,
    },
    encryption_key_id: {
      type: String,
      default: null,
    },
    // File hash for integrity verification
    file_hash: {
      type: String,
      default: null,
    },
    hash_algorithm: {
      type: String,
      enum: ["MD5", "SHA256", "SHA512"],
      default: "SHA256",
    },
    // Virus scan status (if implemented)
    virus_scan_status: {
      type: String,
      enum: ["PENDING", "CLEAN", "INFECTED", "SKIPPED"],
      default: "SKIPPED",
    },
    virus_scan_at: {
      type: Date,
      default: null,
    },
    // Access control
    is_public: {
      type: Boolean,
      default: false,
    },
    access_count: {
      type: Number,
      default: 0,
    },
    last_accessed_at: {
      type: Date,
      default: null,
    },
    // Retention policy
    retention_policy: {
      type: String,
      enum: ["PERMANENT", "30_DAYS", "90_DAYS", "1_YEAR", "CUSTOM"],
      default: "PERMANENT",
    },
    delete_after: {
      type: Date,
      default: null,
    },
    // Soft delete
    is_deleted: {
      type: Boolean,
      default: false,
      index: true,
    },
    deleted_at: {
      type: Date,
      default: null,
    },
    deleted_by: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    // Metadata
    metadata: {
      image_width: Number,
      image_height: Number,
      duration: Number, // for video/audio files
      page_count: Number, // for PDFs
      thumbnail_path: String,
    },
  },
  {
    timestamps: {
      createdAt: "created_at",
      updatedAt: "updated_at",
    },
  }
);

// Indexes for performance
fileStoreSchema.index({ submission_id: 1 });
fileStoreSchema.index({ form_id: 1, uploaded_at: -1 });
fileStoreSchema.index({ uploaded_by: 1, uploaded_at: -1 });
fileStoreSchema.index({ stored_filename: 1 });
fileStoreSchema.index({ is_deleted: 1 });
fileStoreSchema.index({ delete_after: 1 });

// Compound indexes
fileStoreSchema.index({ form_id: 1, field_id: 1, uploaded_at: -1 });
fileStoreSchema.index({ storage_type: 1, is_deleted: 1 });

// Virtual for easy access to file ID
fileStoreSchema.virtual("id").get(function () {
  return this.file_id || this._id;
});

// Virtual for file size in human-readable format
fileStoreSchema.virtual("file_size_formatted").get(function () {
  const bytes = this.file_size;
  if (bytes === 0) return "0 Bytes";
  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round(bytes / Math.pow(k, i) * 100) / 100 + " " + sizes[i];
});

// Method to check if signed URL is expired
fileStoreSchema.methods.isSignedUrlExpired = function () {
  if (!this.signed_url_expiry) return true;
  return new Date() > this.signed_url_expiry;
};

// Method to generate signed URL (for S3 or local with token)
fileStoreSchema.methods.generateSignedUrl = async function (expiryMinutes = 15) {
  if (this.storage_type === "S3") {
    // TODO: Implement S3 presigned URL generation
    // const s3 = new AWS.S3();
    // const url = await s3.getSignedUrlPromise('getObject', {
    //   Bucket: this.s3_bucket,
    //   Key: this.s3_key,
    //   Expires: expiryMinutes * 60
    // });
    // this.signed_url = url;
    // this.signed_url_expiry = new Date(Date.now() + expiryMinutes * 60 * 1000);
  } else {
    // For local storage, generate a temporary token
    const token = crypto.randomBytes(32).toString("hex");
    this.signed_url = `/api/files/download/${this.file_id}?token=${token}`;
    this.signed_url_expiry = new Date(Date.now() + expiryMinutes * 60 * 1000);
  }
  await this.save();
  return this.signed_url;
};

// Method to increment access count
fileStoreSchema.methods.recordAccess = async function () {
  this.access_count += 1;
  this.last_accessed_at = new Date();
  return await this.save();
};

// Method to soft delete
fileStoreSchema.methods.softDelete = async function (userId) {
  this.is_deleted = true;
  this.deleted_at = new Date();
  this.deleted_by = userId;
  return await this.save();
};

// Method to calculate file hash
fileStoreSchema.methods.calculateHash = function (fileBuffer, algorithm = "SHA256") {
  const hash = crypto.createHash(algorithm.toLowerCase());
  hash.update(fileBuffer);
  this.file_hash = hash.digest("hex");
  this.hash_algorithm = algorithm;
};

// Static method to get total storage used by a form
fileStoreSchema.statics.getTotalStorageForForm = async function (formId) {
  const result = await this.aggregate([
    { $match: { form_id: formId, is_deleted: false } },
    { $group: { _id: null, total: { $sum: "$file_size" } } },
  ]);
  return result.length > 0 ? result[0].total : 0;
};

// Static method to get files pending deletion
fileStoreSchema.statics.getFilesForDeletion = async function () {
  return await this.find({
    delete_after: { $lte: new Date() },
    is_deleted: false,
  });
};

// Static method to clean up expired files
fileStoreSchema.statics.cleanupExpiredFiles = async function () {
  const files = await this.getFilesForDeletion();
  for (const file of files) {
    await file.softDelete(null);
  }
  return files.length;
};

export const FileStore = mongoose.model("FileStore", fileStoreSchema);
