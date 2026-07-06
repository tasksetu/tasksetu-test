import { useQuery } from "@tanstack/react-query";
import {
  BarChart3,
  TrendingUp,
  TrendingDown,
  Activity,
  Clock,
  CheckCircle,
  Users,
  Calendar,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { StatsCard } from "@/components/admin/StatsCard";
// Note: Schema types removed for JavaScript compatibility
import { useTasks } from "@/hooks/useTasks";
import { formatRelativeTime, getInitials, formatDate } from "@/lib/utils";

export default function Analytics() {
  const { data: stats } = useQuery({
    queryKey: ["/api/dashboard/stats"],
  });

  const { data: activities } = useQuery({
    queryKey: ["/api/activities/recent"],
    queryFn: async () => {
      const response = await fetch("/api/activities/recent?limit=20", {
        credentials: "include",
      });
      if (!response.ok) throw new Error("Failed to fetch activities");
      return response.json();
    },
  });

  const { data: allTasks } = useTasks();

  // Calculate completion rate
  const completionRate = stats
    ? Math.round((stats.completedTasks / stats.totalTasks) * 100)
    : 0;

  // Calculate productivity metrics
  const productivityChange = "+12%"; // This would come from comparing with previous period
  const activeTasksChange = "+5%";
  const teamEfficiencyChange = "+8%";

  // Get recent completed tasks
  const recentCompletedTasks =
    allTasks?.filter((task) => task.status === "completed").slice(0, 5) || [];

  return (
    <div className="p-4 space-y-3">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">
            Analytics & Reports
          </h1>
          <p className="text-muted-foreground mt-2">
            Track performance metrics and team productivity
          </p>
        </div>
        <div className="flex items-center space-x-3">
          <Select defaultValue="7d">
            <SelectTrigger className="w-40">
              <SelectValue placeholder="Time range" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7d">Last 7 days</SelectItem>
              <SelectItem value="30d">Last 30 days</SelectItem>
              <SelectItem value="90d">Last 90 days</SelectItem>
              <SelectItem value="1y">Last year</SelectItem>
            </SelectContent>
          </Select>
          <Button>
            <BarChart3 className="w-4 h-4 mr-2" />
            Export Report
          </Button>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
        <StatsCard
          title="Task Completion Rate"
          value={`${completionRate}%`}
          change={productivityChange}
          trend="up"
          icon={CheckCircle}
          iconColor="text-emerald-600"
        />
        <StatsCard
          title="Average Response Time"
          value="2.4h"
          change="-15% faster"
          trend="up"
          icon={Clock}
          iconColor="text-blue-600"
        />
        <StatsCard
          title="Active Tasks"
          value={stats?.inProgressTasks || 0}
          change={activeTasksChange}
          trend="up"
          icon={Activity}
          iconColor="text-blue-600"
        />
        <StatsCard
          title="Team Efficiency"
          value="94%"
          change={teamEfficiencyChange}
          trend="up"
          icon={Users}
          iconColor="text-purple-600"
        />
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        {/* Task Completion Trend */}
        <Card className="admin-card">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-base font-medium">
              Task Completion Trend
            </CardTitle>
            <div className="flex items-center space-x-2">
              <Badge variant="outline" className="text-emerald-600">
                <TrendingUp className="w-3 h-3 mr-1" />
                +12%
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="h-64 bg-muted/20 rounded-sm flex items-center justify-center">
              <div className="text-center">
                <BarChart3 className="w-12 h-12 text-muted-foreground mx-auto mb-2" />
                <p className="text-muted-foreground">
                  Line chart showing task completion over time
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Integration with Chart.js or Recharts
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Team Performance */}
        <Card className="admin-card">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-base font-medium">
              Team Performance
            </CardTitle>
            <Button variant="ghost" size="sm" className="text-primary">
              View Details
            </Button>
          </CardHeader>
          <CardContent>
            <div className="h-64 bg-muted/20 rounded-sm flex items-center justify-center">
              <div className="text-center">
                <BarChart3 className="w-12 h-12 text-muted-foreground mx-auto mb-2" />
                <p className="text-muted-foreground">
                  Radar chart showing team performance metrics
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Speed, Quality, Collaboration, Innovation
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Detailed Analytics */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        {/* Recent Activity Feed */}
        <div className="lg:col-span-2">
          <Card className="admin-card">
            <CardHeader>
              <CardTitle className="text-base font-medium">
                Activity Timeline
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {activities?.map((activity) => (
                  <div
                    key={activity.id}
                    className="flex items-start space-x-3 p-3 rounded-sm hover:bg-muted/50 transition-colors"
                  >
                    <div className="w-2 h-2 bg-primary rounded-full mt-2" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-foreground">
                        {activity.description}
                      </p>
                      <div className="flex items-center space-x-2 mt-1">
                        <span className="text-xs text-muted-foreground">
                          {formatRelativeTime(activity.createdAt)}
                        </span>
                        <Badge variant="outline" className="text-xs">
                          {activity.type.replace("_", " ")}
                        </Badge>
                      </div>
                    </div>
                  </div>
                ))}
                {(!activities || activities.length === 0) && (
                  <div className="text-center py-8">
                    <Activity className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
                    <p className="text-muted-foreground">No recent activity</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Performance Summary */}
        <Card className="admin-card">
          <CardHeader>
            <CardTitle className="text-base font-medium">
              Recent Completions
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {recentCompletedTasks.map((task) => (
                <div key={task.id} className="flex items-start space-x-3">
                  <CheckCircle className="w-4 h-4 text-emerald-600 mt-1" />
                  <div className="flex-1 min-w-0">
                    <p
                      className="text-sm font-medium text-foreground truncate"
                      title={task.title}
                    >
                      {task.title}
                    </p>
                    <div className="flex items-center space-x-2 mt-1">
                      {task.assignee && (
                        <div className="flex items-center space-x-1">
                          <Avatar className="w-4 h-4">
                            <AvatarImage
                              src={task.assignee.avatar || undefined}
                            />
                            <AvatarFallback className="text-xs">
                              {getInitials(task.assignee.fullName)}
                            </AvatarFallback>
                          </Avatar>
                          <span className="text-xs text-muted-foreground">
                            {task.assignee.fullName}
                          </span>
                        </div>
                      )}
                      {task.completedAt && (
                        <span className="text-xs text-muted-foreground">
                          {formatRelativeTime(task.completedAt)}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
              {recentCompletedTasks.length === 0 && (
                <div className="text-center py-4">
                  <p className="text-sm text-muted-foreground">
                    No completed tasks
                  </p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Weekly Summary */}
      <Card className="admin-card">
        <CardHeader>
          <CardTitle className="text-base font-medium">
            Weekly Summary
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <div className="text-center">
              <div className="text-2xl font-bold text-foreground">
                {stats?.completedTasks || 0}
              </div>
              <div className="text-sm text-muted-foreground">
                Tasks Completed
              </div>
              <div className="flex items-center justify-center mt-1">
                <TrendingUp className="w-3 h-3 text-emerald-600 mr-1" />
                <span className="text-xs text-emerald-600">+15%</span>
              </div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-foreground">
                {stats?.inProgressTasks || 0}
              </div>
              <div className="text-sm text-muted-foreground">In Progress</div>
              <div className="flex items-center justify-center mt-1">
                <TrendingUp className="w-3 h-3 text-blue-600 mr-1" />
                <span className="text-xs text-blue-600">+8%</span>
              </div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-foreground">
                {stats?.activeUsers || 0}
              </div>
              <div className="text-sm text-muted-foreground">
                Active Members
              </div>
              <div className="flex items-center justify-center mt-1">
                <TrendingUp className="w-3 h-3 text-purple-600 mr-1" />
                <span className="text-xs text-purple-600">+3%</span>
              </div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-foreground">2.4h</div>
              <div className="text-sm text-muted-foreground">Avg Response</div>
              <div className="flex items-center justify-center mt-1">
                <TrendingDown className="w-3 h-3 text-emerald-600 mr-1" />
                <span className="text-xs text-emerald-600">-12%</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
