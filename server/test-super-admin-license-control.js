/**
 * Super Admin License Control - Test Script
 * Tests all new endpoints for organization management
 */

import fetch from 'node-fetch';

const API_URL = 'http://localhost:5000';
let authToken = '';
let testOrgId = '';

// Test credentials (use your super admin account)
const SUPER_ADMIN_EMAIL = 'superadmin@tasksetu.com';
const SUPER_ADMIN_PASSWORD = 'SuperAdmin@123';

// Colors for console output
const colors = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  reset: '\x1b[0m'
};

const log = {
  success: (msg) => console.log(`${colors.green}✓ ${msg}${colors.reset}`),
  error: (msg) => console.log(`${colors.red}✗ ${msg}${colors.reset}`),
  info: (msg) => console.log(`${colors.blue}ℹ ${msg}${colors.reset}`),
  warn: (msg) => console.log(`${colors.yellow}⚠ ${msg}${colors.reset}`)
};

/**
 * Step 1: Login as Super Admin
 */
async function loginSuperAdmin() {
  try {
    log.info('Step 1: Logging in as Super Admin...');
    
    const response = await fetch(`${API_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: SUPER_ADMIN_EMAIL,
        password: SUPER_ADMIN_PASSWORD
      })
    });

    const data = await response.json();
    
    if (response.ok && data.token) {
      authToken = data.token;
      log.success(`Logged in successfully as ${data.user.firstName} ${data.user.lastName}`);
      return true;
    } else {
      log.error(`Login failed: ${data.message}`);
      return false;
    }
  } catch (error) {
    log.error(`Login error: ${error.message}`);
    return false;
  }
}

/**
 * Step 2: Search Organizations
 */
async function testSearchOrganizations() {
  try {
    log.info('\nStep 2: Testing Organization Search...');
    
    const response = await fetch(`${API_URL}/api/super-admin/organizations/search?q=test`, {
      headers: { Authorization: `Bearer ${authToken}` }
    });

    const data = await response.json();
    
    if (response.ok && data.success) {
      log.success(`Found ${data.data.length} organizations`);
      
      if (data.data.length > 0) {
        testOrgId = data.data[0]._id;
        log.info(`Using organization: ${data.data[0].name} (${testOrgId})`);
        return true;
      } else {
        log.warn('No organizations found. Please create a test organization first.');
        return false;
      }
    } else {
      log.error(`Search failed: ${data.message}`);
      return false;
    }
  } catch (error) {
    log.error(`Search error: ${error.message}`);
    return false;
  }
}

/**
 * Step 3: Get Organization Details
 */
async function testGetOrganizationDetails() {
  try {
    log.info('\nStep 3: Testing Get Organization Details...');
    
    const response = await fetch(`${API_URL}/api/super-admin/organizations/${testOrgId}`, {
      headers: { Authorization: `Bearer ${authToken}` }
    });

    const data = await response.json();
    
    if (response.ok && data.success) {
      log.success('Organization details retrieved successfully');
      log.info(`Organization: ${data.data.organization.name}`);
      log.info(`Subscription Status: ${data.data.subscription?.status || 'NONE'}`);
      log.info(`Users: ${data.data.users.length}`);
      return true;
    } else {
      log.error(`Get details failed: ${data.message}`);
      return false;
    }
  } catch (error) {
    log.error(`Get details error: ${error.message}`);
    return false;
  }
}

/**
 * Step 4: Override License
 */
async function testOverrideLicense() {
  try {
    log.info('\nStep 4: Testing License Override...');
    
    const response = await fetch(`${API_URL}/api/super-admin/organizations/${testOrgId}/override-license`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authToken}`
      },
      body: JSON.stringify({
        license_code: 'EXECUTE',
        billing_cycle: 'MONTHLY',
        seats: 20,
        reason: 'Testing override functionality'
      })
    });

    const data = await response.json();
    
    if (response.ok && data.success) {
      log.success('License overridden successfully');
      log.info(`New License: ${data.data.license_code}`);
      log.info(`Seats: ${data.data.seats_purchased}`);
      return true;
    } else {
      log.error(`Override failed: ${data.message}`);
      return false;
    }
  } catch (error) {
    log.error(`Override error: ${error.message}`);
    return false;
  }
}

/**
 * Step 5: Extend Trial
 */
async function testExtendTrial() {
  try {
    log.info('\nStep 5: Testing Trial Extension...');
    
    const response = await fetch(`${API_URL}/api/super-admin/organizations/${testOrgId}/extend-trial`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authToken}`
      },
      body: JSON.stringify({
        days: 14,
        reason: 'Testing trial extension'
      })
    });

    const data = await response.json();
    
    if (response.ok && data.success) {
      log.success(`Trial extended by 14 days`);
      log.info(`New Expiry: ${new Date(data.data.expiry_date).toLocaleDateString()}`);
      return true;
    } else {
      log.error(`Extend trial failed: ${data.message}`);
      return false;
    }
  } catch (error) {
    log.error(`Extend trial error: ${error.message}`);
    return false;
  }
}

/**
 * Step 6: Override Feature Flag
 */
async function testOverrideFeatureFlag() {
  try {
    log.info('\nStep 6: Testing Feature Flag Override...');
    
    const response = await fetch(`${API_URL}/api/super-admin/organizations/${testOrgId}/feature-flags`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authToken}`
      },
      body: JSON.stringify({
        feature_code: 'CUSTOM_FORMS',
        enabled: true,
        reason: 'Testing feature override'
      })
    });

    const data = await response.json();
    
    if (response.ok && data.success) {
      log.success('Feature flag overridden successfully');
      return true;
    } else {
      log.error(`Feature override failed: ${data.message}`);
      return false;
    }
  } catch (error) {
    log.error(`Feature override error: ${error.message}`);
    return false;
  }
}

/**
 * Step 7: Suspend License
 */
async function testSuspendLicense() {
  try {
    log.info('\nStep 7: Testing License Suspension...');
    
    const response = await fetch(`${API_URL}/api/super-admin/organizations/${testOrgId}/suspend`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authToken}`
      },
      body: JSON.stringify({
        suspend: true,
        reason: 'Testing suspension'
      })
    });

    const data = await response.json();
    
    if (response.ok && data.success) {
      log.success('License suspended successfully');
      return true;
    } else {
      log.error(`Suspend failed: ${data.message}`);
      return false;
    }
  } catch (error) {
    log.error(`Suspend error: ${error.message}`);
    return false;
  }
}

/**
 * Step 8: Reactivate License
 */
async function testReactivateLicense() {
  try {
    log.info('\nStep 8: Testing License Reactivation...');
    
    const response = await fetch(`${API_URL}/api/super-admin/organizations/${testOrgId}/suspend`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authToken}`
      },
      body: JSON.stringify({
        suspend: false,
        reason: 'Testing reactivation'
      })
    });

    const data = await response.json();
    
    if (response.ok && data.success) {
      log.success('License reactivated successfully');
      return true;
    } else {
      log.error(`Reactivation failed: ${data.message}`);
      return false;
    }
  } catch (error) {
    log.error(`Reactivation error: ${error.message}`);
    return false;
  }
}

/**
 * Step 9: Get Audit Logs
 */
async function testGetAuditLogs() {
  try {
    log.info('\nStep 9: Testing Audit Log Retrieval...');
    
    const response = await fetch(`${API_URL}/api/super-admin/audit-logs?organizationId=${testOrgId}&limit=10`, {
      headers: { Authorization: `Bearer ${authToken}` }
    });

    const data = await response.json();
    
    if (response.ok && data.success) {
      log.success(`Retrieved ${data.data.length} audit log entries`);
      
      if (data.data.length > 0) {
        log.info('Recent actions:');
        data.data.slice(0, 3).forEach(log => {
          console.log(`  - ${log.action} at ${new Date(log.timestamp).toLocaleString()}`);
        });
      }
      return true;
    } else {
      log.error(`Get audit logs failed: ${data.message}`);
      return false;
    }
  } catch (error) {
    log.error(`Get audit logs error: ${error.message}`);
    return false;
  }
}

/**
 * Step 10: Export Organizations
 */
async function testExportOrganizations() {
  try {
    log.info('\nStep 10: Testing Organization Export...');
    
    const response = await fetch(`${API_URL}/api/super-admin/export/organizations?format=json`, {
      headers: { Authorization: `Bearer ${authToken}` }
    });

    const data = await response.json();
    
    if (response.ok && data.success) {
      log.success(`Exported ${data.data.length} organizations`);
      return true;
    } else {
      log.error(`Export failed: ${data.message || 'Unknown error'}`);
      return false;
    }
  } catch (error) {
    log.error(`Export error: ${error.message}`);
    return false;
  }
}

/**
 * Run all tests
 */
async function runAllTests() {
  console.log('\n' + '='.repeat(60));
  console.log('  Super Admin License Control - API Tests');
  console.log('='.repeat(60) + '\n');

  const results = [];

  // Run tests sequentially
  results.push({ name: 'Login', success: await loginSuperAdmin() });
  
  if (!authToken) {
    log.error('\nCannot proceed without authentication. Please check credentials.');
    return;
  }

  results.push({ name: 'Search Organizations', success: await testSearchOrganizations() });
  
  if (!testOrgId) {
    log.error('\nCannot proceed without a test organization.');
    return;
  }

  results.push({ name: 'Get Organization Details', success: await testGetOrganizationDetails() });
  results.push({ name: 'Override License', success: await testOverrideLicense() });
  results.push({ name: 'Extend Trial', success: await testExtendTrial() });
  results.push({ name: 'Override Feature Flag', success: await testOverrideFeatureFlag() });
  results.push({ name: 'Suspend License', success: await testSuspendLicense() });
  results.push({ name: 'Reactivate License', success: await testReactivateLicense() });
  results.push({ name: 'Get Audit Logs', success: await testGetAuditLogs() });
  results.push({ name: 'Export Organizations', success: await testExportOrganizations() });

  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('  Test Summary');
  console.log('='.repeat(60));
  
  const passed = results.filter(r => r.success).length;
  const failed = results.filter(r => !r.success).length;
  
  results.forEach(result => {
    const status = result.success ? colors.green + '✓ PASS' : colors.red + '✗ FAIL';
    console.log(`${status}${colors.reset} - ${result.name}`);
  });
  
  console.log('\n' + '-'.repeat(60));
  console.log(`Total: ${results.length} tests | Passed: ${passed} | Failed: ${failed}`);
  console.log('='.repeat(60) + '\n');
}

// Run tests
runAllTests().catch(error => {
  log.error(`Fatal error: ${error.message}`);
  process.exit(1);
});
