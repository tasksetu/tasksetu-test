import fs from 'fs';
import path from 'path';
import { MongoClient } from 'mongodb';
import dotenv from 'dotenv';

dotenv.config();

// Use the database URL provided
const uri = process.env.DATABASE_URL;
const outputDir = "D:\\tasksetu_backup";

async function runBackup() {
  console.log("📦 Starting MongoDB Backup...");
  console.log(`Connection URI: ${uri.replace(/:([^@]+)@/, ':****@')}`);
  console.log(`Output Directory: ${outputDir}\n`);

  const client = new MongoClient(uri);
  try {
    await client.connect();
    const db = client.db();

    const collections = await db.listCollections().toArray();

    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    for (const col of collections) {
      const colName = col.name;
      const docs = await db.collection(colName).find({}).toArray();
      const filePath = path.join(outputDir, `${colName}.json`);
      fs.writeFileSync(filePath, JSON.stringify(docs, null, 2));
      console.log(`  ✓ Exported ${colName.padEnd(25)} : ${docs.length} documents -> ${colName}.json`);
    }

    console.log(`\n🎉 Backup finished! All files saved to "${outputDir}".`);
  } catch (error) {
    console.error("❌ Backup failed:", error);
  } finally {
    await client.close();
  }
}

runBackup();
