import { useState } from "react";
import { usePlatformAnalytics } from "@/hooks/super-admin/useSuperAdmin";
import {
  Building2,
  Users,
  FolderOpen,
  FileText,
  TrendingUp,
  Activity,
  CheckCircle,
  Clock,
  AlertCircle,
  UserCheck,
  Mail,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatDate, formatRelativeTime } from "@/lib/utils";

export default function SuperAdminDashboard() {
  const { data: analytics, isLoading } = usePlatformAnalytics();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 p-7">
        <div className="animate-pulse space-y-3">
          <div className="space-y-3">
            <div className="h-10 bg-gradient-to-r from-gray-200 to-gray-300 rounded-xl w-1/3"></div>
            <div className="h-6 bg-gradient-to-r from-gray-100 to-gray-200 rounded-sm w-1/2"></div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
            {[...Array(4)].map((_, i) => (
              <div
                key={i}
                className="h-32 bg-white/60 backdrop-blur-sm rounded-2xl shadow-lg"
              ></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  const overview = analytics?.overview || {};
  const recentActivity = analytics?.recentActivity || { users: [], tasks: [] };
  const growth = analytics?.growth || [];

  const statCards = [
    {
      title: "Total Companies",
      value: overview.totalCompanies || 0,
      icon: Building2,
      color: "text-blue-600",
      bgColor: "bg-blue-50",
    },
    {
      title: "Total Users",
      value: overview.totalUsers || 0,
      icon: Users,
      color: "text-green-600",
      bgColor: "bg-green-50",
    },
    {
      title: "Total Projects",
      value: overview.totalProjects || 0,
      icon: FolderOpen,
      color: "text-purple-600",
      bgColor: "bg-purple-50",
    },
    {
      title: "Total Tasks",
      value: overview.totalTasks || 0,
      icon: FileText,
      color: "text-indigo-600",
      bgColor: "bg-indigo-50",
    },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 p-7">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-3">
          <div className="p-3 bg-gradient-to-br from-indigo-600 to-purple-600 rounded-2xl shadow-lg">
            <Activity className="h-7 w-7 text-white" />
          </div>
          <div>
            <h1 className="text-4xl font-bold bg-gradient-to-r from-gray-900 via-indigo-900 to-purple-900 bg-clip-text text-transparent">
              Platform Dashboard
            </h1>
            <p className="text-base text-gray-600 mt-1 flex items-center gap-2">
              <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
              Monitor and manage all companies and users across the platform
            </p>
          </div>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 mb-8">
        {statCards.map((stat, index) => {
          const Icon = stat.icon;
          return (
            <div
              key={stat.title}
              className="group relative bg-white/80 backdrop-blur-sm rounded-2xl border border-gray-200/50 p-4 shadow-lg hover:shadow-2xl transition-all duration-300 hover:-translate-y-1 overflow-hidden"
            >
              <div
                className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br opacity-5 rounded-full blur-2xl"
                style={{
                  background: `linear-gradient(135deg, ${stat.color.replace("text-", "")} 0%, transparent 100%)`,
                }}
              ></div>
              <div className="relative">
                <div className="flex items-center justify-between mb-3">
                  <div
                    className={`p-3 rounded-xl ${stat.bgColor} group-hover:scale-110 transition-transform duration-300`}
                  >
                    <Icon className={`h-6 w-6 ${stat.color}`} />
                  </div>
                  <div
                    className={`text-xs font-semibold ${stat.color} bg-white px-3 py-1 rounded-full border border-current/20`}
                  >
                    #{index + 1}
                  </div>
                </div>
                <div>
                  <p className="text-xs text-gray-500 uppercase tracking-wider font-semibold mb-2">
                    {stat.title}
                  </p>
                  <p className="text-4xl font-black text-gray-900 tracking-tight">
                    {stat.value.toLocaleString()}
                  </p>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 mb-8">
        {/* Recent Users */}
        <div className="bg-white/80 backdrop-blur-sm rounded-2xl border border-gray-200/50 p-4 shadow-lg hover:shadow-2xl transition-all duration-300">
          <div className="flex items-center gap-3 mb-3 pb-4 border-b border-gray-100">
            <div className="p-2.5 bg-gradient-to-br from-green-500 to-emerald-600 rounded-xl shadow-md">
              <Users className="h-5 w-5 text-white" />
            </div>
            <div>
              <h3 className="text-xl font-bold text-gray-900">Recent Users</h3>
              <p className="text-xs text-gray-500">Latest registrations</p>
            </div>
          </div>
          <div className="space-y-2">
            {recentActivity.users.slice(0, 5).map((user, index) => (
              <div
                key={user._id}
                className="group flex items-center justify-between p-4 rounded-xl bg-gradient-to-r from-gray-50 to-green-50/30 hover:from-green-50 hover:to-emerald-50 transition-all duration-200 border border-transparent hover:border-green-200"
              >
                <div className="flex items-center gap-3">
                  <div className="flex-shrink-0 w-10 h-10 bg-gradient-to-br from-green-400 to-emerald-500 rounded-full flex items-center justify-center text-white font-bold shadow-md">
                    {user.firstName?.charAt(0)}
                    {user.lastName?.charAt(0)}
                  </div>
                  <div>
                    <p className="font-semibold text-gray-900 group-hover:text-green-700 transition-colors">
                      {user.firstName} {user.lastName}
                    </p>
                    <p className="text-sm text-gray-500 flex items-center gap-1">
                      <Mail className="h-3 w-3" />
                      {user.email}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-xs font-medium text-gray-400 bg-white px-2 py-1 rounded-sm border border-gray-200">
                    {new Date(user.createdAt).toLocaleDateString()}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Recent Tasks */}
        <div className="bg-white/80 backdrop-blur-sm rounded-2xl border border-gray-200/50 p-4 shadow-lg hover:shadow-2xl transition-all duration-300">
          <div className="flex items-center gap-3 mb-3 pb-4 border-b border-gray-100">
            <div className="p-2.5 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-xl shadow-md">
              <FileText className="h-5 w-5 text-white" />
            </div>
            <div>
              <h3 className="text-xl font-bold text-gray-900">Recent Tasks</h3>
              <p className="text-xs text-gray-500">Latest activities</p>
            </div>
          </div>
          <div className="space-y-2">
            {recentActivity.tasks.slice(0, 5).map((task, index) => (
              <div
                key={task._id}
                className="group flex items-center justify-between p-4 rounded-xl bg-gradient-to-r from-gray-50 to-purple-50/30 hover:from-purple-50 hover:to-indigo-50 transition-all duration-200 border border-transparent hover:border-purple-200"
              >
                <div className="flex items-center gap-3">
                  <div className="flex-shrink-0 w-10 h-10 bg-gradient-to-br from-purple-400 to-indigo-500 rounded-full flex items-center justify-center shadow-md">
                    <CheckCircle className="h-5 w-5 text-white" />
                  </div>
                  <div>
                    <p className="font-semibold text-gray-900 group-hover:text-purple-700 transition-colors">
                      {task.title}
                    </p>
                    <p className="text-sm text-gray-500 flex items-center gap-1">
                      Priority:{" "}
                      <span
                        className={`font-medium ${task.priority === "high" ? "text-red-600" : task.priority === "medium" ? "text-orange-600" : "text-blue-600"}`}
                      >
                        {task.priority}
                      </span>
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-xs font-medium text-gray-400 bg-white px-2 py-1 rounded-sm border border-gray-200">
                    {new Date(task.createdAt).toLocaleDateString()}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Company Growth Chart */}
      <div className="bg-white/80 backdrop-blur-sm rounded-2xl border border-gray-200/50 p-4 shadow-lg hover:shadow-2xl transition-all duration-300 mb-8">
        <div className="flex items-center gap-3 mb-3 pb-4 border-b border-gray-100">
          <div className="p-2.5 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl shadow-md">
            <TrendingUp className="h-5 w-5 text-white" />
          </div>
          <div>
            <h3 className="text-xl font-bold text-gray-900">Company Growth</h3>
            <p className="text-xs text-gray-500">Monthly registration trends</p>
          </div>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          {growth.slice(-6).map((period, index) => (
            <div
              key={index}
              className="group relative text-center p-5 rounded-xl bg-gradient-to-br from-blue-50 to-indigo-50 hover:from-blue-100 hover:to-indigo-100 transition-all duration-300 border border-blue-200/50 hover:border-blue-300 hover:shadow-lg"
            >
              <div className="absolute inset-0 bg-gradient-to-br from-blue-400/10 to-indigo-400/10 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity"></div>
              <div className="relative">
                <p className="text-xs font-semibold text-blue-600 mb-2 uppercase tracking-wider">
                  {period._id.year}-{String(period._id.month).padStart(2, "0")}
                </p>
                <p className="text-3xl font-black text-gray-900 mb-1">
                  {period.count}
                </p>
                <p className="text-xs text-gray-600 font-medium">companies</p>
                <div className="mt-2 w-full h-1 bg-gradient-to-r from-blue-400 to-indigo-500 rounded-full opacity-70"></div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Quick Actions */}
      <div className="bg-white/80 backdrop-blur-sm rounded-2xl border border-gray-200/50 p-4 shadow-lg">
        <div className="flex items-center gap-3 mb-3 pb-4 border-b border-gray-100">
          <div className="p-2.5 bg-gradient-to-br from-orange-500 to-pink-600 rounded-xl shadow-md">
            <Activity className="h-5 w-5 text-white" />
          </div>
          <div>
            <h3 className="text-xl font-bold text-gray-900">Quick Actions</h3>
            <p className="text-xs text-gray-500">Navigate to key sections</p>
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <button
            onClick={() => (window.location.href = "/super-admin/companies")}
            className="group relative p-4 text-left rounded-xl bg-gradient-to-br from-blue-50 to-cyan-50 hover:from-blue-100 hover:to-cyan-100 border border-blue-200/50 hover:border-blue-400 transition-all duration-300 hover:shadow-xl hover:-translate-y-1 overflow-hidden"
          >
            <div className="absolute top-0 right-0 w-20 h-20 bg-blue-400/10 rounded-full blur-2xl group-hover:bg-blue-400/20 transition-all"></div>
            <div className="relative">
              <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-cyan-600 rounded-xl flex items-center justify-center mb-3 group-hover:scale-110 transition-transform shadow-lg">
                <Building2 className="h-6 w-6 text-white" />
              </div>
              <p className="text-base font-bold text-gray-900 mb-1">
                Manage Companies
              </p>
              <p className="text-xs text-gray-600">
                View and control all companies
              </p>
            </div>
          </button>

          <button
            onClick={() => (window.location.href = "/super-admin/users")}
            className="group relative p-4 text-left rounded-xl bg-gradient-to-br from-green-50 to-emerald-50 hover:from-green-100 hover:to-emerald-100 border border-green-200/50 hover:border-green-400 transition-all duration-300 hover:shadow-xl hover:-translate-y-1 overflow-hidden"
          >
            <div className="absolute top-0 right-0 w-20 h-20 bg-green-400/10 rounded-full blur-2xl group-hover:bg-green-400/20 transition-all"></div>
            <div className="relative">
              <div className="w-12 h-12 bg-gradient-to-br from-green-500 to-emerald-600 rounded-xl flex items-center justify-center mb-3 group-hover:scale-110 transition-transform shadow-lg">
                <Users className="h-6 w-6 text-white" />
              </div>
              <p className="text-base font-bold text-gray-900 mb-1">
                Manage Users
              </p>
              <p className="text-xs text-gray-600">
                View all users across companies
              </p>
            </div>
          </button>

          <button
            onClick={() => (window.location.href = "/super-admin/logs")}
            className="group relative p-4 text-left rounded-xl bg-gradient-to-br from-purple-50 to-fuchsia-50 hover:from-purple-100 hover:to-fuchsia-100 border border-purple-200/50 hover:border-purple-400 transition-all duration-300 hover:shadow-xl hover:-translate-y-1 overflow-hidden"
          >
            <div className="absolute top-0 right-0 w-20 h-20 bg-purple-400/10 rounded-full blur-2xl group-hover:bg-purple-400/20 transition-all"></div>
            <div className="relative">
              <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-fuchsia-600 rounded-xl flex items-center justify-center mb-3 group-hover:scale-110 transition-transform shadow-lg">
                <FileText className="h-6 w-6 text-white" />
              </div>
              <p className="text-base font-bold text-gray-900 mb-1">
                System Logs
              </p>
              <p className="text-xs text-gray-600">Monitor system activity</p>
            </div>
          </button>

          <button
            onClick={() => (window.location.href = "/super-admin/admins")}
            className="group relative p-4 text-left rounded-xl bg-gradient-to-br from-indigo-50 to-violet-50 hover:from-indigo-100 hover:to-violet-100 border border-indigo-200/50 hover:border-indigo-400 transition-all duration-300 hover:shadow-xl hover:-translate-y-1 overflow-hidden"
          >
            <div className="absolute top-0 right-0 w-20 h-20 bg-indigo-400/10 rounded-full blur-2xl group-hover:bg-indigo-400/20 transition-all"></div>
            <div className="relative">
              <div className="w-12 h-12 bg-gradient-to-br from-indigo-500 to-violet-600 rounded-xl flex items-center justify-center mb-3 group-hover:scale-110 transition-transform shadow-lg">
                <Activity className="h-6 w-6 text-white" />
              </div>
              <p className="text-base font-bold text-gray-900 mb-1">
                Admin Management
              </p>
              <p className="text-xs text-gray-600">Manage super admins</p>
            </div>
          </button>
        </div>
      </div>
    </div>
  );
}
