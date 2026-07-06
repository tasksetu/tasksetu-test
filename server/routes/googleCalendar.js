import express from 'express';
import { google } from 'googleapis';
import { authenticateToken } from '../middleware/roleAuth.js';
import { checkFeatureAccess } from '../middleware/licenseMiddleware.js';
import * as licenseService from '../services/licenseService.js';

const router = express.Router();

/**
 * License Feature
 * All calendar sync endpoints require TASK_CAL feature access
 */
  
// Test endpoint to verify Google OAuth configuration (temporarily public for debugging)

router.get('/config', (req, res) => {
  console.log('CONFIG ROUTE HIT'); 
  const clientUrl = process.env.CLIENT_URL || 'https://tasksetu.app';

  res.json({
    hasClientId: !!process.env.GOOGLE_CLIENT_ID,
    hasClientSecret: !!process.env.GOOGLE_CLIENT_SECRET,
    clientIdLength: process.env.GOOGLE_CLIENT_ID?.length || 0,
    clientSecretLength: process.env.GOOGLE_CLIENT_SECRET?.length || 0,
    redirectUri: `${clientUrl}/google-calendar-callback`,
    clientIdPreview: process.env.GOOGLE_CLIENT_ID
      ? `${process.env.GOOGLE_CLIENT_ID.substring(0, 20)}...`
      : null,
    clientSecretPreview: process.env.GOOGLE_CLIENT_SECRET
      ? `${process.env.GOOGLE_CLIENT_SECRET.substring(0, 10)}...`
      : null,
  });
});

// Google Calendar OAuth configuration
const CLIENT_URL = process.env.CLIENT_URL || 'https://tasksetu.app';

const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  `${CLIENT_URL}/google-calendar-callback`
);

// Exchange authorization code for access token
router.post('/auth', authenticateToken, checkFeatureAccess('TASK_CAL'), async (req, res) => {
  try {
    console.log('Google Calendar auth request received');
    const { code } = req.body;
    const userId = req.user?.id; // From auth middleware

    console.log('Auth request details:', {
      hasCode: !!code,
      hasUserId: !!userId,
      codeLength: code?.length || 0
    });

    if (!userId) {
      console.error('Auth failed: User not authenticated');
      return res.status(401).json({
        success: false,
        error: 'User not authenticated'
      });
    }

    if (!code) {
      console.error('Auth failed: No authorization code provided');
      return res.status(400).json({
        success: false,
        error: 'Authorization code is required'
      });
    }

    // Check if environment variables are set
    if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
      console.error('Auth failed: Google OAuth credentials not configured');
      return res.status(500).json({
        success: false,
        error: 'Google OAuth not properly configured'
      });
    }

    console.log('Attempting to exchange code for tokens...');
    // Exchange code for tokens
    const { tokens } = await oauth2Client.getToken(code);
    console.log('Token exchange successful');

    // Store tokens securely in database using new storage method
    const { storage } = await import('../mongodb-storage.js');

    await storage.storeGoogleCalendarTokens(userId, {
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      expiry_date: tokens.expiry_date,
      scope: tokens.scope,
      token_type: tokens.token_type
    });

    console.log('Google Calendar tokens stored successfully for user:', userId);

    res.json({
      success: true,
      message: 'Google Calendar connected successfully'
    });
  } catch (error) {
    console.error('Google Calendar auth error:', error);
    console.error('Error details:', {
      message: error.message,
      code: error.code,
      status: error.status
    });
    res.status(400).json({
      success: false,
      error: error.message || 'Failed to authenticate with Google Calendar'
    });
  }
});

// Sync tasks with Google Calendar
router.post('/sync', authenticateToken, checkFeatureAccess('TASK_CAL'), async (req, res) => {
  try {
    const { tasks } = req.body;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'User not authenticated'
      });
    }

    // Get user's Google Calendar tokens
    const { storage } = await import('../mongodb-storage.js');
    const user = await storage.getUser(userId);

    if (!user?.googleCalendarTokens) {
      return res.status(400).json({
        success: false,
        error: 'Google Calendar not connected'
      });
    }

    // Set up OAuth client with stored tokens
    oauth2Client.setCredentials(user.googleCalendarTokens);
    const calendar = google.calendar({ version: 'v3', auth: oauth2Client });

    // Create calendar events for tasks
    const events = [];
    for (const task of tasks) {
      if (task.dueDate) {
        const event = {
          summary: task.title,
          description: `Task: ${task.title}\nPriority: ${task.priority}\nAssignee: ${task.assignee}\nStatus: ${task.status}\nProgress: ${task.progress}%`,
          start: {
            date: task.dueDate,
            timeZone: 'America/New_York', // Adjust timezone as needed
          },
          end: {
            date: task.dueDate,
            timeZone: 'America/New_York',
          },
          colorId: getColorIdByPriority(task.priority)
        };

        // If task has specific time, use datetime instead of date
        if (task.dueTime) {
          const startDateTime = `${task.dueDate}T${task.dueTime}:00`;
          const endDateTime = new Date(new Date(startDateTime).getTime() + 60 * 60 * 1000).toISOString(); // 1 hour duration

          event.start = {
            dateTime: startDateTime,
            timeZone: 'America/New_York',
          };
          event.end = {
            dateTime: endDateTime,
            timeZone: 'America/New_York',
          };
        }

        try {
          const result = await calendar.events.insert({
            calendarId: 'primary',
            resource: event,
          });
          events.push(result.data);
        } catch (eventError) {
          console.error('Error creating calendar event:', eventError);
        }
      }
    }

    // 📊 Track TASK_CAL usage for calendar sync
    try {
      await licenseService.consumeFeature(userId, 'TASK_CAL', 1);
      console.log(`[GoogleCalendar] 📊 TASK_CAL usage tracked for user ${userId}`);
    } catch (usageError) {
      console.error('[GoogleCalendar] ⚠️ Failed to track TASK_CAL usage:', usageError.message);
    }

    res.json({
      success: true,
      message: `${events.length} tasks synced to Google Calendar`,
      events
    });
  } catch (error) {
    console.error('Google Calendar sync error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to sync tasks with Google Calendar'
    });
  }
});

// Get color ID based on task priority
function getColorIdByPriority(priority) {
  const colorMap = {
    'Low': '2',      // Green
    'Medium': '5',   // Yellow
    'High': '6',     // Orange
    'Urgent': '11'   // Red
  };
  return colorMap[priority] || '1'; // Default blue
}

// Disconnect Google Calendar
router.delete('/disconnect', authenticateToken, async (req, res) => {
  try {
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'User not authenticated'
      });
    }

    const { storage } = await import('../mongodb-storage.js');
    await storage.removeGoogleCalendarTokens(userId);

    res.json({
      success: true,
      message: 'Google Calendar disconnected successfully'
    });
  } catch (error) {
    console.error('Google Calendar disconnect error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to disconnect Google Calendar'
    });
  }
});

// Check connection status
router.get('/status', authenticateToken, async (req, res) => {
  try {
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'User not authenticated'
      });
    }

    const { storage } = await import('../mongodb-storage.js');
    const user = await storage.getUser(userId);

    res.json({
      connected: !!user?.googleCalendarConnected,
      hasValidTokens: user?.googleCalendarTokens && user.googleCalendarTokens.access_token,
      email: user?.googleCalendarEmail || null
    });
  } catch (error) {
    console.error('Google Calendar status check error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to check Google Calendar status'
    });
  }
});

export { router as googleCalendarRoutes };