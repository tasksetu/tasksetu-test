/**
 * 📊 Notification Logger Service
 * Comprehensive logging system for task-related notifications
 * Helps debug and track all notification flows with step-by-step logs
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const logsDir = path.join(__dirname, '../../logs');

// Ensure logs directory exists
if (!fs.existsSync(logsDir)) {
    fs.mkdirSync(logsDir, { recursive: true });
}

export class NotificationLogger {
    /**
     * Log notification event with detailed step tracking
     * @param {string} eventType - Type of event (task_created, task_updated, etc.)
     * @param {string} step - Current step in the process
     * @param {Object} data - Data to log
     * @param {string} status - Status (START, PROGRESS, SUCCESS, ERROR, SKIP)
     */
    static log(eventType, step, data = {}, status = 'PROGRESS') {
        const timestamp = new Date().toISOString();
        const logEntry = {
            timestamp,
            eventType,
            step,
            status,
            data,
            processId: process.pid
        };

        // Console log for immediate visibility
        const statusEmoji = {
            'START': '🚀',
            'PROGRESS': '📍',
            'SUCCESS': '✅',
            'ERROR': '❌',
            'SKIP': '⏭️'
        }[status] || '📌';

        console.log(
            `${statusEmoji} [${eventType.toUpperCase()}] [${step}] [${status}]`,
            JSON.stringify(data, null, 2)
        );

        // File log for persistent tracking
        this.writeToFile(eventType, logEntry);
    }

    /**
     * Log task creation flow
     */
    static logTaskCreation(step, data, status = 'PROGRESS') {
        this.log('task_creation', step, data, status);
    }

    /**
     * Log task update flow
     */
    static logTaskUpdate(step, data, status = 'PROGRESS') {
        this.log('task_update', step, data, status);
    }

    /**
     * Log subtask changes
     */
    static logSubtaskChange(step, data, status = 'PROGRESS') {
        this.log('subtask_change', step, data, status);
    }

    /**
     * Log comment additions
     */
    static logCommentAddition(step, data, status = 'PROGRESS') {
        this.log('comment_addition', step, data, status);
    }

    /**
     * Log status changes
     */
    static logStatusChange(step, data, status = 'PROGRESS') {
        this.log('status_change', step, data, status);
    }

    /**
     * Log notification sending
     */
    static logNotificationSend(step, data, status = 'PROGRESS') {
        this.log('notification_send', step, data, status);
    }

    /**
     * Write log entry to file
     */
    static writeToFile(eventType, logEntry) {
        try {
            const logFilename = `${eventType}_${new Date().toISOString().split('T')[0]}.log`;
            const logPath = path.join(logsDir, logFilename);

            const logLine = JSON.stringify(logEntry) + '\n';
            fs.appendFileSync(logPath, logLine, 'utf-8');
        } catch (error) {
            console.error('Failed to write to log file:', error.message);
        }
    }

    /**
     * Get recent logs for an event type
     */
    static getRecentLogs(eventType, lines = 50) {
        try {
            const logFilename = `${eventType}_${new Date().toISOString().split('T')[0]}.log`;
            const logPath = path.join(logsDir, logFilename);

            if (!fs.existsSync(logPath)) {
                return [];
            }

            const content = fs.readFileSync(logPath, 'utf-8');
            const allLines = content.split('\n').filter(line => line.trim());
            return allLines.slice(-lines).map(line => {
                try {
                    return JSON.parse(line);
                } catch {
                    return { raw: line };
                }
            });
        } catch (error) {
            console.error('Failed to read logs:', error.message);
            return [];
        }
    }

    /**
     * Clear old log files (older than specified days)
     */
    static clearOldLogs(olderThanDays = 7) {
        try {
            const now = Date.now();
            const maxAge = olderThanDays * 24 * 60 * 60 * 1000;

            const files = fs.readdirSync(logsDir);
            files.forEach(file => {
                const filePath = path.join(logsDir, file);
                const stats = fs.statSync(filePath);
                if (now - stats.mtime.getTime() > maxAge) {
                    fs.unlinkSync(filePath);
                    console.log(`Deleted old log file: ${file}`);
                }
            });
        } catch (error) {
            console.error('Failed to clear old logs:', error.message);
        }
    }
}

export default NotificationLogger;
