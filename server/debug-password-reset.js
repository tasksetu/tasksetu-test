
import { emailService } from './services/emailService.js';

async function debugPasswordReset() {
  console.log('🔍 Debugging Password Reset Email Flow...\n');
  
  // Check if email service is configured
  console.log('1. Checking email service configuration...');
  console.log('   Email service available:', emailService.isEmailServiceAvailable());
  
  if (!emailService.isEmailServiceAvailable()) {
    console.log('❌ Email service not configured. Check these environment variables:');
    console.log('   MAILTRAP_HOST:', process.env.MAILTRAP_HOST ? '✅ Set' : '❌ Missing');
    console.log('   MAILTRAP_PORT:', process.env.MAILTRAP_PORT ? '✅ Set' : '❌ Missing');
    console.log('   MAILTRAP_USERNAME:', process.env.MAILTRAP_USERNAME ? '✅ Set' : '❌ Missing');
    console.log('   MAILTRAP_PASSWORD:', process.env.MAILTRAP_PASSWORD ? '✅ Set' : '❌ Missing');
    return;
  }
  
  console.log('✅ Email service is configured\n');
  
  // Test sending password reset email
  console.log('2. Testing password reset email...');
  const testEmail = 'test@example.com';
  const testToken = 'test-reset-token-' + Date.now();
  const testName = 'Test User';
  
  try {
    const result = await emailService.sendPasswordResetEmail(testEmail, testToken, testName);
    
    if (result) {
      console.log('✅ Password reset email sent successfully!');
      console.log(`   Check your Mailtrap inbox for: ${testEmail}`);
    } else {
      console.log('❌ Failed to send password reset email');
    }
  } catch (error) {
    console.error('❌ Error during password reset email test:', error.message);
  }
}

debugPasswordReset();
