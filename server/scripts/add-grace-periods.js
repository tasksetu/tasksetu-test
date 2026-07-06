/**
 * Migration Script: Add grace_period_days to License records
 * 
 * Grace periods per license tier:
 * - EXPLORE: 0 days (free tier, no grace)
 * - PLAN: 5 days
 * - EXECUTE: 7 days
 * - OPTIMIZE: 10 days
 * 
 * Run: node server/scripts/add-grace-periods.js
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();

const GRACE_PERIODS = {
  'EXPLORE': 0,
  'PLAN': 5,
  'EXECUTE': 7,
  'OPTIMIZE': 10,
  'EXPIRED': 0,
};

async function migrateGracePeriods() {
  try {
    const mongoUri = process.env.MONGODB_URI || process.env.DATABASE_URL;
    if (!mongoUri) {
      console.error('❌ No MongoDB URI found in environment variables');
      process.exit(1);
    }

    console.log('🔗 Connecting to MongoDB...');
    await mongoose.connect(mongoUri);
    console.log('✅ Connected to MongoDB');

    const db = mongoose.connection.db;
    const licensesCollection = db.collection('licenses');

    for (const [code, days] of Object.entries(GRACE_PERIODS)) {
      const result = await licensesCollection.updateOne(
        { license_code: code },
        { $set: { grace_period_days: days } }
      );

      if (result.matchedCount > 0) {
        console.log(`✅ ${code}: Set grace_period_days = ${days} (matched: ${result.matchedCount}, modified: ${result.modifiedCount})`);
      } else {
        console.log(`⚠️ ${code}: No license record found (skipped)`);
      }
    }

    console.log('\n🎉 Migration complete!');
    await mongoose.disconnect();
    process.exit(0);
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    await mongoose.disconnect();
    process.exit(1);
  }
}

migrateGracePeriods();
