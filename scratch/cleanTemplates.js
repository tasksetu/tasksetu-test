import fs from "fs";
import path from "path";
import mongoose from "mongoose";
import ProcessTemplate from "../server/process-builder/processTemplateModal.js";

const envFile = fs.readFileSync(path.join(process.cwd(), ".env"), "utf-8");
let mongoUri = "";
for (const line of envFile.split("\n")) {
  const trimmed = line.trim();
  if (trimmed.startsWith("DATABASE_URL=") || trimmed.startsWith("MONGODB_URI=")) {
    mongoUri = trimmed.split("=").slice(1).join("=").trim().replace(/^["']|["']$/g, '');
    break;
  }
}
if (mongoUri.includes("appName=&")) mongoUri = mongoUri.replace("appName=&", "");
if (mongoUri.endsWith("&appName=") || mongoUri.endsWith("?appName=")) mongoUri = mongoUri.replace(/[\?&]appName=$/, "");

async function clean() {
  console.log("Connecting to Mongo...");
  await mongoose.connect(mongoUri);
  const result = await ProcessTemplate.deleteMany({});
  console.log("SUCCESSFULLY DELETED PROCESS TEMPLATES COUNT:", result.deletedCount);
  await mongoose.disconnect();
}

clean().catch(console.error);
