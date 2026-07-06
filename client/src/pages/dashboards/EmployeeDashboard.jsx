import { useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import {
  CheckCircle2,
  Clock,
  AlertCircle,
  User,
  Calendar,
  Target,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import ProfileWidget from "@/components/profile/ProfileWidget";

export default function EmployeeDashboard() {
  const [activeTab, setActiveTab] = useState("tasks");

  const { data: myTasks } = useQuery({
    queryKey: ["/api/employee/my-tasks"],
    enabled: true,
  });

  const { data: myStats } = useQuery({
    queryKey: ["/api/employee/my-stats"],
    enabled: true,
  });

  const { data: myProjects } = useQuery({
    queryKey: ["/api/employee/my-projects"],
    enabled: true,
  });

  const { data: notifications } = useQuery({
    queryKey: ["/api/employee/notifications"],
    enabled: true,
  });

  const getTaskPriorityColor = (priority) => {
    switch (priority) {
      case "high":
        return "bg-red-100 text-red-800";
      case "medium":
        return "bg-yellow-100 text-yellow-800";
      case "low":
        return "bg-green-100 text-green-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const getTaskStatusIcon = (status) => {
    switch (status) {
      case "completed":
        return <CheckCircle2 className="h-4 w-4 text-green-600" />;
      case "in_progress":
        return <Clock className="h-4 w-4 text-blue-600" />;
      default:
        return <AlertCircle className="h-4 w-4 text-gray-600" />;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="border-b bg-white dark:bg-gray-800">
        <div className="flex h-16 items-center px-6">
          <User className="h-6 w-6 text-green-600 mr-3" />
          <h1 className="text-xl font-semibold text-gray-900 dark:text-white">
            My Dashboard
          </h1>
          <Badge variant="outline" className="ml-3">
            Employee
          </Badge>
        </div>
      </div>

      <div className="p-4">
        <Tabs
          value={activeTab}
          onValueChange={setActiveTab}
          className="space-y-3"
        >
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="tasks">My Tasks</TabsTrigger>
            <TabsTrigger value="projects">Projects</TabsTrigger>
            <TabsTrigger value="progress">Progress</TabsTrigger>
            <TabsTrigger value="profile">Profile</TabsTrigger>
          </TabsList>

          <TabsContent value="tasks" className="space-y-3">
            <div className="grid gap-3 md:grid-cols-3">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">
                    Total Tasks
                  </CardTitle>
                  <Target className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {myStats?.totalTasks || 0}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {myStats?.newTasksThisWeek || 0} new this week
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">
                    Completed
                  </CardTitle>
                  <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {myStats?.completedTasks || 0}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {myStats?.completionRate || 0}% completion rate
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">
                    In Progress
                  </CardTitle>
                  <Clock className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {myStats?.inProgressTasks || 0}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {myStats?.overdueTasks || 0} overdue
                  </p>
                </CardContent>
              </Card>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle>Active Tasks</CardTitle>
                  <CardDescription>
                    Tasks currently assigned to you
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {myTasks
                      ?.filter((task) => task.status !== "completed")
                      .slice(0, 5)
                      .map((task) => (
                        <div
                          key={task._id}
                          className="flex items-center justify-between p-3 border rounded-sm"
                        >
                          <div className="flex items-center space-x-3">
                            {getTaskStatusIcon(task.status)}
                            <div>
                              <p className="text-sm font-medium">
                                {task.title}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                Due:{" "}
                                {task.dueDate
                                  ? new Date(task.dueDate).toLocaleDateString()
                                  : "No due date"}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center space-x-2">
                            <Badge
                              className={getTaskPriorityColor(task.priority)}
                            >
                              {task.priority || "medium"}
                            </Badge>
                            <Button variant="outline" size="sm">
                              View
                            </Button>
                          </div>
                        </div>
                      )) || (
                      <p className="text-sm text-muted-foreground text-center py-4">
                        No active tasks assigned
                      </p>
                    )}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Recent Notifications</CardTitle>
                  <CardDescription>Latest updates and messages</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {notifications?.slice(0, 5).map((notification, index) => (
                      <div
                        key={index}
                        className="flex items-start space-x-3 p-3 border rounded-sm"
                      >
                        <div className="w-2 h-2 bg-blue-600 rounded-full mt-2"></div>
                        <div className="flex-1">
                          <p className="text-sm font-medium">
                            {notification.title}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {notification.message}
                          </p>
                          <p className="text-xs text-muted-foreground mt-1">
                            {notification.createdAt}
                          </p>
                        </div>
                      </div>
                    )) || (
                      <p className="text-sm text-muted-foreground text-center py-4">
                        No recent notifications
                      </p>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Completed Tasks</CardTitle>
                <CardDescription>Recently completed work</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {myTasks
                    ?.filter((task) => task.status === "completed")
                    .slice(0, 3)
                    .map((task) => (
                      <div
                        key={task._id}
                        className="flex items-center justify-between p-3 border rounded-sm bg-green-50"
                      >
                        <div className="flex items-center space-x-3">
                          <CheckCircle2 className="h-4 w-4 text-green-600" />
                          <div>
                            <p className="text-sm font-medium">{task.title}</p>
                            <p className="text-xs text-muted-foreground">
                              Completed on{" "}
                              {task.completedAt
                                ? new Date(
                                    task.completedAt,
                                  ).toLocaleDateString()
                                : "Recently"}
                            </p>
                          </div>
                        </div>
                        <Badge
                          variant="outline"
                          className="bg-green-100 text-green-800"
                        >
                          Completed
                        </Badge>
                      </div>
                    )) || (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      No completed tasks yet
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="projects" className="space-y-3">
            <Card>
              <CardHeader>
                <CardTitle>My Projects</CardTitle>
                <CardDescription>Projects you're involved in</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid gap-3">
                  {myProjects?.map((project) => (
                    <Card key={project._id}>
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                          <div>
                            <h4 className="font-medium">{project.name}</h4>
                            <p className="text-sm text-muted-foreground">
                              {project.description}
                            </p>
                            <div className="flex items-center space-x-2 mt-2">
                              <Badge variant="outline">{project.status}</Badge>
                              <span className="text-xs text-muted-foreground">
                                {project.myTasksCount || 0} my tasks
                              </span>
                            </div>
                          </div>
                          <Button variant="outline" size="sm">
                            View Tasks
                          </Button>
                        </div>
                        {project.progress !== undefined && (
                          <div className="mt-3">
                            <div className="flex justify-between text-xs text-muted-foreground mb-1">
                              <span>Progress</span>
                              <span>{project.progress}%</span>
                            </div>
                            <Progress
                              value={project.progress}
                              className="h-2"
                            />
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  )) || (
                    <p className="text-center text-muted-foreground py-8">
                      You're not assigned to any projects yet
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="progress" className="space-y-3">
            <div className="grid gap-3 md:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle>Weekly Progress</CardTitle>
                  <CardDescription>Your performance this week</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-sm">Tasks Completed</span>
                    <span className="text-sm font-medium">
                      {myStats?.tasksCompletedThisWeek || 0}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm">On-time Completion</span>
                    <span className="text-sm font-medium">
                      {myStats?.onTimeCompletionRate || 0}%
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm">Average Response Time</span>
                    <span className="text-sm font-medium">
                      {myStats?.avgResponseTime || "N/A"}
                    </span>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Monthly Goals</CardTitle>
                  <CardDescription>
                    Track your monthly objectives
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div>
                    <div className="flex justify-between text-sm mb-2">
                      <span>Tasks Goal</span>
                      <span>
                        {myStats?.tasksCompletedThisMonth || 0} /{" "}
                        {myStats?.monthlyTaskGoal || 20}
                      </span>
                    </div>
                    <Progress
                      value={
                        ((myStats?.tasksCompletedThisMonth || 0) /
                          (myStats?.monthlyTaskGoal || 20)) *
                        100
                      }
                    />
                  </div>
                  <div>
                    <div className="flex justify-between text-sm mb-2">
                      <span>Quality Score</span>
                      <span>{myStats?.qualityScore || 85}%</span>
                    </div>
                    <Progress value={myStats?.qualityScore || 85} />
                  </div>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Achievement Badges</CardTitle>
                <CardDescription>
                  Milestones and accomplishments
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {myStats?.badges?.map((badge, index) => (
                    <div
                      key={index}
                      className="text-center p-4 border rounded-sm"
                    >
                      <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-2">
                        <span className="text-blue-600">{badge.icon}</span>
                      </div>
                      <p className="text-sm font-medium">{badge.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {badge.description}
                      </p>
                    </div>
                  )) || (
                    <p className="col-span-full text-center text-muted-foreground py-8">
                      Complete tasks to earn achievement badges
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="profile" className="space-y-3">
            <div className="grid gap-3 md:grid-cols-2">
              <ProfileWidget />

              <Card>
                <CardHeader>
                  <CardTitle>Preferences</CardTitle>
                  <CardDescription>Customize your experience</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <Button variant="outline" className="w-full">
                    Notification Settings
                  </Button>
                  <Button variant="outline" className="w-full">
                    Theme Preferences
                  </Button>
                  <Button variant="outline" className="w-full">
                    Language Settings
                  </Button>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
