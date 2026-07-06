import React from 'react';
import QuickTasks from '../taskview/QuickTasks';

/**
 * Quick Tasks Page Component
 * This is the main page for Quick Tasks management with AllTasks UI reference.
 * Personal lightweight tasks for daily to-dos and micro-tasks.
 */
export default function QuickTask() {
    return (
        <div className="min-h-screen flex flex-col bg-gray-50">
            <QuickTasks />
        </div>
    );
}