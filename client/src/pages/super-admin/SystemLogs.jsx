import { useState } from "react";
import { useSystemLogs } from "@/hooks/super-admin/useSuperAdmin";
import {
  FileText,
  Activity,
  User,
  Calendar,
  Building2,
  Search,
  Download,
} from "lucide-react";
import { Button } from "@/components/ui/button";

export default function SystemLogs() {
  const [limit, setLimit] = useState(100);
  const { data: logs, isLoading } = useSystemLogs(limit);
  const [searchTerm, setSearchTerm] = useState("");
  const [actionFilter, setActionFilter] = useState("all");

  const filteredLogs =
    logs?.filter((log) => {
      const matchesSearch =
        log.action?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        log.userId?.firstName
          ?.toLowerCase()
          .includes(searchTerm.toLowerCase()) ||
        log.userId?.lastName
          ?.toLowerCase()
          .includes(searchTerm.toLowerCase()) ||
        log.taskId?.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        log.organizationId?.name
          ?.toLowerCase()
          .includes(searchTerm.toLowerCase());

      const matchesAction =
        actionFilter === "all" || log.action === actionFilter;

      return matchesSearch && matchesAction;
    }) || [];

  const getActionBadge = (action) => {
    const styles = {
      create: "bg-green-100 text-green-800",
      update: "bg-blue-100 text-blue-800",
      delete: "bg-red-100 text-red-800",
      login: "bg-purple-100 text-purple-800",
      logout: "bg-gray-100 text-gray-800",
    };
    return styles[action] || "bg-gray-100 text-gray-800";
  };

  const exportLogs = () => {
    const csvData = [
      ["Timestamp", "User", "Company", "Action", "Target", "Details"].join(","),
      ...filteredLogs.map((log) =>
        [
          new Date(log.createdAt).toLocaleString(),
          `"${log.userId?.firstName || ""} ${log.userId?.lastName || ""}"`,
          `"${log.organizationId?.name || "N/A"}"`,
          log.action || "N/A",
          `"${log.taskId?.title || "N/A"}"`,
          `"${log.details || "N/A"}"`,
        ].join(","),
      ),
    ].join("\n");

    const blob = new Blob([csvData], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `system-logs-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  if (isLoading) {
    return (
      <div className="p-4">
        <div className="animate-pulse space-y-3">
          <div className="h-8 bg-gray-200 rounded w-1/3"></div>
          <div className="h-64 bg-gray-200 rounded"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-3">
      {/* Header */}
      <div className="border-b border-gray-200 pb-4">
        <h1 className="text-2xl font-bold text-gray-900">System Logs</h1>
        <p className="text-sm text-gray-600 mt-1">
          Monitor system activity and audit trail across all companies
        </p>
      </div>

      {/* Filters and Controls */}
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <div className="flex flex-col sm:flex-row gap-3 items-center justify-between">
          <div className="flex flex-col sm:flex-row gap-3 flex-1">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search logs..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-3 h-9 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <select
              value={actionFilter}
              onChange={(e) => setActionFilter(e.target.value)}
              className="px-3 h-9 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="all">All Actions</option>
              <option value="create">Create</option>
              <option value="update">Update</option>
              <option value="delete">Delete</option>
              <option value="login">Login</option>
              <option value="logout">Logout</option>
            </select>
            <select
              value={limit}
              onChange={(e) => setLimit(Number(e.target.value))}
              className="px-3 h-9 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value={50}>Last 50</option>
              <option value={100}>Last 100</option>
              <option value={500}>Last 500</option>
              <option value={1000}>Last 1000</option>
            </select>
          </div>
          <Button variant="gradient" onClick={exportLogs}>
            <Download className="h-4 w-4 mr-2" />
            Export CSV
          </Button>
        </div>
      </div>

      {/* Logs Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Timestamp
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  User
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Company
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Action
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Target
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Details
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filteredLogs.map((log) => (
                <tr key={log._id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2 text-sm text-gray-900">
                      <Calendar className="h-4 w-4 text-gray-400" />
                      <div>
                        <p>{new Date(log.createdAt).toLocaleDateString()}</p>
                        <p className="text-xs text-gray-500">
                          {new Date(log.createdAt).toLocaleTimeString()}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <User className="h-4 w-4 text-gray-400" />
                      <div>
                        <p className="text-sm font-medium text-gray-900">
                          {log.userId?.firstName} {log.userId?.lastName}
                        </p>
                        <p className="text-xs text-gray-500">
                          {log.userId?.email}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <Building2 className="h-4 w-4 text-gray-400" />
                      <span className="text-sm text-gray-900">
                        {log.organizationId?.name || "N/A"}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getActionBadge(log.action)}`}
                    >
                      {log.action || "Unknown"}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <FileText className="h-4 w-4 text-gray-400" />
                      <span className="text-sm text-gray-900">
                        {log.taskId?.title || "N/A"}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <p
                      className="text-sm text-gray-600 max-w-xs truncate"
                      title={log.details || "No details available"}
                    >
                      {log.details || "No details available"}
                    </p>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {filteredLogs.length === 0 && (
        <div className="text-center py-12">
          <Activity className="h-12 w-12 text-gray-400 mx-auto mb-3" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">
            No logs found
          </h3>
          <p className="text-gray-600">
            No system logs match your current filters.
          </p>
        </div>
      )}

      {/* Activity Summary */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
        {["create", "update", "delete", "login", "logout"].map((action) => (
          <div
            key={action}
            className="bg-white rounded-sm border border-gray-200 p-4"
          >
            <div className="text-center">
              <p className="text-2xl font-bold text-gray-900">
                {filteredLogs.filter((log) => log.action === action).length}
              </p>
              <p className="text-sm text-gray-600 capitalize">
                {action} Actions
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
