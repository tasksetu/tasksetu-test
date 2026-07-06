import { google } from 'googleapis';
import { Client } from '@azure/msal-node';
import cron from 'node-cron';
import { storage } from '../mongodb-storage.js';
import TimezoneHelper from '../utils/timezoneHelper.js';

class CalendarService {
  constructor() {
    this.googleAuth = null;
    this.googleCalendar = null;
    this.outlookClient = null;
    this.isRunning = false;
  }

  // Initialize Google Calendar API
  async initializeGoogleCalendar(credentials) {
    try {
      this.googleAuth = new google.auth.OAuth2(
        credentials.clientId,
        credentials.clientSecret,
        credentials.redirectUri
      );

      this.googleAuth.setCredentials({
        refresh_token: credentials.refreshToken
      });

      this.googleCalendar = google.calendar({ version: 'v3', auth: this.googleAuth });
      return true;
    } catch (error) {
      console.error('Google Calendar initialization error:', error);
      return false;
    }
  }

  // Initialize Outlook Calendar
  async initializeOutlook(credentials) {
    try {
      const clientConfig = {
        auth: {
          clientId: credentials.clientId,
          clientSecret: credentials.clientSecret,
          authority: 'https://login.microsoftonline.com/common'
        }
      };

      this.outlookClient = new Client(clientConfig);
      return true;
    } catch (error) {
      console.error('Outlook Calendar initialization error:', error);
      return false;
    }
  }

  // Fetch Google Calendar events
  async fetchGoogleCalendarEvents(organizationId, userId) {
    try {
      if (!this.googleCalendar) {
        throw new Error('Google Calendar not configured');
      }

      const now = new Date();
      const oneWeekFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

      const response = await this.googleCalendar.events.list({
        calendarId: 'primary',
        timeMin: now.toISOString(),
        timeMax: oneWeekFromNow.toISOString(),
        maxResults: 50,
        singleEvents: true,
        orderBy: 'startTime'
      });

      const events = response.data.items || [];
      return events.map(event => ({
        id: event.id,
        title: event.summary || 'Untitled Event',
        description: event.description || '',
        start: new Date(event.start.dateTime || event.start.date),
        end: new Date(event.end.dateTime || event.end.date),
        location: event.location || '',
        attendees: event.attendees || [],
        source: 'google_calendar'
      }));
    } catch (error) {
      console.error('Google Calendar fetch error:', error);
      throw error;
    }
  }

  // Fetch Outlook Calendar events
  async fetchOutlookEvents(organizationId, userId, accessToken) {
    try {
      const now = new Date();
      const oneWeekFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

      const response = await fetch('https://graph.microsoft.com/v1.0/me/events', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        params: {
          '$filter': `start/dateTime ge '${now.toISOString()}' and start/dateTime le '${oneWeekFromNow.toISOString()}'`,
          '$orderby': 'start/dateTime',
          '$top': 50
        }
      });

      const data = await response.json();
      const events = data.value || [];

      return events.map(event => ({
        id: event.id,
        title: event.subject || 'Untitled Event',
        description: event.body?.content || '',
        start: new Date(event.start.dateTime),
        end: new Date(event.end.dateTime),
        location: event.location?.displayName || '',
        attendees: event.attendees || [],
        source: 'outlook_calendar'
      }));
    } catch (error) {
      console.error('Outlook Calendar fetch error:', error);
      throw error;
    }
  }

  // Convert calendar event to task
  async eventToTask(event, organizationId, userId) {
    try {
      const taskData = this.parseEventForTask(event);

      // Check if task already exists for this event
      const existingTasks = await storage.getTasks({
        organizationId,
        'sourceMetadata.eventId': event.id
      });

      if (existingTasks.length > 0) {
        console.log(`Task already exists for event: ${event.title}`);
        return existingTasks[0];
      }

      const task = await storage.createTask({
        title: taskData.title,
        description: taskData.description,
        priority: taskData.priority,
        dueDate: taskData.dueDate,
        organization: organizationId,
        createdBy: userId,
        assignedTo: userId,
        source: 'calendar',
        sourceMetadata: {
          eventId: event.id,
          eventTitle: event.title,
          eventStart: event.start,
          eventEnd: event.end,
          eventLocation: event.location,
          calendarSource: event.source
        }
      });

      return task;
    } catch (error) {
      console.error('Error converting event to task:', error);
      throw error;
    }
  }

  // Parse calendar event to extract task information
  parseEventForTask(event) {
    const title = event.title || 'Untitled Event';
    let description = event.description || '';

    // Add event details to description
    const eventDetails = [
      `Calendar Event: ${title}`,
      `Start: ${event.start.toISOString()}`,
      `End: ${event.end.toISOString()}`
    ];

    if (event.location) {
      eventDetails.push(`Location: ${event.location}`);
    }

    if (event.attendees && event.attendees.length > 0) {
      const attendeeNames = event.attendees.map(a => a.email || a.displayName).join(', ');
      eventDetails.push(`Attendees: ${attendeeNames}`);
    }

    if (description) {
      eventDetails.push(`\nDescription: ${description}`);
    }

    description = eventDetails.join('\n');

    // Determine priority based on event timing and keywords
    let priority = 'medium';
    const now = new Date();
    const timeUntilEvent = event.start.getTime() - now.getTime();
    const hoursUntilEvent = timeUntilEvent / (1000 * 60 * 60);

    // High priority if event is within 24 hours
    if (hoursUntilEvent <= 24) {
      priority = 'high';
    } else if (hoursUntilEvent <= 72) {
      priority = 'medium';
    } else {
      priority = 'low';
    }

    // Check for urgent keywords in title or description
    const urgentKeywords = ['urgent', 'important', 'critical', 'asap', 'deadline'];
    const eventText = (title + ' ' + description).toLowerCase();

    if (urgentKeywords.some(keyword => eventText.includes(keyword))) {
      priority = 'high';
    }

    // Set due date to 30 minutes before event start
    const dueDate = new Date(event.start.getTime() - 30 * 60 * 1000);

    return {
      title: `Prepare for: ${title}`,
      description,
      priority,
      dueDate
    };
  }

  // Manual calendar sync
  async syncCalendars(organizationId, userId, sources = ['google', 'outlook'], outlookAccessToken = null) {
    try {
      const allEvents = [];
      const results = {
        eventsProcessed: 0,
        tasksCreated: 0,
        tasks: []
      };

      // Fetch Google Calendar events
      if (sources.includes('google') && this.googleCalendar) {
        try {
          const googleEvents = await this.fetchGoogleCalendarEvents(organizationId, userId);
          allEvents.push(...googleEvents);
        } catch (error) {
          console.error('Error fetching Google Calendar events:', error);
        }
      }

      // Fetch Outlook events
      if (sources.includes('outlook') && outlookAccessToken) {
        try {
          const outlookEvents = await this.fetchOutlookEvents(organizationId, userId, outlookAccessToken);
          allEvents.push(...outlookEvents);
        } catch (error) {
          console.error('Error fetching Outlook events:', error);
        }
      }

      results.eventsProcessed = allEvents.length;

      // Convert events to tasks
      for (const event of allEvents) {
        try {
          const task = await this.eventToTask(event, organizationId, userId);
          results.tasks.push(task);
          results.tasksCreated++;
        } catch (error) {
          console.error('Error converting event to task:', error);
        }
      }

      return results;
    } catch (error) {
      console.error('Calendar sync error:', error);
      throw error;
    }
  }

  // Get upcoming events summary
  async getUpcomingEvents(organizationId, userId, sources = ['google', 'outlook'], outlookAccessToken = null) {
    try {
      const allEvents = [];

      // Fetch Google Calendar events
      if (sources.includes('google') && this.googleCalendar) {
        try {
          const googleEvents = await this.fetchGoogleCalendarEvents(organizationId, userId);
          allEvents.push(...googleEvents);
        } catch (error) {
          console.error('Error fetching Google Calendar events:', error);
        }
      }

      // Fetch Outlook events
      if (sources.includes('outlook') && outlookAccessToken) {
        try {
          const outlookEvents = await this.fetchOutlookEvents(organizationId, userId, outlookAccessToken);
          allEvents.push(...outlookEvents);
        } catch (error) {
          console.error('Error fetching Outlook events:', error);
        }
      }

      // Sort events by start time
      allEvents.sort((a, b) => a.start.getTime() - b.start.getTime());

      return allEvents;
    } catch (error) {
      console.error('Error getting upcoming events:', error);
      throw error;
    }
  }

  // Get calendar integration status
  getIntegrationStatus() {
    return {
      googleCalendar: !!this.googleCalendar,
      outlook: !!this.outlookClient,
      isRunning: this.isRunning
    };
  }
}

export default new CalendarService();