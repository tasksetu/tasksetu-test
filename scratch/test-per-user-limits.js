import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();

import { checkFeatureCodeLimit } from '../server/utils/licenseEnforcement.js';
import { LicenseFeatureMapping } from '../server/modals/licenseFeatureMappingModal.js';
import { UserFeatureUsage } from '../server/modals/userFeatureUsageModal.js';
import ProcessTemplate from '../server/process-builder/processTemplateModal.js';
import Task from '../server/modals/taskModal.js';
import { User } from '../server/modals/userModal.js';

async function run() {
  await mongoose.connect(process.env.DATABASE_URL || process.env.MONGODB_URI || process.env.MONGO_URI);
  console.log('Connected to MongoDB');

  // 1. Ensure PLAN limit is 2 for PROC_CREATE and PROC_LAUNCH
  await LicenseFeatureMapping.updateOne(
    { license_code: 'PLAN', feature_code: 'PROC_CREATE' },
    { $set: { usage_limit: 2, is_enabled: true, limit_type: 'TOTAL' } },
    { upsert: true }
  );
  await LicenseFeatureMapping.updateOne(
    { license_code: 'PLAN', feature_code: 'PROC_LAUNCH' },
    { $set: { usage_limit: 2, is_enabled: true, limit_type: 'TOTAL' } },
    { upsert: true }
  );
  console.log('✅ Updated PLAN mappings: PROC_CREATE = 2, PROC_LAUNCH = 2');

  // 2. Find User A (the one with 11 templates) and User B (same org)
  const orgId = '6a67608a3177c4edda67c69b';
  const userAId = '6a67608a3177c4edda67c69d'; // aichchhikyadav@gmail.com
  const userBId = '6a676566479a5e77a638c843'; // tasksetudevmaster@gmail.com

  const userA = await User.findById(userAId);
  const userB = await User.findById(userBId);

  console.log('\n--- User Context ---');
  console.log(`User A: ${userA?.email} | Org: ${userA?.organizationId || userA?.organization_id}`);
  console.log(`User B: ${userB?.email} | Org: ${userB?.organizationId || userB?.organization_id}`);

  // Count templates created by User A vs User B
  const templatesByA = await ProcessTemplate.countDocuments({ createdBy: { $in: [userAId, new mongoose.Types.ObjectId(userAId)] } });
  const templatesByB = await ProcessTemplate.countDocuments({ createdBy: { $in: [userBId, new mongoose.Types.ObjectId(userBId)] } });
  const totalOrgTemplates = await ProcessTemplate.countDocuments({ organizationId: { $in: [orgId, new mongoose.Types.ObjectId(orgId)] } });

  console.log(`\n--- Template Counts ---`);
  console.log(`Total templates in organization: ${totalOrgTemplates}`);
  console.log(`Templates created by User A: ${templatesByA}`);
  console.log(`Templates created by User B: ${templatesByB}`);

  // Test UserFeatureUsage.getCurrentUsage for User B
  const userBCreationUsage = await UserFeatureUsage.getCurrentUsage(userBId, 'PROC_CREATE', 'TOTAL');
  const userBLaunchUsage = await UserFeatureUsage.getCurrentUsage(userBId, 'PROC_LAUNCH', 'TOTAL');

  console.log(`\n--- User B Direct getCurrentUsage Results ---`);
  console.log(`User B PROC_CREATE usage: ${userBCreationUsage} (Expect 0, NOT ${totalOrgTemplates})`);
  console.log(`User B PROC_LAUNCH usage: ${userBLaunchUsage}`);

  // Temporarily set User B to PLAN to test limit 2
  const originalUserBLicense = userB.license_code;
  await User.updateOne({ _id: userBId }, { $set: { license_code: 'PLAN' } });

  // Test getUserCurrentUsage (the method called when serving the UI)
  const featureMappings = await LicenseFeatureMapping.find({
    license_code: 'PLAN',
    feature_code: { $in: ['PROC_CREATE', 'PROC_LAUNCH'] }
  }).lean();
  const uiUsageData = await UserFeatureUsage.getUserCurrentUsage(userBId, featureMappings);
  console.log('\n--- UI Usage Data for User B under PLAN ---');
  console.log('PROC_CREATE UI:', uiUsageData.PROC_CREATE);
  console.log('PROC_LAUNCH UI:', uiUsageData.PROC_LAUNCH);

  // Test checkFeatureCodeLimit for User B
  const checkBBefore = await checkFeatureCodeLimit(userBId, 'PROC_CREATE', templatesByB);
  console.log(`\n--- Check User B PROC_CREATE limit (PLAN limit = 2) ---`);
  console.log(`Allowed: ${checkBBefore.allowed}`);
  console.log(`Usage: ${checkBBefore.usage}`);
  console.log(`Limit: ${checkBBefore.limit}`);
  console.log(`Message: ${checkBBefore.message}`);

  // Test checkFeatureCodeLimit for PROC_LAUNCH
  const checkBLaunch = await checkFeatureCodeLimit(userBId, 'PROC_LAUNCH', 0);
  console.log(`\n--- Check User B PROC_LAUNCH limit (PLAN limit = 2) ---`);
  console.log(`Allowed: ${checkBLaunch.allowed}`);
  console.log(`Usage: ${checkBLaunch.usage}`);
  console.log(`Limit: ${checkBLaunch.limit}`);

  // Restore original license for User B if it was different
  if (originalUserBLicense && originalUserBLicense !== 'PLAN') {
    // Keep PLAN or restore
    await User.updateOne({ _id: userBId }, { $set: { license_code: originalUserBLicense } });
    console.log(`\nRestored User B license to: ${originalUserBLicense}`);
  }

  console.log('\n✅ Verification script completed successfully!');
  await mongoose.disconnect();
}

run().catch(console.error);
