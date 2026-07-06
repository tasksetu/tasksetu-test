import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, AlertCircle, Activity, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function SupportOps() {
  const [activeTab, setActiveTab] = useState("error-logs");
  const [filterLevel, setFilterLevel] = useState("all");

  // Fetch error logs
  const { data: errorLogs, isLoading: errorsLoading } = useQuery({
    queryKey: ["/api/super-admin/error-logs", filterLevel],
    queryFn: async () => {
      const response = await fetch(
        `/api/super-admin/error-logs?level=${filterLevel}`,
        {
          headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
        },
      );
      if (!response.ok) throw new Error("Failed to fetch error logs");
      return response.json();
    },
  });

  // Fetch failed jobs
  const { data: failedJobs } = useQuery({
    queryKey: ["/api/super-admin/failed-jobs"],
    queryFn: async () => {
      const response = await fetch("/api/super-admin/failed-jobs", {
        headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
      });
      if (!response.ok) throw new Error("Failed to fetch failed jobs");
      return response.json();
    },
  });

  // Fetch abuse alerts
  const { data: abuseAlerts } = useQuery({
    queryKey: ["/api/super-admin/abuse-alerts"],
    queryFn: async () => {
      const response = await fetch("/api/super-admin/abuse-alerts", {
        headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
      });
      if (!response.ok) throw new Error("Failed to fetch abuse alerts");
      return response.json();
    },
  });

  const tabs = [
    { id: "error-logs", label: "Error Logs", icon: XCircle },
    { id: "failed-jobs", label: "Failed Jobs", icon: AlertCircle },
    { id: "abuse-alerts", label: "Abuse & Rate Limits", icon: AlertTriangle },
  ];

  return (
    <div className="space-y-3 p-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 bg-red-100 rounded-sm flex items-center justify-center border border-red-200">
          <AlertTriangle className="w-6 h-6 text-red-600" />
        </div>
        <div>
          <h2 className="text-2xl font-bold text-gray-900">
            Support & Operations
          </h2>
          <p className="text-gray-600 mt-1">
            Monitor errors, failed jobs, and abuse alerts
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <div className="flex gap-3">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <Button
                key={tab.id}
                variant="ghost"
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-3 rounded-none border-b-2 transition-all ${
                  activeTab === tab.id
                    ? "border-red-600 text-red-600"
                    : "border-transparent text-gray-600 hover:text-gray-900"
                }`}
              >
                <Icon className="w-4 h-4" />
                {tab.label}
              </Button>
            );
          })}
        </div>
      </div>

      {/* Error Logs Tab */}
      {activeTab === "error-logs" && (
        <div className="space-y-3">
          {/* Filter */}
          <div className="bg-white rounded-sm border border-gray-200 p-4">
            <select
              value={filterLevel}
              onChange={(e) => setFilterLevel(e.target.value)}
              className="h-9 px-3 border border-gray-300 rounded-sm text-sm"
            >
              <option value="all">All Levels</option>
              <option value="critical">Critical</option>
              <option value="error">Error</option>
              <option value="warning">Warning</option>
            </select>
          </div>

          {/* Error Logs Table */}
          <div className="bg-white rounded-sm border border-gray-200 overflow-hidden">
            {errorsLoading ? (
              <div className="p-7 text-center text-gray-500">
                Loading error logs...
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase">
                        Timestamp
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase">
                        Level
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase">
                        Service
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase">
                        Error
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase">
                        Count
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {errorLogs?.data?.map((log, idx) => (
                      <tr
                        key={idx}
                        className="hover:bg-gray-50 transition-colors"
                      >
                        <td className="px-6 py-3 text-sm text-gray-600">
                          {new Date(log.timestamp).toLocaleString()}
                        </td>
                        <td className="px-6 py-3 text-sm">
                          <span
                            className={`px-2 py-1 rounded-full text-xs font-medium ${
                              log.level === "critical"
                                ? "bg-red-100 text-red-800"
                                : "bg-orange-100 text-orange-800"
                            }`}
                          >
                            {log.level}
                          </span>
                        </td>
                        <td className="px-6 py-3 text-sm text-gray-900">
                          {log.service}
                        </td>
                        <td className="px-6 py-3 text-sm text-gray-600">
                          {log.error}
                        </td>
                        <td className="px-6 py-3 text-sm font-medium text-gray-900">
                          {log.count}
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

      {/* Failed Jobs Tab */}
      {activeTab === "failed-jobs" && (
        <div className="bg-white rounded-sm border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase">
                    Job ID
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase">
                    Type
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase">
                    Reason
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase">
                    Failed At
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase">
                    Action
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {failedJobs?.data?.map((job, idx) => (
                  <tr key={idx} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-3 text-sm font-mono text-gray-600">
                      {job.id}
                    </td>
                    <td className="px-6 py-3 text-sm text-gray-900">
                      {job.type}
                    </td>
                    <td className="px-6 py-3 text-sm text-gray-600">
                      {job.reason}
                    </td>
                    <td className="px-6 py-3 text-sm text-gray-600">
                      {new Date(job.failedAt).toLocaleString()}
                    </td>
                    <td className="px-6 py-3 text-sm">
                      <Button
                        variant="ghost"
                        className="h-9 text-blue-600 hover:text-blue-800 font-medium"
                      >
                        Retry
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Abuse Alerts Tab */}
      {activeTab === "abuse-alerts" && (
        <div className="space-y-3">
          {abuseAlerts?.data?.map((alert, idx) => (
            <div
              key={idx}
              className="bg-white rounded-sm border border-red-200 p-4"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <h4 className="font-semibold text-gray-900">{alert.type}</h4>
                  <p className="text-sm text-gray-600 mt-1">
                    {alert.organization}
                  </p>
                  <div className="mt-3 space-y-1">
                    <p className="text-sm text-gray-700">
                      <strong>Threshold:</strong> {alert.threshold}
                    </p>
                    <p className="text-sm text-gray-700">
                      <strong>Current:</strong> {alert.current}
                    </p>
                    <p className="text-sm text-gray-600">
                      Detected: {new Date(alert.timestamp).toLocaleString()}
                    </p>
                  </div>
                </div>
                <div className="flex gap-2 ml-4">
                  <Button variant="primary" className="h-9">
                    Investigate
                  </Button>
                  <Button variant="destructive" className="h-9">
                    Block
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
