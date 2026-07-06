import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Scroll, FileText, Shield, Download, Filter } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function ComplianceCenter() {
  const [activeTab, setActiveTab] = useState("audit-logs");
  const [filters, setFilters] = useState({ action: "all", dateRange: "7days" });

  // Fetch audit logs
  const { data: auditLogs, isLoading: auditLoading } = useQuery({
    queryKey: ["/api/super-admin/audit-logs", filters],
    queryFn: async () => {
      const params = new URLSearchParams({
        action: filters.action,
        dateRange: filters.dateRange,
      });
      const response = await fetch(`/api/super-admin/audit-logs?${params}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
      });
      if (!response.ok) throw new Error("Failed to fetch audit logs");
      return response.json();
    },
  });

  const tabs = [
    { id: "audit-logs", label: "Audit Logs" },
    // { id: "export-compliance", label: "Export & Compliance" },
    // { id: "retention", label: "Retention Policies" },
  ];

  const actionTypes = [
    { value: "all", label: "All Actions" },
    { value: "USER_LOGIN", label: "User Logins" },
    { value: "license_change", label: "License Changes" },
    { value: "feature_toggle", label: "Feature Toggles" },
    { value: "company_suspension", label: "Company Suspension" },
    { value: "admin_action", label: "Admin Actions" },
  ];

  return (
    <div className="space-y-3 p-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 bg-amber-100 rounded-sm flex items-center justify-center border border-amber-200">
          <Scroll className="w-6 h-6 text-amber-600" />
        </div>
        <div>
          <h2 className="text-2xl font-bold text-gray-900">
            Audit & Compliance
          </h2>
          <p className="text-gray-600 mt-1">
            Monitor compliance and maintain audit trail
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <div className="flex gap-3">
          {tabs.map((tab) => (
            <Button
              key={tab.id}
              variant="ghost"
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-3 rounded-none border-b-2 transition-all ${
                activeTab === tab.id
                  ? "border-amber-600 text-amber-600"
                  : "border-transparent text-gray-600 hover:text-gray-900"
              }`}
            >
              {tab.label}
            </Button>
          ))}
        </div>
      </div>

      {/* Audit Logs Tab */}
      {activeTab === "audit-logs" && (
        <div className="space-y-3">
          {/* Filters */}
          <div className="bg-white rounded-sm border border-gray-200 p-4">
            <div className="flex items-center gap-3">
              <Filter className="w-4 h-4 text-gray-600" />
              <select
                value={filters.action}
                onChange={(e) =>
                  setFilters({ ...filters, action: e.target.value })
                }
                className="h-9 px-3 border border-gray-300 rounded-sm text-sm"
              >
                {actionTypes.map((type) => (
                  <option key={type.value} value={type.value}>
                    {type.label}
                  </option>
                ))}
              </select>
              <select
                value={filters.dateRange}
                onChange={(e) =>
                  setFilters({ ...filters, dateRange: e.target.value })
                }
                className="h-9 px-3 border border-gray-300 rounded-sm text-sm"
              >
                <option value="24hours">Last 24 Hours</option>
                <option value="7days">Last 7 Days</option>
                <option value="30days">Last 30 Days</option>
                <option value="90days">Last 90 Days</option>
              </select>
            </div>
          </div>

          {/* Audit Logs Table */}
          <div className="bg-white rounded-sm border border-gray-200 overflow-hidden">
            {auditLoading ? (
              <div className="p-7 text-center text-gray-500">
                Loading audit logs...
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                        Timestamp
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                        Action
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                        Admin
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                        Target
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                        Details
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {auditLogs?.data?.map((log, idx) => (
                      <tr
                        key={idx}
                        className="hover:bg-gray-50 transition-colors"
                      >
                        <td className="px-6 py-3 text-sm text-gray-600">
                          {log.timestamp
                            ? new Date(log.timestamp).toLocaleString()
                            : "N/A"}
                        </td>
                        <td className="px-6 py-3 text-sm">
                          <span
                            className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                              log.action?.includes("LICENSE")
                                ? "bg-blue-100 text-blue-700"
                                : log.action?.includes("COMPANY")
                                  ? "bg-purple-100 text-purple-700"
                                  : log.action?.includes("LOGIN")
                                    ? "bg-green-100 text-green-700"
                                    : "bg-gray-100 text-gray-700"
                            }`}
                          >
                            {log.action?.replace(/_/g, " ")}
                          </span>
                        </td>
                        <td className="px-6 py-3 text-sm text-gray-600">
                          <div className="flex flex-col">
                            <span className="font-medium text-gray-900">
                              {log.actor_name ||
                                (log.actor_id?.firstName
                                  ? `${log.actor_id.firstName} ${log.actor_id.lastName || ""}`
                                  : null) ||
                                "System"}
                            </span>
                            <span className="text-xs text-gray-500">
                              {log.actor_email || log.actor_id?.email || "N/A"}
                            </span>
                          </div>
                        </td>
                        <td className="px-6 py-3 text-sm text-gray-600">
                          <div className="flex flex-col">
                            <span className="font-medium">
                              {log.entity_name ||
                                (log.organization_id?.name
                                  ? log.organization_id.name
                                  : null) ||
                                log.entity_type ||
                                "N/A"}
                            </span>
                            {log.entity_type && (
                              <span className="text-[10px] text-gray-400 uppercase tracking-tighter">
                                {log.entity_type.replace(/_/g, " ")}
                              </span>
                            )}
                          </div>
                        </td>
                        <td
                          className="px-6 py-3 text-sm text-gray-600 max-w-xs"
                          title={log.change_summary}
                        >
                          <div className="line-clamp-2">
                            {log.change_summary ||
                              log.details ||
                              "No details recorded"}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Export & Compliance Tab */}
      {/* {activeTab === "export-compliance" && (
        <div className="bg-white rounded-sm border border-gray-200 p-4">
          <h3 className="text-lg font-semibold text-gray-900 mb-3">Export for Compliance</h3>
          <div className="space-y-3">
            <div className="p-4 border border-gray-200 rounded-sm">
              <h4 className="font-semibold text-gray-900 mb-2">Audit Log Export</h4>
              <p className="text-sm text-gray-600 mb-3">Export all audit logs for regulatory compliance</p>
              <div className="flex gap-3">
                <Button variant="primary" className="h-9 flex items-center gap-2">
                  <Download className="w-4 h-4" />
                  Export as CSV
                </Button>
                <Button variant="primary" className="h-9 flex items-center gap-2">
                  <Download className="w-4 h-4" />
                  Export as PDF
                </Button>
              </div>
            </div>
            <div className="p-4 border border-gray-200 rounded-sm">
              <h4 className="font-semibold text-gray-900 mb-2">Data Retention Export</h4>
              <p className="text-sm text-gray-600 mb-3">Export user data for deletion requests</p>
              <Button variant="primary" className="h-9 flex items-center gap-2">
                <Download className="w-4 h-4" />
                Export User Data
              </Button>
            </div>
          </div>
        </div>
      )} */}

      {/* Retention Policies Tab */}
      {/* {activeTab === "retention" && (
        <div className="bg-white rounded-sm border border-gray-200 p-4">
          <h3 className="text-lg font-semibold text-gray-900 mb-3">Data Retention Policies</h3>
          <div className="space-y-3">
            <div className="p-4 border border-gray-200 rounded-sm">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h4 className="font-semibold text-gray-900">Audit Logs Retention</h4>
                  <p className="text-sm text-gray-600 mt-1">Current: 1 year (automatic archival)</p>
                </div>
                <Button variant="ghost" size="icon">✎</Button>
              </div>
            </div>
            <div className="p-4 border border-gray-200 rounded-sm">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h4 className="font-semibold text-gray-900">User Data Retention</h4>
                  <p className="text-sm text-gray-600 mt-1">Current: 30 days after deletion</p>
                </div>
                <Button variant="ghost" size="icon">✎</Button>
              </div>
            </div>
            <div className="p-4 border border-gray-200 rounded-sm">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h4 className="font-semibold text-gray-900">Failed Job Logs</h4>
                  <p className="text-sm text-gray-600 mt-1">Current: 90 days</p>
                </div>
                <Button variant="ghost" size="icon">✎</Button>
              </div>
            </div>
          </div>
        </div>
      )} */}
    </div>
  );
}
