import React, { useState } from 'react';
import { Calendar, Plus, ChevronLeft, ChevronRight, Settings } from 'lucide-react';
import { useRole } from '../../shared/hooks/useRole';
import { Button } from '@/components/ui/button';

/**
 * Calendar View - Future Integration Point
 * This will be the main calendar interface for task scheduling and time management
 */
const CalendarView = () => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewMode, setViewMode] = useState('month'); // month, week, day
  const { canAccessFeature } = useRole();

  // Future: This will integrate with task due dates, recurring tasks, and external calendars

  return (
    <div className="p-4 space-y-3 bg-gray-50 min-h-screen">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <Calendar className="text-blue-600" size={28} />
              Calendar
            </h1>
            <p className="text-gray-600 mt-1">
              View and manage your tasks and events
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {canAccessFeature('calendar') && (
            <Button variant="ghost" size="icon">
              <Settings size={18} />
            </Button>
          )}
          <Button
            variant="primary"
            className="h-9"
            data-testid="button-create-event"
          >
            <Plus size={18} />
            Create Event
          </Button>
        </div>
      </div>

      {/* Calendar Controls */}
      <div className="bg-white p-4 rounded-md shadow-sm border">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => {
                  const newDate = new Date(currentDate);
                  newDate.setMonth(newDate.getMonth() - 1);
                  setCurrentDate(newDate);
                }}
              >
                <ChevronLeft size={18} />
              </Button>
              <h2 className="text-lg font-semibold text-gray-900 min-w-[180px]">
                {currentDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
              </h2>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => {
                  const newDate = new Date(currentDate);
                  newDate.setMonth(newDate.getMonth() + 1);
                  setCurrentDate(newDate);
                }}
              >
                <ChevronRight size={18} />
              </Button>
            </div>
            <Button
              variant="outline"
              className="h-9"
              onClick={() => setCurrentDate(new Date())}
            >
              Today
            </Button>
          </div>

          <div className="flex items-center gap-2">
            {['month', 'week', 'day'].map((mode) => (
              <Button
                key={mode}
                onClick={() => setViewMode(mode)}
                variant={viewMode === mode ? 'primary' : 'outline'}
                className="h-9"
              >
                {mode.charAt(0).toUpperCase() + mode.slice(1)}
              </Button>
            ))}
          </div>
        </div>
      </div>

      {/* Calendar Integration Placeholder */}
      <div className="bg-white rounded-md shadow-sm border p-12 text-center">
        <Calendar className="mx-auto text-gray-400 mb-3" size={64} />
        <h3 className="text-xl font-semibold text-gray-900 mb-2">
          Calendar Integration Coming Soon
        </h3>
        <p className="text-gray-600 max-w-md mx-auto">
          This will integrate with your tasks, show due dates, recurring task schedules,
          and allow you to manage your time effectively. External calendar sync will also be available.
        </p>

        <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-3 max-w-2xl mx-auto">
          <div className="p-4 bg-blue-50 rounded-md">
            <h4 className="font-medium text-blue-900 mb-2">Task Integration</h4>
            <p className="text-sm text-blue-700">
              View task due dates and recurring schedules
            </p>
          </div>
          <div className="p-4 bg-green-50 rounded-md">
            <h4 className="font-medium text-green-900 mb-2">Time Blocking</h4>
            <p className="text-sm text-green-700">
              Schedule focused work sessions
            </p>
          </div>
          <div className="p-4 bg-purple-50 rounded-md">
            <h4 className="font-medium text-purple-900 mb-2">External Sync</h4>
            <p className="text-sm text-purple-700">
              Connect Google, Outlook, and other calendars
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CalendarView;