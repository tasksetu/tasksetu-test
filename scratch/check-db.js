import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();

async function run() {
  await mongoose.connect(process.env.DATABASE_URL || process.env.MONGODB_URI || process.env.MONGO_URI);

  const mappings = await mongoose.connection.collection('licensefeaturemappings')
    .find({ feature_code: { $in: ['PROC_CREATE', 'PROC_LAUNCH'] } })
    .toArray();
  console.log('=== LICENSE FEATURE MAPPINGS ===');
  mappings.forEach(m => console.log(`${m.license_code} | ${m.feature_code} | limit: ${m.usage_limit} | enabled: ${m.is_enabled}`));

  const usages = await mongoose.connection.collection('userfeatureusages')
    .find({ feature_code: { $in: ['PROC_CREATE', 'PROC_LAUNCH'] } })
    .toArray();
  console.log(`\n=== USER FEATURE USAGES (${usages.length}) ===`);
  usages.forEach(u => console.log(`User: ${u.user_id} | ${u.feature_code} | count: ${u.used_count} | period: ${u.period_key}`));

  const templates = await mongoose.connection.collection('processtemplates')
    .find({})
    .project({ name: 1, createdBy: 1, organizationId: 1 })
    .toArray();
  console.log(`\n=== PROCESS TEMPLATES (${templates.length}) ===`);
  templates.forEach(t => console.log(`Template: "${t.name}" | createdBy: ${t.createdBy} | org: ${t.organizationId}`));

  const users = await mongoose.connection.collection('users')
    .find({ is_deleted: { $ne: true } })
    .project({ name: 1, email: 1, organizationId: 1, organization_id: 1, license_code: 1, license_instance_id: 1 })
    .toArray();
  console.log(`\n=== ACTIVE USERS (${users.length}) ===`);
  users.forEach(u => console.log(`User: ${u.name || u.email} (${u._id}) | license: ${u.license_code} | instance: ${u.license_instance_id} | org: ${u.organizationId || u.organization_id}`));

  await mongoose.disconnect();
}

run().catch(console.error);
