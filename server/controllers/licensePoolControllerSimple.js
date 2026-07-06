/**
 * Simple license pool controller for testing
 */
export const getOrganizationLicensePool = async (req, res) => {
  try {
    console.log('📋 License pool endpoint called');
    console.log('User:', req.user);

    // Return mock data for now to test if the endpoint works
    const mockLicensePool = [
      {
        license_code: "EXPLORE",
        license_name: "Explore",
        display_name: "Explore (Free)",
        is_current: false,
        total_seats: 0,
        seats_used: 0,
        seats_available: 0,
        price_monthly: 0,
        price_yearly: 0
      },
      {
        license_code: "PLAN",
        license_name: "Plan",
        display_name: "Plan",
        is_current: true,
        total_seats: 10,
        seats_used: 0,
        seats_available: 10,
        price_monthly: 999,
        price_yearly: 9990
      },
      {
        license_code: "EXECUTE",
        license_name: "Execute",
        display_name: "Execute",
        is_current: false,
        total_seats: 0,
        seats_used: 0,
        seats_available: 0,
        price_monthly: 4999,
        price_yearly: 49990
      },
      {
        license_code: "OPTIMIZE",
        license_name: "Optimize",
        display_name: "Optimize",
        is_current: false,
        total_seats: 0,
        seats_used: 0,
        seats_available: 0,
        price_monthly: 9999,
        price_yearly: 99990
      }
    ];

    console.log('✅ Returning mock license pool data');

    res.status(200).json({
      success: true,
      currentLicense: "PLAN",
      licensePool: mockLicensePool,
    });
  } catch (error) {
    console.error('❌ Error in license pool endpoint:', error);
    res.status(500).json({
      success: false,
      message: 'Error getting license pool',
      error: error.message,
    });
  }
};

/**
 * Global license pool status (mock for testing)
 */
export const getLicensePoolStatus = async (req, res) => {
  try {
    console.log('📊 Global license pool endpoint called');

    const mockGlobalData = [
      {
        license_code: "EXPLORE",
        display_name: "Explore (Free)",
        organizations: 5,
        total_seats: 50,
        seats_used: 25,
        seats_available: 25,
        individual_users: 10,
        total_users: 35
      },
      {
        license_code: "PLAN",
        display_name: "Plan",
        organizations: 3,
        total_seats: 30,
        seats_used: 20,
        seats_available: 10,
        individual_users: 2,
        total_users: 22
      },
      {
        license_code: "EXECUTE",
        display_name: "Execute",
        organizations: 2,
        total_seats: 20,
        seats_used: 15,
        seats_available: 5,
        individual_users: 1,
        total_users: 16
      },
      {
        license_code: "OPTIMIZE",
        display_name: "Optimize",
        organizations: 1,
        total_seats: 10,
        seats_used: 8,
        seats_available: 2,
        individual_users: 0,
        total_users: 8
      }
    ];

    res.status(200).json({
      success: true,
      licensePool: mockGlobalData,
    });
  } catch (error) {
    console.error('❌ Error in global license pool:', error);
    res.status(500).json({
      success: false,
      message: 'Error getting global license pool',
      error: error.message,
    });
  }
};