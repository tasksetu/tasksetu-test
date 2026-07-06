import React, { useState, useEffect } from "react";
import {
  Activity,
  Loader,
  AlertTriangle,
  Calendar,
  User,
  CheckSquare,
} from "lucide-react";
import { Button } from "@/components/ui/button";

const ActivityFeed = ({
  type = "organization", // 'organization', 'recent', or 'task'
  taskId = null,
  limit = 20,
  className = "",
  showHeader = true,
}) => {
  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [filter, setFilter] = useState("all");

  const fetchActivities = async () => {
    setLoading(true);
    setError(null);

    try {
      const baseUrl =
        import.meta.env.VITE_API_BASE_URL || "http://localhost:5000";
      const token = localStorage.getItem("token");

      let apiUrl = "";

      switch (type) {
        case "task":
          if (!taskId) {
            throw new Error("Task ID required for task activities");
          }
          apiUrl = `/api/tasks/${taskId}/activities?limit=${limit}`;
          break;
        case "organization":
          apiUrl = `/api/activities/organization?limit=${limit}`;
          break;
        case "recent":
          apiUrl = `/api/activities/recent?limit=${limit}`;
          break;
        default:
          throw new Error("Invalid activity type");
      }

      console.log("Fetching activities from:", apiUrl);

      const response = await fetch(apiUrl, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const result = await response.json();
        console.log("Activities API response:", result);

        if (result.success && result.data && result.data.activities) {
          const fetchedActivities = result.data.activities;

          // Format activities for display
          const formattedActivities = fetchedActivities.map((activity) => ({
            id: activity._id,
            type: activity.type,
            description: activity.description,
            icon: activity.metadata?.icon || "📝",
            category: activity.metadata?.category || "general",
            user: activity.user
              ? {
                  id: activity.user._id,
                  name:
                    activity.user.name ||
                    `${activity.user.firstName || ""} ${activity.user.lastName || ""}`.trim(),
                  email: activity.user.email,
                  avatar: activity.user.avatar,
                }
              : null,
            timestamp: activity.createdAt,
            relatedId: activity.relatedId,
            relatedType: activity.relatedType,
            metadata: activity.metadata || {},
          }));

          setActivities(formattedActivities);
          console.log("Activities loaded:", formattedActivities.length);
        } else {
          setActivities([]);
          setError("No activities found");
        }
      } else {
        const errorData = await response.json();
        throw new Error(errorData.message || "Failed to fetch activities");
      }
    } catch (error) {
      console.error("Error fetching activities:", error);
      setError(error.message || "Failed to load activities");
      setActivities([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchActivities();
  }, [type, taskId, limit]);

  // Filter activities based on selected filter
  const filteredActivities =
    filter === "all"
      ? activities
      : activities.filter((activity) => activity.category === filter);

  // Group activities by date
  const groupedActivities = filteredActivities.reduce((groups, activity) => {
    const date = new Date(activity.timestamp).toDateString();
    if (!groups[date]) {
      groups[date] = [];
    }
    groups[date].push(activity);
    return groups;
  }, {});

  const getCategoryIcon = (category) => {
    const icons = {
      task: <CheckSquare className="w-4 h-4" />,
      subtask: <CheckSquare className="w-4 h-4" />,
      comment: <Activity className="w-4 h-4" />,
      approval: <CheckSquare className="w-4 h-4" />,
      file: <Activity className="w-4 h-4" />,
      user: <User className="w-4 h-4" />,
      project: <Activity className="w-4 h-4" />,
      general: <Activity className="w-4 h-4" />,
    };
    return icons[category] || icons.general;
  };

  const getCategoryColor = (category) => {
    const colors = {
      task: "bg-blue-500",
      subtask: "bg-purple-500",
      comment: "bg-green-500",
      approval: "bg-orange-500",
      file: "bg-red-500",
      user: "bg-gray-500",
      project: "bg-teal-500",
      general: "bg-slate-500",
    };
    return colors[category] || colors.general;
  };

  return (
    <div className={`activity-feed ${className}`}>
      {showHeader && (
        <div className="flex justify-between items-center mb-3">
          <div>
            <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
              <Activity className="w-5 h-5" />
              Activity Feed
              {type === "organization" && " - Organization"}
              {type === "recent" && " - Recent"}
              {type === "task" && ` - Task`}
            </h3>
            <p className="text-sm text-gray-600">
              Track all activities and changes
            </p>
          </div>

          <div className="flex gap-3 items-center">
            <select
              className="h-9 px-3 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
            >
              <option value="all">All Activities</option>
              <option value="task">Task Changes</option>
              <option value="subtask">Subtask Changes</option>
              <option value="comment">Comments</option>
              <option value="approval">Approvals</option>
              <option value="file">File Operations</option>
              {/* <option value="user">User Actions</option> */}
            </select>

            <Button
              variant="outline"
              className="h-9 flex items-center gap-2"
              onClick={fetchActivities}
              disabled={loading}
            >
              {loading ? (
                <Loader className="w-4 h-4 animate-spin" />
              ) : (
                "Refresh"
              )}
            </Button>
          </div>
        </div>
      )}

      <div className="activity-list">
        {loading && (
          <div className="flex items-center justify-center py-12">
            <div className="text-center">
              <Loader className="w-8 h-8 animate-spin text-blue-600 mx-auto mb-3" />
              <p className="text-gray-600">Loading activities...</p>
            </div>
          </div>
        )}

        {error && (
          <div className="flex items-center justify-center py-12">
            <div className="text-center">
              <AlertTriangle className="w-8 h-8 text-red-500 mx-auto mb-3" />
              <p className="text-red-600 mb-3">{error}</p>
              <Button
                variant="primary"
                className="h-9"
                onClick={fetchActivities}
              >
                Try Again
              </Button>
            </div>
          </div>
        )}

        {!loading && !error && filteredActivities.length === 0 && (
          <div className="flex items-center justify-center py-12">
            <div className="text-center">
              <Activity className="w-8 h-8 text-gray-400 mx-auto mb-3" />
              <p className="text-gray-600 mb-2">No activities found</p>
              <p className="text-sm text-gray-500">
                Activity will appear here as actions are performed
              </p>
            </div>
          </div>
        )}

        {!loading && !error && filteredActivities.length > 0 && (
          <div className="space-y-3">
            {Object.entries(groupedActivities)
              .sort(([a], [b]) => new Date(b) - new Date(a))
              .map(([date, dayActivities]) => (
                <div key={date}>
                  <div className="flex items-center gap-3 mb-3">
                    <Calendar className="w-4 h-4 text-gray-500" />
                    <h4 className="text-sm font-medium text-gray-700 uppercase tracking-wide">
                      {new Date(date).toLocaleDateString("en-US", {
                        weekday: "long",
                        year: "numeric",
                        month: "long",
                        day: "numeric",
                      })}
                    </h4>
                    <div className="flex-1 h-px bg-gray-200"></div>
                  </div>

                  <div className="space-y-3">
                    {dayActivities
                      .sort(
                        (a, b) => new Date(b.timestamp) - new Date(a.timestamp),
                      )
                      .map((activity) => (
                        <div
                          key={activity.id}
                          className="flex items-start gap-3 p-3 bg-white border border-gray-200 rounded-sm hover:shadow-sm transition-shadow"
                        >
                          <div
                            className={`flex items-center justify-center w-8 h-8 rounded-full text-white text-sm ${getCategoryColor(activity.category)}`}
                          >
                            {activity.icon}
                          </div>

                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-900">
                              {activity.description}
                            </p>

                            {activity.user && (
                              <p className="text-xs text-gray-500 mt-1">
                                by {activity.user.name || activity.user.email}
                              </p>
                            )}

                            <p className="text-xs text-gray-400 mt-1">
                              {new Date(activity.timestamp).toLocaleString(
                                "en-US",
                                {
                                  month: "short",
                                  day: "numeric",
                                  year: "numeric",
                                  hour: "2-digit",
                                  minute: "2-digit",
                                },
                              )}
                            </p>
                          </div>

                          <div className="text-xs text-gray-400 capitalize">
                            {activity.category}
                          </div>
                        </div>
                      ))}
                  </div>
                </div>
              ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default ActivityFeed;
