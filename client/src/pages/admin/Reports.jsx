import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  Legend,
} from "recharts";
import {
  BarChart3,
  Users,
  FileText,
  Calendar,
  Download,
  Filter,
  TrendingUp,
  Clock,
  CheckCircle,
  AlertCircle,
  PieChart as PieChartIcon,
  Activity,
  Target,
  ArrowUpRight,
  ArrowDownRight,
} from "lucide-react";

const COLORS = [
  "#3B82F6",
  "#10B981",
  "#F59E0B",
  "#EF4444",
  "#8B5CF6",
  "#06B6D4",
];

export default function Reports() {
  const [dateRange, setDateRange] = useState({
    startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
      .toISOString()
      .split("T")[0],
    endDate: new Date().toISOString().split("T")[0],
  });
  const [selectedUser, setSelectedUser] = useState("all");
  const [selectedProject, setSelectedProject] = useState("all");
  const [selectedStatus, setSelectedStatus] = useState("all");
  const [selectedDepartment, setSelectedDepartment] = useState("all");

  // Fetch report data
  const {
    data: reportData = {},
    isLoading,
    error,
  } = useQuery({
    queryKey: [
      "/api/reports",
      dateRange,
      selectedUser,
      selectedProject,
      selectedStatus,
      selectedDepartment,
    ],
    queryFn: async () => {
      const params = new URLSearchParams({
        startDate: dateRange.startDate,
        endDate: dateRange.endDate,
        userId: selectedUser !== "all" ? selectedUser : "",
        projectId: selectedProject !== "all" ? selectedProject : "",
        status: selectedStatus !== "all" ? selectedStatus : "",
        department: selectedDepartment !== "all" ? selectedDepartment : "",
      });

      const response = await fetch(`/api/reports?${params}`);
      if (!response.ok) throw new Error("Failed to fetch report data");
      return response.json();
    },
  });

  // Fetch filter options
  const { data: filterOptions = {} } = useQuery({
    queryKey: ["/api/reports/filters"],
    queryFn: async () => {
      const response = await fetch("/api/reports/filters");
      if (!response.ok) throw new Error("Failed to fetch filter options");
      return response.json();
    },
  });

  const handleExportPDF = async () => {
    try {
      const params = new URLSearchParams({
        format: "pdf",
        startDate: dateRange.startDate,
        endDate: dateRange.endDate,
        userId: selectedUser !== "all" ? selectedUser : "",
        projectId: selectedProject !== "all" ? selectedProject : "",
        status: selectedStatus !== "all" ? selectedStatus : "",
        department: selectedDepartment !== "all" ? selectedDepartment : "",
      });

      const response = await fetch(`/api/reports/export?${params}`);
      if (!response.ok) throw new Error("Failed to export PDF");

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `user-reports-${dateRange.startDate}-to-${dateRange.endDate}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error("Export PDF error:", error);
    }
  };

  const handleExportCSV = async () => {
    try {
      const params = new URLSearchParams({
        format: "csv",
        startDate: dateRange.startDate,
        endDate: dateRange.endDate,
        userId: selectedUser !== "all" ? selectedUser : "",
        projectId: selectedProject !== "all" ? selectedProject : "",
        status: selectedStatus !== "all" ? selectedStatus : "",
        department: selectedDepartment !== "all" ? selectedDepartment : "",
      });

      const response = await fetch(`/api/reports/export?${params}`);
      if (!response.ok) throw new Error("Failed to export CSV");

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `user-reports-${dateRange.startDate}-to-${dateRange.endDate}.csv`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error("Export CSV error:", error);
    }
  };

  const getProgressColor = (percentage) => {
    if (percentage >= 80) return "text-green-600";
    if (percentage >= 60) return "text-blue-600";
    if (percentage >= 40) return "text-blue-600";
    return "text-red-600";
  };

  const getProgressBadge = (percentage) => {
    if (percentage >= 80) return "bg-green-100 text-green-700 border-green-200";
    if (percentage >= 60) return "bg-blue-100 text-blue-700 border-blue-200";
    if (percentage >= 40) return "bg-blue-100 text-blue-700 border-blue-200";
    return "bg-red-100 text-red-700 border-red-200";
  };

  if (error) {
    return (
      <div className="p-7 space-y-3 bg-slate-50 dark:bg-slate-900 min-h-screen">
        <div className="flex flex-col items-center justify-center py-12">
          <AlertCircle className="h-12 w-12 text-red-500 mb-3" />
          <h3 className="text-lg font-medium text-slate-900 dark:text-white mb-2">
            Failed to load reports
          </h3>
          <p className="text-slate-600 dark:text-slate-400 text-center">
            {error.message}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-7 space-y-3 bg-slate-50 dark:bg-slate-900 min-h-screen">
      {/* Header */}
      <div className="flex items-center justify-between bg-white dark:bg-slate-800 p-4 rounded-sm border border-slate-200 dark:border-slate-700 shadow-sm">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white">
            User Reports
          </h1>
          <p className="text-slate-600 dark:text-slate-300 mt-2">
            Track user performance and project progress with detailed analytics
          </p>
        </div>
        <div className="flex items-center space-x-3">
          <Button
            variant="outline"
            size="sm"
            onClick={handleExportCSV}
            className="border-slate-300 text-slate-700 hover:bg-slate-100"
          >
            <Download className="h-4 w-4 mr-2" />
            Export CSV
          </Button>
          <Button
            size="sm"
            onClick={handleExportPDF}
            className="bg-blue-600 hover:bg-blue-700 text-white"
          >
            <Download className="h-4 w-4 mr-2" />
            Export PDF
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card className="border-slate-200 dark:border-slate-700 shadow-sm bg-white dark:bg-slate-800">
        <CardHeader className="pb-4">
          <CardTitle className="text-lg font-semibold text-slate-900 dark:text-white flex items-center">
            <Filter className="h-5 w-5 mr-2 text-blue-600" />
            Report Filters
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-3">
            <div className="space-y-2">
              <Label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                Start Date
              </Label>
              <Input
                type="date"
                value={dateRange.startDate}
                onChange={(e) =>
                  setDateRange((prev) => ({
                    ...prev,
                    startDate: e.target.value,
                  }))
                }
                className="border-slate-300 focus:border-blue-500"
              />
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                End Date
              </Label>
              <Input
                type="date"
                value={dateRange.endDate}
                onChange={(e) =>
                  setDateRange((prev) => ({ ...prev, endDate: e.target.value }))
                }
                className="border-slate-300 focus:border-blue-500"
              />
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                User
              </Label>
              <Select value={selectedUser} onValueChange={setSelectedUser}>
                <SelectTrigger className="border-slate-300 focus:border-blue-500">
                  <SelectValue placeholder="All Users" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Users</SelectItem>
                  {filterOptions.users?.map((user) => (
                    <SelectItem key={user._id} value={user._id}>
                      {user.firstName} {user.lastName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                Project
              </Label>
              <Select
                value={selectedProject}
                onValueChange={setSelectedProject}
              >
                <SelectTrigger className="border-slate-300 focus:border-blue-500">
                  <SelectValue placeholder="All Projects" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Projects</SelectItem>
                  {filterOptions.projects?.map((project) => (
                    <SelectItem key={project._id} value={project._id}>
                      {project.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                Status
              </Label>
              <Select value={selectedStatus} onValueChange={setSelectedStatus}>
                <SelectTrigger className="border-slate-300 focus:border-blue-500">
                  <SelectValue placeholder="All Statuses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="todo">To Do</SelectItem>
                  <SelectItem value="in-progress">In Progress</SelectItem>
                  <SelectItem value="review">Review</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                Department
              </Label>
              <Select
                value={selectedDepartment}
                onValueChange={setSelectedDepartment}
              >
                <SelectTrigger className="border-slate-300 focus:border-blue-500">
                  <SelectValue placeholder="All Departments" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Departments</SelectItem>
                  {filterOptions.departments?.map((dept) => (
                    <SelectItem key={dept} value={dept}>
                      {dept}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
        <Card className="border-slate-200 dark:border-slate-700 shadow-sm bg-white dark:bg-slate-800">
          <CardContent className="p-4">
            <div className="flex items-center space-x-3">
              <div className="p-3 rounded-sm bg-blue-50">
                <Users className="h-6 w-6 text-blue-600" />
              </div>
              <div>
                <p className="text-sm font-medium text-slate-600 dark:text-slate-400">
                  Total Users
                </p>
                <p className="text-2xl font-bold text-slate-900 dark:text-white">
                  {reportData.summary?.totalUsers || 0}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-slate-200 dark:border-slate-700 shadow-sm bg-white dark:bg-slate-800">
          <CardContent className="p-4">
            <div className="flex items-center space-x-3">
              <div className="p-3 rounded-sm bg-green-50">
                <FileText className="h-6 w-6 text-green-600" />
              </div>
              <div>
                <p className="text-sm font-medium text-slate-600 dark:text-slate-400">
                  Total Tasks
                </p>
                <p className="text-2xl font-bold text-slate-900 dark:text-white">
                  {reportData.summary?.totalTasks || 0}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-slate-200 dark:border-slate-700 shadow-sm bg-white dark:bg-slate-800">
          <CardContent className="p-4">
            <div className="flex items-center space-x-3">
              <div className="p-3 rounded-sm bg-blue-50">
                <Clock className="h-6 w-6 text-blue-600" />
              </div>
              <div>
                <p className="text-sm font-medium text-slate-600 dark:text-slate-400">
                  Avg Completion
                </p>
                <p className="text-2xl font-bold text-slate-900 dark:text-white">
                  {reportData.summary?.avgCompletion || 0}%
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-slate-200 dark:border-slate-700 shadow-sm bg-white dark:bg-slate-800">
          <CardContent className="p-4">
            <div className="flex items-center space-x-3">
              <div className="p-3 rounded-sm bg-purple-50">
                <Target className="h-6 w-6 text-purple-600" />
              </div>
              <div>
                <p className="text-sm font-medium text-slate-600 dark:text-slate-400">
                  Overdue Tasks
                </p>
                <p className="text-2xl font-bold text-slate-900 dark:text-white">
                  {reportData.summary?.overdueTasks || 0}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts and Data */}
      <Tabs defaultValue="overview" className="space-y-3">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="performance">Performance</TabsTrigger>
          <TabsTrigger value="trends">Trends</TabsTrigger>
          <TabsTrigger value="details">Details</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-3">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            <Card className="border-slate-200 dark:border-slate-700 shadow-sm bg-white dark:bg-slate-800">
              <CardHeader>
                <CardTitle className="text-lg font-semibold text-slate-900 dark:text-white flex items-center">
                  <BarChart3 className="h-5 w-5 mr-2 text-blue-600" />
                  Tasks by User
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={reportData.userTaskData || []}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="userName" />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="totalTasks" fill="#3B82F6" />
                    <Bar dataKey="completedTasks" fill="#10B981" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card className="border-slate-200 dark:border-slate-700 shadow-sm bg-white dark:bg-slate-800">
              <CardHeader>
                <CardTitle className="text-lg font-semibold text-slate-900 dark:text-white flex items-center">
                  <PieChartIcon className="h-5 w-5 mr-2 text-green-600" />
                  Task Status Distribution
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={reportData.statusDistribution || []}
                      cx="50%"
                      cy="50%"
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="value"
                      label={({ name, percent }) =>
                        `${name} ${(percent * 100).toFixed(0)}%`
                      }
                    >
                      {(reportData.statusDistribution || []).map(
                        (entry, index) => (
                          <Cell
                            key={`cell-${index}`}
                            fill={COLORS[index % COLORS.length]}
                          />
                        ),
                      )}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="performance" className="space-y-3">
          <Card className="border-slate-200 dark:border-slate-700 shadow-sm bg-white dark:bg-slate-800">
            <CardHeader>
              <CardTitle className="text-lg font-semibold text-slate-900 dark:text-white flex items-center">
                <Activity className="h-5 w-5 mr-2 text-purple-600" />
                User Performance Metrics
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="border-slate-200 dark:border-slate-700">
                      <TableHead className="font-semibold text-slate-700 dark:text-slate-300">
                        User
                      </TableHead>
                      <TableHead className="font-semibold text-slate-700 dark:text-slate-300">
                        Total Tasks
                      </TableHead>
                      <TableHead className="font-semibold text-slate-700 dark:text-slate-300">
                        Completed
                      </TableHead>
                      <TableHead className="font-semibold text-slate-700 dark:text-slate-300">
                        In Progress
                      </TableHead>
                      <TableHead className="font-semibold text-slate-700 dark:text-slate-300">
                        Overdue
                      </TableHead>
                      <TableHead className="font-semibold text-slate-700 dark:text-slate-300">
                        Progress
                      </TableHead>
                      <TableHead className="font-semibold text-slate-700 dark:text-slate-300">
                        Hours Logged
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {isLoading ? (
                      Array.from({ length: 5 }).map((_, index) => (
                        <TableRow
                          key={index}
                          className="border-slate-200 dark:border-slate-700"
                        >
                          <TableCell>
                            <div className="h-4 bg-slate-200 rounded animate-pulse w-24"></div>
                          </TableCell>
                          <TableCell>
                            <div className="h-4 bg-slate-200 rounded animate-pulse w-16"></div>
                          </TableCell>
                          <TableCell>
                            <div className="h-4 bg-slate-200 rounded animate-pulse w-16"></div>
                          </TableCell>
                          <TableCell>
                            <div className="h-4 bg-slate-200 rounded animate-pulse w-16"></div>
                          </TableCell>
                          <TableCell>
                            <div className="h-4 bg-slate-200 rounded animate-pulse w-16"></div>
                          </TableCell>
                          <TableCell>
                            <div className="h-6 bg-slate-200 rounded animate-pulse w-20"></div>
                          </TableCell>
                          <TableCell>
                            <div className="h-4 bg-slate-200 rounded animate-pulse w-16"></div>
                          </TableCell>
                        </TableRow>
                      ))
                    ) : (reportData.userPerformance || []).length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center py-8">
                          <div className="flex flex-col items-center space-y-3">
                            <BarChart3 className="h-8 w-8 text-slate-400" />
                            <p className="text-slate-500 dark:text-slate-400">
                              No performance data available for the selected
                              filters
                            </p>
                          </div>
                        </TableCell>
                      </TableRow>
                    ) : (
                      (reportData.userPerformance || []).map((user) => (
                        <TableRow
                          key={user.userId}
                          className="border-slate-200 dark:border-slate-700 hover:bg-blue-50 dark:hover:bg-blue-900/20 bg-white dark:bg-slate-800"
                        >
                          <TableCell className="font-medium text-slate-900 dark:text-white">
                            <div className="flex items-center space-x-2">
                              <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center">
                                <span className="text-xs font-semibold text-blue-600">
                                  {user.userName
                                    ?.split(" ")
                                    .map((n) => n[0])
                                    .join("")
                                    .toUpperCase()}
                                </span>
                              </div>
                              <span>{user.userName}</span>
                            </div>
                          </TableCell>
                          <TableCell className="text-slate-600 dark:text-slate-300">
                            {user.totalTasks}
                          </TableCell>
                          <TableCell className="text-slate-600 dark:text-slate-300">
                            <div className="flex items-center space-x-2">
                              <CheckCircle className="h-4 w-4 text-green-600" />
                              <span>{user.completedTasks}</span>
                            </div>
                          </TableCell>
                          <TableCell className="text-slate-600 dark:text-slate-300">
                            <div className="flex items-center space-x-2">
                              <Clock className="h-4 w-4 text-blue-600" />
                              <span>{user.inProgressTasks}</span>
                            </div>
                          </TableCell>
                          <TableCell className="text-slate-600 dark:text-slate-300">
                            <div className="flex items-center space-x-2">
                              <AlertCircle className="h-4 w-4 text-red-600" />
                              <span>{user.overdueTasks}</span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge
                              className={`${getProgressBadge(user.progressPercentage)} border-0`}
                            >
                              {user.progressPercentage}%
                            </Badge>
                          </TableCell>
                          <TableCell className="text-slate-600 dark:text-slate-300">
                            {user.hoursLogged || 0}h
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="trends" className="space-y-3">
          <Card className="border-slate-200 dark:border-slate-700 shadow-sm bg-white dark:bg-slate-800">
            <CardHeader>
              <CardTitle className="text-lg font-semibold text-slate-900 dark:text-white flex items-center">
                <TrendingUp className="h-5 w-5 mr-2 text-green-600" />
                Task Completion Trends
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={400}>
                <LineChart data={reportData.trendData || []}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Line
                    type="monotone"
                    dataKey="completed"
                    stroke="#10B981"
                    name="Completed"
                  />
                  <Line
                    type="monotone"
                    dataKey="created"
                    stroke="#3B82F6"
                    name="Created"
                  />
                  <Line
                    type="monotone"
                    dataKey="overdue"
                    stroke="#EF4444"
                    name="Overdue"
                  />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="details" className="space-y-3">
          <Card className="border-slate-200 dark:border-slate-700 shadow-sm bg-white dark:bg-slate-800">
            <CardHeader>
              <CardTitle className="text-lg font-semibold text-slate-900 dark:text-white flex items-center">
                <FileText className="h-5 w-5 mr-2 text-blue-600" />
                Detailed Task Breakdown
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="border-slate-200 dark:border-slate-700">
                      <TableHead className="font-semibold text-slate-700 dark:text-slate-300">
                        Task
                      </TableHead>
                      <TableHead className="font-semibold text-slate-700 dark:text-slate-300">
                        Assigned To
                      </TableHead>
                      <TableHead className="font-semibold text-slate-700 dark:text-slate-300">
                        Project
                      </TableHead>
                      <TableHead className="font-semibold text-slate-700 dark:text-slate-300">
                        Status
                      </TableHead>
                      <TableHead className="font-semibold text-slate-700 dark:text-slate-300">
                        Priority
                      </TableHead>
                      <TableHead className="font-semibold text-slate-700 dark:text-slate-300">
                        Due Date
                      </TableHead>
                      <TableHead className="font-semibold text-slate-700 dark:text-slate-300">
                        Progress
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {isLoading ? (
                      Array.from({ length: 10 }).map((_, index) => (
                        <TableRow
                          key={index}
                          className="border-slate-200 dark:border-slate-700"
                        >
                          <TableCell>
                            <div className="h-4 bg-slate-200 rounded animate-pulse w-32"></div>
                          </TableCell>
                          <TableCell>
                            <div className="h-4 bg-slate-200 rounded animate-pulse w-24"></div>
                          </TableCell>
                          <TableCell>
                            <div className="h-4 bg-slate-200 rounded animate-pulse w-20"></div>
                          </TableCell>
                          <TableCell>
                            <div className="h-6 bg-slate-200 rounded animate-pulse w-16"></div>
                          </TableCell>
                          <TableCell>
                            <div className="h-6 bg-slate-200 rounded animate-pulse w-16"></div>
                          </TableCell>
                          <TableCell>
                            <div className="h-4 bg-slate-200 rounded animate-pulse w-20"></div>
                          </TableCell>
                          <TableCell>
                            <div className="h-6 bg-slate-200 rounded animate-pulse w-16"></div>
                          </TableCell>
                        </TableRow>
                      ))
                    ) : (reportData.taskDetails || []).length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center py-8">
                          <div className="flex flex-col items-center space-y-3">
                            <FileText className="h-8 w-8 text-slate-400" />
                            <p className="text-slate-500 dark:text-slate-400">
                              No task details available for the selected filters
                            </p>
                          </div>
                        </TableCell>
                      </TableRow>
                    ) : (
                      (reportData.taskDetails || []).map((task) => (
                        <TableRow
                          key={task._id}
                          className="hover:bg-blue-50 dark:hover:bg-blue-900/20 bg-white dark:bg-slate-800"
                        >
                          <TableCell
                            className="font-medium text-slate-900 dark:text-white max-w-xs truncate"
                            title={task.title}
                          >
                            {task.title}
                          </TableCell>
                          <TableCell className="text-slate-600 dark:text-slate-300">
                            {task.assignedTo?.firstName}{" "}
                            {task.assignedTo?.lastName}
                          </TableCell>
                          <TableCell className="text-slate-600 dark:text-slate-300">
                            {task.project?.name || "No Project"}
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant="outline"
                              className={`status-${task.status}`}
                            >
                              {task.status?.replace("-", " ").toUpperCase()}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant="outline"
                              className={`priority-${task.priority}`}
                            >
                              {task.priority?.toUpperCase()}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-slate-600 dark:text-slate-300">
                            {task.dueDate
                              ? new Date(task.dueDate).toLocaleDateString()
                              : "No due date"}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center space-x-2">
                              <div className="w-full bg-slate-200 rounded-full h-2">
                                <div
                                  className="bg-blue-600 h-2 rounded-full"
                                  style={{ width: `${task.progress || 0}%` }}
                                ></div>
                              </div>
                              <span className="text-xs text-slate-600 dark:text-slate-400 min-w-max">
                                {task.progress || 0}%
                              </span>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
