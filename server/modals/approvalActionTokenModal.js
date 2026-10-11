import mongoose from "mongoose";
import crypto from "crypto";

const approvalActionTokenSchema = new mongoose.Schema(
  {
    requestId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "TaskChangeRequest",
      required: true,
      index: true,
    },
    tokenHash: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    expiresAt: {
      type: Date,
      required: true,
    },
    usedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

// TTL index to automatically purge old expired tokens after 7 days
approvalActionTokenSchema.index(
  { expiresAt: 1 },
  { expireAfterSeconds: 7 * 24 * 60 * 60 }
);

/**
 * Hash raw token using SHA-256
 */
approvalActionTokenSchema.statics.hashToken = function (rawToken) {
  return crypto.createHash("sha256").update(String(rawToken).trim()).digest("hex");
};

/**
 * Generate a new cryptographically secure random token and save its hash
 */
approvalActionTokenSchema.statics.createToken = async function (
  requestId,
  ttlHours = 24
) {
  const rawToken = crypto.randomBytes(32).toString("hex");
  const tokenHash = this.hashToken(rawToken);
  const expiresAt = new Date(Date.now() + ttlHours * 60 * 60 * 1000);

  const tokenDoc = await this.create({
    requestId,
    tokenHash,
    expiresAt,
  });

  return {
    rawToken,
    tokenDoc,
    expiresAt,
  };
};

/**
 * Find valid, unused, and unexpired token by raw token
 */
approvalActionTokenSchema.statics.findValidToken = async function (rawToken) {
  if (!rawToken) return null;
  const tokenHash = this.hashToken(rawToken);

  const tokenDoc = await this.findOne({
    tokenHash,
    usedAt: null,
    expiresAt: { $gt: new Date() },
  }).populate("requestId");

  return tokenDoc;
};

export const ApprovalActionToken =
  mongoose.models.ApprovalActionToken ||
  mongoose.model("ApprovalActionToken", approvalActionTokenSchema);

export default ApprovalActionToken;
