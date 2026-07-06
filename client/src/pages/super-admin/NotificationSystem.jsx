import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Bell,
  AlertTriangle,
  Activity,
  CheckCircle,
  XCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";

export default function NotificationSystem() {
  const [activeTab, setActiveTab] = useState("triggers");

  // Fetch notification health
  const { data: notificationHealth } = useQuery({
    queryKey: ["/api/super-admin/notification-health"],
    queryFn: async () => {
      const response = await fetch("/api/super-admin/notification-health", {
        headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
      });
      if (!response.ok) throw new Error("Failed to fetch notification health");
      return response.json();
    },
  });

  const tabs = [
    { id: "triggers", label: "Trigger Definitions" },
    { id: "escalation", label: "Escalation Rules" },
    { id: "health", label: "Channel Health" },
  ];

  const notificationTriggers = [
    {
      event: "Task Overdue",
      condition: "> 1 day",
      actions: ["Email", "Push", "In-app"],
    },
    {
      event: "Approval Pending",
      condition: "> 24 hours",
      actions: ["Email", "Push"],
    },
    {
      event: "Task Assigned",
      condition: "Immediate",
      actions: ["Email", "Push", "In-app"],
    },
    { event: "Task Completed", condition: "Immediate", actions: ["Email"] },
    {
      event: "Comment Mention",
      condition: "Immediate",
      actions: ["Email", "Push", "In-app"],
    },
  ];

  const escalationRules = [
    {
      level: 1,
      time: "T+2 days",
      recipient: "Task Manager",
      action: "Email Reminder",
    },
    {
      level: 2,
      time: "T+7 days",
      recipient: "Department Admin",
      action: "Email Escalation",
    },
    {
      level: 3,
      time: "T+14 days",
      recipient: "Organization Admin",
      action: "Email Escalation + Alert",
    },
  ];

  return (
    <div className="space-y-3 p-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 bg-blue-100 rounded-sm flex items-center justify-center border border-blue-200">
          <Bell className="w-6 h-6 text-blue-600" />
        </div>
        <div>
          <h2 className="text-2xl font-bold text-gray-900">
            Notification System
          </h2>
          <p className="text-gray-600 mt-1">
            Manage global notification triggers and delivery
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
                  ? "border-blue-600 text-blue-600"
                  : "border-transparent text-gray-600 hover:text-gray-900"
              }`}
            >
              {tab.label}
            </Button>
          ))}
        </div>
      </div>

      {/* Triggers Tab */}
      {activeTab === "triggers" && (
        <div className="bg-white rounded-sm border border-gray-200 p-4">
          <h3 className="text-lg font-semibold text-gray-900 mb-3">
            Global Trigger Definitions
          </h3>
          <div className="space-y-3">
            {notificationTriggers.map((trigger, idx) => (
              <div
                key={idx}
                className="p-4 border border-gray-200 rounded-sm hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <h4 className="font-semibold text-gray-900">
                      {trigger.event}
                    </h4>
                    <p className="text-sm text-gray-600 mt-1">
                      Condition: {trigger.condition}
                    </p>
                    <div className="flex gap-2 mt-3">
                      {trigger.actions.map((action) => (
                        <span
                          key={action}
                          className="px-2 py-1 bg-blue-100 text-blue-700 text-xs rounded-full"
                        >
                          {action}
                        </span>
                      ))}
                    </div>
                  </div>
                  <Button variant="ghost" size="icon">
                    ✎
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Escalation Tab */}
      {activeTab === "escalation" && (
        <div className="bg-white rounded-sm border border-gray-200 p-4">
          <h3 className="text-lg font-semibold text-gray-900 mb-3">
            Escalation Rules
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">
                    Level
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">
                    Time Threshold
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">
                    Recipient
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">
                    Action
                  </th>
                  <th className="px-4 py-3 text-right text-sm font-semibold text-gray-700">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {escalationRules.map((rule, idx) => (
                  <tr key={idx} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 text-sm text-gray-900">
                      {rule.level}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {rule.time}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-900">
                      {rule.recipient}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {rule.action}
                    </td>
                    <td className="px-4 py-3 text-right text-sm text-gray-500">
                      ✎
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Channel Health Tab */}
      {activeTab === "health" && (
        <div className="bg-white rounded-sm border border-gray-200 p-4">
          <h3 className="text-lg font-semibold text-gray-900 mb-3">
            Channel Health Status
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="p-4 border border-gray-200 rounded-sm">
              <div className="flex items-center justify-between mb-3">
                <h4 className="font-semibold text-gray-900">Email</h4>
                <CheckCircle className="w-5 h-5 text-green-600" />
              </div>
              <p className="text-sm text-gray-600">Success Rate: 99.8%</p>
              <p className="text-sm text-gray-600">Queue: 45 pending</p>
            </div>
            <div className="p-4 border border-gray-200 rounded-sm">
              <div className="flex items-center justify-between mb-3">
                <h4 className="font-semibold text-gray-900">Push</h4>
                <CheckCircle className="w-5 h-5 text-green-600" />
              </div>
              <p className="text-sm text-gray-600">Success Rate: 98.5%</p>
              <p className="text-sm text-gray-600">Queue: 12 pending</p>
            </div>
            <div className="p-4 border border-gray-200 rounded-sm">
              <div className="flex items-center justify-between mb-3">
                <h4 className="font-semibold text-gray-900">In-App</h4>
                <CheckCircle className="w-5 h-5 text-green-600" />
              </div>
              <p className="text-sm text-gray-600">Success Rate: 100%</p>
              <p className="text-sm text-gray-600">Queue: 0 pending</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
