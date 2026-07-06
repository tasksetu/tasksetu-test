import React, { useState, useEffect } from 'react';
import { CheckSquare, X, Search, Loader, AlertCircle, Link as LinkIcon } from 'lucide-react';
import axios from 'axios';
import { Button } from '@/components/ui/button';
import SafeHtml, { getTextPreview } from './common/SafeHtml';

/**
 * LinkedTasksSelector Component
 * 
 * Searchable multi-select dropdown for linking tasks to milestones
 * Shows only regular/recurring tasks (excludes deleted/inactive)
 * 
 * Props:
 * - selectedTasks: Array of already selected task IDs
 * - onTasksChange: Callback when selection changes (receives array of task objects)
 * - disabled: Disable the component
 * - excludeTaskIds: Task IDs to exclude from the list (optional)
 */
export default function LinkedTasksSelector({
  selectedTasks = [],
  onTasksChange,
  disabled = false,
  excludeTaskIds = []
}) {
  const [availableTasks, setAvailableTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [localSelectedTasks, setLocalSelectedTasks] = useState(selectedTasks);

  // Fetch available tasks from API
  useEffect(() => {
    fetchAvailableTasks();
  }, [excludeTaskIds]);

  const fetchAvailableTasks = async () => {
    try {
      setLoading(true);
      setError(null);

      const token = localStorage.getItem('token');
      const excludeIds = excludeTaskIds.join(',');

      const response = await axios.get(
        `/api/tasks/available-for-linking${excludeIds ? `?excludeTaskIds=${excludeIds}` : ''}`,
        {
          headers: {
            Authorization: `Bearer ${token}`
          }
        }
      );

      if (response.data.success) {
        setAvailableTasks(response.data.data.tasks || []);
      } else {
        throw new Error(response.data.message || 'Failed to fetch tasks');
      }
    } catch (err) {
      console.error('Error fetching available tasks:', err);
      setError(err.response?.data?.message || err.message || 'Failed to load tasks');
    } finally {
      setLoading(false);
    }
  };

  // Filter tasks based on search term (including subtasks)
  const filteredTasks = (() => {
    const result = [];

    availableTasks.forEach(task => {
      const taskMatches =
        task.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        task.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        task.assignedTo?.name?.toLowerCase().includes(searchTerm.toLowerCase());

      // If parent task matches or search is empty, add parent and all subtasks
      if (taskMatches || searchTerm === '') {
        result.push(task);

        // Add subtasks if parent is included
        if (task.subtasks && task.subtasks.length > 0) {
          task.subtasks.forEach(subtask => {
            const subtaskMatches =
              subtask.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
              subtask.description?.toLowerCase().includes(searchTerm.toLowerCase());

            if (subtaskMatches || taskMatches) {
              result.push(subtask);
            }
          });
        }
      } else if (task.subtasks && task.subtasks.length > 0) {
        // Check if any subtasks match search
        const matchingSubtasks = task.subtasks.filter(subtask =>
          subtask.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
          subtask.description?.toLowerCase().includes(searchTerm.toLowerCase())
        );

        if (matchingSubtasks.length > 0) {
          result.push(task);
          result.push(...matchingSubtasks);
        }
      }
    });

    return result;
  })();

  // Toggle task selection
  const toggleTask = (task) => {
    let newSelection;
    const isSelected = localSelectedTasks.some(t => t._id === task._id);

    if (isSelected) {
      // Remove task
      newSelection = localSelectedTasks.filter(t => t._id !== task._id);
    } else {
      // Add task
      newSelection = [...localSelectedTasks, task];
    }

    setLocalSelectedTasks(newSelection);
    onTasksChange(newSelection);
  };

  // Remove task from selection
  const removeTask = (taskId) => {
    const newSelection = localSelectedTasks.filter(t => t._id !== taskId);
    setLocalSelectedTasks(newSelection);
    onTasksChange(newSelection);
  };

  // Get status badge color
  const getStatusBadgeColor = (status) => {
    const colors = {
      OPEN: 'bg-gray-100 text-gray-800',
      INPROGRESS: 'bg-blue-100 text-blue-800',
      ONHOLD: 'bg-yellow-100 text-yellow-800',
      DONE: 'bg-green-100 text-green-800',
      CANCELLED: 'bg-red-100 text-red-800'
    };
    return colors[status] || 'bg-gray-100 text-gray-800';
  };

  // Get priority badge color
  const getPriorityBadgeColor = (priority) => {
    const colors = {
      low: 'bg-green-100 text-green-800',
      medium: 'bg-yellow-100 text-yellow-800',
      high: 'bg-orange-100 text-orange-800',
      urgent: 'bg-red-100 text-red-800'
    };
    return colors[priority] || 'bg-gray-100 text-gray-800';
  };

  return (
    <div className="linked-tasks-selector">
      {/* Selected Tasks Display */}
      {localSelectedTasks.length > 0 && (
        <div className="selected-tasks-container mb-3">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            <LinkIcon className="inline w-4 h-4 mr-1" />
            Linked Tasks ({localSelectedTasks.length})
          </label>
          <div className="flex flex-wrap gap-2">
            {localSelectedTasks.map(task => (
              <div
                key={task._id}
                className="inline-flex items-center gap-2 px-3 py-1.5 bg-blue-50 text-blue-800 rounded-md border border-blue-200 text-sm"
              >
                <CheckSquare className="w-3.5 h-3.5" />
                <span className="font-medium w-[100px] truncate" title={task.title}>{task.title}</span>
                <Button
                  variant="ghost"
                  size="icon"
                  type="button"
                  onClick={() => removeTask(task._id)}
                  disabled={disabled}
                  className="ml-1 h-5 w-5 hover:bg-blue-200 rounded-full p-0.5"
                >
                  <X className="w-3.5 h-3.5" />
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Dropdown Trigger */}
      <div className="relative">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Link Tasks to Milestone
        </label>
        <Button
          variant="outline"
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          disabled={disabled || loading}
          className="w-full h-9 px-4 text-left justify-between bg-white"
        >
          <span className="text-gray-700">
            {loading ? 'Loading tasks...' : `Select tasks to link`}
          </span>
          <Search className="w-4 h-4 text-gray-400" />
        </Button>

        {/* Dropdown Menu */}
        {isOpen && (
          <>
            {/* Backdrop */}
            <div
              className="fixed inset-0 z-10"
              onClick={() => setIsOpen(false)}
            />

            {/* Dropdown Content */}
            <div className="absolute z-20 mt-1 w-full bg-white border border-gray-300 rounded-md shadow-lg max-h-96 overflow-auto">
              {/* Search Input */}
              <div className="sticky top-0 bg-white p-3 border-b border-gray-200">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Search tasks..."
                    className="w-full h-9 pl-10 pr-3 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              {/* Loading State */}
              {loading && (
                <div className="flex items-center justify-center p-7">
                  <Loader className="w-6 h-6 animate-spin text-blue-600 mr-2" />
                  <span className="text-gray-600">Loading tasks...</span>
                </div>
              )}

              {/* Error State */}
              {error && (
                <div className="flex items-center justify-center p-7 text-red-600">
                  <AlertCircle className="w-5 h-5 mr-2" />
                  <span>{error}</span>
                </div>
              )}

              {/* Task List */}
              {!loading && !error && (
                <div className="py-2">
                  {filteredTasks.length === 0 ? (
                    <div className="text-center py-8 text-gray-500">
                      <CheckSquare className="w-8 h-8 mx-auto mb-2 text-gray-400" />
                      <p>No tasks available for linking</p>
                      <p className="text-sm mt-1">All eligible tasks are already linked or completed</p>
                    </div>
                  ) : (
                    filteredTasks.map(task => {
                      const isSelected = localSelectedTasks.some(t => t._id === task._id);
                      const isSubtask = task.parentTaskId !== undefined && task.parentTaskId !== null;

                      return (
                        <div
                          key={task._id}
                          onClick={() => toggleTask(task)}
                          className={`px-4 py-3 cursor-pointer hover:bg-gray-50 border-b border-gray-100 transition-colors ${isSelected ? 'bg-blue-50' : ''
                            } ${isSubtask ? 'pl-8 bg-gray-50' : ''}`}
                        >
                          <div className="flex items-start gap-3">
                            {/* Checkbox */}
                            <div className="flex-shrink-0 mt-1">
                              <div className={`w-5 h-5 rounded border-2 flex items-center justify-center ${isSelected
                                ? 'bg-blue-600 border-blue-600'
                                : 'border-gray-300'
                                }`}>
                                {isSelected && (
                                  <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                  </svg>
                                )}
                              </div>
                            </div>

                            {/* Task Info */}
                            <div className="flex-1 min-w-0">
                              <div className="flex items-start justify-between gap-2">
                                <h4 className="text-sm font-medium text-gray-900 truncate" title={task.title}>
                                  {isSubtask ? '📋' : '📌'} {task.title}
                                </h4>
                                <div className="flex items-center gap-1 flex-shrink-0">
                                  <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${getStatusBadgeColor(task.status)}`}>
                                    {task.status}
                                  </span>
                                  <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${getPriorityBadgeColor(task.priority)}`}>
                                    {task.priority}
                                  </span>
                                </div>
                              </div>

                              {task.description && (
                                <p className="text-xs text-gray-600 mt-1 truncate" title={getTextPreview(task.description, 200)}>
                                  <SafeHtml html={task.description} truncate={true} maxLength={80} as="span" />
                                </p>
                              )}

                              <div className="flex items-center gap-3 mt-2 text-xs text-gray-500">
                                {task.assignedTo && (
                                  <span className="flex items-center gap-1">
                                    <span className="w-5 h-5 rounded-full bg-gray-300 flex items-center justify-center text-xs text-gray-700">
                                      {task.assignedTo.name.charAt(0).toUpperCase()}
                                    </span>
                                    {task.assignedTo.name}
                                  </span>
                                )}
                                {task.dueDate && (
                                  <span>
                                    Due: {new Date(task.dueDate).toLocaleDateString("en-GB", {
                                      day: "2-digit",
                                      month: "short",
                                      year: "numeric"
                                    }).replace(',', '')}
                                  </span>
                                )}
                                <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs bg-gray-100 text-gray-700">
                                  {isSubtask ? 'subtask' : task.taskType || 'regular'}
                                </span>
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
