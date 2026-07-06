import express from 'express';

const router = express.Router();

// Test route to create a Google Calendar event for a task
router.post('/test-create-event', async (req, res) => {
  try {
    const { taskId, userId } = req.body;

    if (!taskId || !userId) {
      return res.status(400).json({
        success: false,
        error: 'taskId and userId are required'
      });
    }

    const { storage } = await import('../mongodb-storage.js');

    // Get the task
    const task = await storage.getTask(taskId);
    if (!task) {
      return res.status(404).json({
        success: false,
        error: 'Task not found'
      });
    }

    // Create Google Calendar event
    const calendarEvent = await storage.createGoogleCalendarEventForTask(task);

    if (calendarEvent) {
      res.json({
        success: true,
        message: 'Google Calendar event created successfully',
        eventId: calendarEvent.id,
        eventLink: calendarEvent.htmlLink
      });
    } else {
      res.json({
        success: false,
        message: 'Failed to create Google Calendar event - user may not have connected calendar or task missing required fields'
      });
    }

  } catch (error) {
    console.error('Test Google Calendar event creation error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Test route to check if user has Google Calendar connected
router.get('/test-connection/:userId', async (req, res) => {
  try {
    const { userId } = req.params;

    const { storage } = await import('../mongodb-storage.js');
    const tokens = await storage.getGoogleCalendarTokens(userId);

    res.json({
      success: true,
      hasTokens: !!tokens,
      tokensInfo: tokens ? {
        hasAccessToken: !!tokens.access_token,
        hasRefreshToken: !!tokens.refresh_token,
        expiryDate: tokens.expiry_date
      } : null
    });

  } catch (error) {
    console.error('Test Google Calendar connection error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

export { router as testGoogleCalendarRoutes };