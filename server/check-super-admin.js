import { storage } from './mongodb-storage.js';

async function checkSuperAdminCredentials() {
  try {
    console.log('Checking for super admin users...\n');
    
    const users = await storage.getUsers();
    const superAdmins = users.filter(user => user.role === 'superadmin');
    
    if (superAdmins.length === 0) {
      console.log('❌ No super admin users found in the system');
      return;
    }
    
    console.log(`✅ Found ${superAdmins.length} super admin user(s):\n`);
    
    superAdmins.forEach((admin, index) => {
      console.log(`${index + 1}. Email: ${admin.email}`);
      console.log(`   Name: ${admin.firstName} ${admin.lastName}`);
      console.log(`   Role: ${admin.role}`);
      console.log(`   Email Verified: ${admin.emailVerified ? 'Yes' : 'No'}`);
      console.log(`   Organization: ${admin.organizationId || 'None'}`);
      console.log(`   Created: ${admin.createdAt}`);
      console.log('');
    });
    
    console.log('Note: Passwords are encrypted and cannot be displayed for security.');
    console.log('If you need to reset a super admin password, use the password reset functionality.');
    
  } catch (error) {
    console.error('Error checking super admin credentials:', error);
  }
  
  process.exit(0);
}

checkSuperAdminCredentials();