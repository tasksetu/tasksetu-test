
import React, { useState } from 'react';
import {
  CheckCircle, Edit, FileText, MessageCircle, Target, User,
  Paperclip, Trash2, RotateCcw, ClipboardList, Trophy,
  Bell, Moon, Repeat
} from 'lucide-react';

export default function ActivityFeed({ taskId }) {
  const [activities] = useState([]); // Empty for production - fetch from API
  const [filter, setFilter] = useState('all');
  const filteredActivities = activities.filter(activity => {
    if (filter === 'all') return true
    if (filter === 'comments') return activity.type === 'comment_added' || activity.type === 'comment_edited'
    if (filter === 'updates') return activity.type === 'field_updated' || activity.type === 'status_changed' || activity.type === 'priority_changed'
    if (filter === 'files') return activity.type === 'file_attached' || activity.type === 'file_removed'
    if (filter === 'assignments') return activity.type === 'assignment_changed'
    if (filter === 'forms') return activity.type === 'form_attached' || activity.type === 'form_submitted'
    if (filter === 'system') return activity.type === 'reminder_sent' || activity.type === 'milestone_reached'
    return true
  })

  const getActivityIcon = (type) => {
    const iconComponents = {
      task_created: <CheckCircle size={16} className="text-green-500" />,
      field_updated: <Edit size={16} className="text-blue-500" />,
      subtask_added: <FileText size={16} className="text-purple-500" />,
      subtask_completed: <CheckCircle size={16} className="text-green-500" />,
      status_changed: <RotateCcw size={16} className="text-orange-500" />,
      priority_changed: <Target size={16} className="text-red-500" />,
      assignment_changed: <User size={16} className="text-indigo-500" />,
      comment_added: <MessageCircle size={16} className="text-blue-500" />,
      comment_edited: <Edit size={16} className="text-blue-500" />,
      file_attached: <Paperclip size={16} className="text-gray-500" />,
      file_removed: <Trash2 size={16} className="text-red-500" />,
      recurrence_updated: <Repeat size={16} className="text-purple-500" />,
      form_attached: <ClipboardList size={16} className="text-green-500" />,
      form_submitted: <CheckCircle size={16} className="text-green-500" />,
      task_completed: <CheckCircle size={16} className="text-green-500" />,
      task_reopened: <RotateCcw size={16} className="text-orange-500" />,
      milestone_reached: <Trophy size={16} className="text-yellow-500" />,
      reminder_sent: <Bell size={16} className="text-blue-500" />,
      task_snoozed: <Moon size={16} className="text-gray-500" />
    }
    return iconComponents[type] || <FileText size={16} className="text-gray-500" />
  }

  const getActivityMessage = (activity) => {
    const { type, user, details } = activity

    switch (type) {
      case 'task_created':
        return `${user} created this task.`

      case 'field_updated':
        if (details.field === 'due_date') {
          return `Due Date changed from ${formatDate(details.oldValue)} to ${formatDate(details.newValue)}.`
        } else if (details.field === 'title') {
          return `Title changed from "${details.oldValue}" to "${details.newValue}".`
        } else if (details.field === 'description') {
          return `Description updated.`
        } else {
          return `${details.fieldLabel} changed from "${details.oldValue}" to "${details.newValue}".`
        }

      case 'subtask_added':
        return `Subtask '${details.subtaskTitle}' added by ${user}.`

      case 'subtask_completed':
        return `Subtask '${details.subtaskTitle}' completed by ${user}.`

      case 'status_changed':
        return `Status updated to '${details.newStatus}'.`

      case 'priority_changed':
        return `Priority changed to '${capitalizeFirst(details.newPriority)}'.`

      case 'assignment_changed':
        if (details.previousAssignee) {
          return `Task assigned to ${details.assignedTo} by ${user}.`
        } else {
          return `Task assigned to ${details.assignedTo} by ${user}.`
        }

      case 'comment_added':
        return (
          <span>
            {user} commented:
            <span className="comment-preview" title="Click to view full comment">
              "{details.commentPreview.length > 50
                ? details.commentPreview.substring(0, 50) + '...'
                : details.commentPreview}"
            </span>
          </span>
        )

      case 'comment_edited':
        return (
          <span>
            {user} edited a comment:
            <span className="comment-preview" title="Click to view full comment">
              "{details.commentPreview.length > 50
                ? details.commentPreview.substring(0, 50) + '...'
                : details.commentPreview}"
            </span>
          </span>
        )

      case 'file_attached':
        return `${details.fileName} (${details.fileSize}) added by ${user}.`

      case 'file_removed':
        return `${details.fileName} removed by ${user}.`

      case 'recurrence_updated':
        return `Recurring pattern updated from ${details.oldPattern} to ${details.newPattern}.`

      case 'form_attached':
        return `Form '${details.formTitle}' attached by ${user}.`

      case 'form_submitted':
        return `Form '${details.formTitle}' submitted.`

      case 'task_completed':
        return `Task marked Complete by ${user}.`

      case 'task_reopened':
        return `Task reopened by ${user}${details.reason ? ` - ${details.reason}` : ''}.`

      case 'milestone_reached':
        return `Milestone '${details.milestoneTitle}' reached.`

      case 'reminder_sent':
        return `System sent reminder: ${details.message} to ${details.recipient}.`

      case 'task_snoozed':
        const snoozeDate = new Date(details.snoozeUntil).toLocaleString()
        const noteText = details.note ? ` - ${details.note}` : ''
        return `Task snoozed until ${snoozeDate} by ${user}${noteText}.`

      default:
        return `${user} performed an action.`
    }
  }

  const formatDate = (dateString) => {
    const date = new Date(dateString)
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: date.getFullYear() !== new Date().getFullYear() ? 'numeric' : undefined
    })
  }

  const capitalizeFirst = (str) => {
    return str.charAt(0).toUpperCase() + str.slice(1)
  }

  const formatTimestamp = (timestamp) => {
    const date = new Date(timestamp)
    const now = new Date()
    const diffInHours = Math.floor((now - date) / (1000 * 60 * 60))

    if (diffInHours < 1) {
      const diffInMinutes = Math.floor((now - date) / (1000 * 60))
      return diffInMinutes <= 0 ? 'Just now' : `${diffInMinutes} minute${diffInMinutes === 1 ? '' : 's'} ago`
    } else if (diffInHours < 24) {
      return `${diffInHours} hour${diffInHours === 1 ? '' : 's'} ago`
    } else {
      const diffInDays = Math.floor(diffInHours / 24)
      if (diffInDays < 7) {
        return `${diffInDays} day${diffInDays === 1 ? '' : 's'} ago`
      } else {
        return date.toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
          year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined
        })
      }
    }
  }

  const getUserAvatar = (user, userId) => {
    if (userId === 0 || user === 'System') {
      return (
        <div className="w-8 h-8 bg-gray-400 rounded-full flex items-center justify-center">
          <span className="text-xs text-white">⚙️</span>
        </div>
      )
    }

    const initials = user.split(' ').map(n => n[0]).join('').slice(0, 2)
    const colors = ['bg-blue-500', 'bg-green-500', 'bg-purple-500', 'bg-red-500', 'bg-yellow-500', 'bg-indigo-500']
    const colorIndex = userId % colors.length

    return (
      <div className={`w-8 h-8 ${colors[colorIndex]} rounded-full flex items-center justify-center`}>
        <span className="text-xs font-medium text-white">{initials}</span>
      </div>
    )
  }

  const groupActivitiesByDay = (activities) => {
    const groups = {}
    activities.forEach(activity => {
      const date = new Date(activity.timestamp).toDateString()
      if (!groups[date]) {
        groups[date] = []
      }
      groups[date].push(activity)
    })
    return groups
  }

  const groupedActivities = groupActivitiesByDay(filteredActivities)

  const formatDayHeader = (dateString) => {
    const date = new Date(dateString)
    const today = new Date().toDateString()
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toDateString()

    if (dateString === today) return 'Today'
    if (dateString === yesterday) return 'Yesterday'

    return date.toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: date.getFullYear() !== new Date().getFullYear() ? 'numeric' : undefined
    })
  }

  const handleCommentClick = (commentId) => {
    // In a real app, this would scroll to or highlight the comment
    console.log(`Navigate to comment ${commentId}`)
  }

  const handleFileClick = (fileId, fileName) => {
    // In a real app, this would download or preview the file
    console.log(`Open file ${fileName} (ID: ${fileId})`)
  }

  return (
    <div className="space-y-3 p-5 h-auto overflow-scroll">
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Activity Feed</h1>
          <p className="mt-2 text-lg text-gray-600">Track all task activities and changes</p>
        </div>
        <div className="mt-4 lg:mt-0">
          <select
            className="form-select"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          >
            <option value="all">All Activities</option>
            <option value="comments">Comments</option>
            <option value="updates">Field Updates</option>
            <option value="files">File Actions</option>
            <option value="assignments">Assignments</option>
            <option value="forms">Forms</option>
            <option value="system">System Actions</option>
          </select>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200">
        {Object.entries(groupedActivities).map(([date, dayActivities]) => (
          <div key={date} className="activity-day-group">
            {/* Day Header */}
            <div className="day-header sticky top-0 bg-gray-50 border-b border-gray-200 px-6 py-3 z-10">
              <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">
                {formatDayHeader(date)}
              </h3>
            </div>

            {/* Day Activities */}
            <div className="space-y-1">
              {dayActivities.map((activity, index) => (
                <div key={activity.id} className="activity-item flex items-start space-x-3 p-4 hover:bg-gray-50 transition-colors duration-200 border-l-4 border-transparent hover:border-l-blue-200">
                  {/* User Avatar */}
                  <div className="flex-shrink-0">
                    {getUserAvatar(activity.user, activity.userId)}
                  </div>

                  {/* Activity Icon */}
                  <div className="flex-shrink-0 w-6 h-6 bg-gray-100 rounded-full flex items-center justify-center mt-1">
                    {getActivityIcon(activity.type)}
                  </div>

                  {/* Activity Content */}
                  <div className="flex-1 min-w-0">
                    <div className="text-sm text-gray-900 activity-message">
                      {getActivityMessage(activity)}

                      {/* Special click handlers for interactive elements */}
                      {(activity.type === 'comment_added' || activity.type === 'comment_edited') && (
                        <button
                          className="ml-2 text-blue-600 hover:text-blue-800 text-xs underline"
                          onClick={() => handleCommentClick(activity.details.commentId)}
                        >
                          View
                        </button>
                      )}

                      {activity.type === 'file_attached' && (
                        <button
                          className="ml-2 text-blue-600 hover:text-blue-800 text-xs underline"
                          onClick={() => handleFileClick(activity.details.fileId, activity.details.fileName)}
                        >
                          Download
                        </button>
                      )}
                    </div>

                    <div className="text-xs text-gray-500 mt-1 flex items-center space-x-2">
                      <span>{formatTimestamp(activity.timestamp)}</span>

                      {/* Show exact timestamp on hover */}
                      <span
                        className="cursor-help border-b border-dotted border-gray-400"
                        title={new Date(activity.timestamp).toLocaleString()}
                      >
                        ⓘ
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}

        {filteredActivities.length === 0 && (
          <div className="text-center py-12">
            <div className="text-gray-400 text-6xl mb-3">📝</div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">No activities found</h3>
            <p className="text-gray-500">No activities found for the selected filter.</p>
          </div>
        )}
      </div>
    </div>
  )
}
