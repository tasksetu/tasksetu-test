import mongoose from "mongoose";

const LoginSettingsSchema = new mongoose.Schema(
    {
        backgroundColor: {
            type: String,
            default: "#f3f4f6",
        },
        gradientFrom: {
            type: String,
            default: "#e5e7eb",
        },
        gradientTo: {
            type: String,
            default: "#d1d5db",
        },
        useGradient: {
            type: Boolean,
            default: true,
        },
        backgroundImage: {
            type: String,
            default: "",
        },
        imageData: {
            type: Buffer,
            default: null,
        },
        imageContentType: {
            type: String,
            default: "image/jpeg",
        },
        imageFileName: {
            type: String,
            default: "",
        },
        overlayOpacity: {
            type: Number,
            default: 0.5,
            min: 0,
            max: 1,
        },
        updatedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
        },
    },
    {
        timestamps: true,
    }
);

export const LoginSettings = mongoose.model("LoginSettings", LoginSettingsSchema);
