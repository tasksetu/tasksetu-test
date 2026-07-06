import { useQuery } from "@tanstack/react-query";
import {
  Activity,
  Server,
  Database,
  Cpu,
  HardDrive,
  Wifi,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  RefreshCw,
  Clock,
  Mail,
  Bell,
  MessageSquare,
  Zap,
} from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";

export default function PlatformHealth() {
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Fetch health data
  const {
    data: healthData,
    isLoading,
    refetch,
  } = useQuery({
    queryKey: ["platform-health"],
    queryFn: async () => {
      // Simulated health check data
      return {
        overall: "healthy",
        uptime: 99.97,
        lastChecked: new Date().toISOString(),
      };
    },
    refetchInterval: 30000, // Auto-refresh every 30 seconds
  });

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await refetch();
    setTimeout(() => setIsRefreshing(false), 1000);
  };

  // System components status
  const systemComponents = [
    {
      name: "API Server",
      status: "healthy",
      responseTime: "42ms",
      uptime: "99.99%",
      icon: Server,
      details: "All endpoints responding normally",
    },
    {
      name: "Database (MongoDB)",
      status: "healthy",
      responseTime: "8ms",
      uptime: "99.97%",
      icon: Database,
      details: "Primary and replica sets operational",
    },
    {
      name: "Redis Cache",
      status: "healthy",
      responseTime: "2ms",
      uptime: "100%",
      icon: Zap,
      details: "Cache hit ratio: 94.2%",
    },
    {
      name: "File Storage",
      status: "healthy",
      responseTime: "125ms",
      uptime: "99.95%",
      icon: HardDrive,
      details: "S3 bucket accessible, 2.4TB used",
    },
  ];

  // Queue status
  const queues = [
    {
      name: "Email Queue",
      status: "healthy",
      pending: 12,
      processed: 4521,
      failed: 3,
      icon: Mail,
    },
    {
      name: "Push Notifications",
      status: "healthy",
      pending: 45,
      processed: 12890,
      failed: 12,
      icon: Bell,
    },
    {
      name: "In-App Notifications",
      status: "healthy",
      pending: 8,
      processed: 8923,
      failed: 0,
      icon: MessageSquare,
    },
  ];

  // Resource metrics
  const resources = [
    { name: "CPU Usage", value: 34, max: 100, unit: "%", status: "normal" },
    { name: "Memory", value: 6.2, max: 16, unit: "GB", status: "normal" },
    { name: "Disk Space", value: 245, max: 500, unit: "GB", status: "normal" },
    {
      name: "Network I/O",
      value: 125,
      max: 1000,
      unit: "Mbps",
      status: "normal",
    },
  ];

  // Recent incidents
  const recentIncidents = [
    {
      title: "Elevated API latency",
      status: "resolved",
      time: "2 days ago",
      duration: "12 minutes",
      impact: "Minor",
    },
    {
      title: "Database connection spike",
      status: "resolved",
      time: "5 days ago",
      duration: "8 minutes",
      impact: "None",
    },
  ];

  const getStatusIcon = (status) => {
    switch (status) {
      case "healthy":
        return <CheckCircle2 className="h-5 w-5 text-green-600" />;
      case "warning":
        return <AlertTriangle className="h-5 w-5 text-amber-600" />;
      case "critical":
        return <XCircle className="h-5 w-5 text-red-600" />;
      default:
        return <Activity className="h-5 w-5 text-gray-600" />;
    }
  };

  const getStatusBadge = (status) => {
    const styles = {
      healthy: "bg-green-50 text-green-700 border-green-200",
      warning: "bg-amber-50 text-amber-700 border-amber-200",
      critical: "bg-red-50 text-red-700 border-red-200",
      resolved: "bg-gray-50 text-gray-700 border-gray-200",
    };
    return styles[status] || styles.healthy;
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between pb-4 border-b border-gray-200">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-green-100 rounded-sm">
            <Activity className="h-6 w-6 text-green-600" />
          </div>
          <div>
            <h1 className="text-xl font-semibold text-gray-900">
              Platform Health
            </h1>
            <p className="text-sm text-gray-500">
              System status and performance monitoring
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-gray-500 flex items-center gap-1">
            <Clock className="h-3 w-3" />
            Last checked: {new Date().toLocaleTimeString()}
          </span>
          <Button variant="outline" onClick={handleRefresh}>
            <RefreshCw
              className={`h-4 w-4 mr-2 ${isRefreshing ? "animate-spin" : ""}`}
            />
            Refresh
          </Button>
        </div>
      </div>

      {/* Overall Status Banner */}
      <div className="bg-green-50 border border-green-200 rounded-sm p-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <CheckCircle2 className="h-8 w-8 text-green-600" />
          <div>
            <p className="font-semibold text-green-900">
              All Systems Operational
            </p>
            <p className="text-sm text-green-700">
              Platform uptime: {healthData?.uptime || 99.97}% (Last 30 days)
            </p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-2xl font-bold text-green-900">
            {healthData?.uptime || 99.97}%
          </p>
          <p className="text-xs text-green-700">Uptime SLA</p>
        </div>
      </div>

      {/* System Components */}
      <div className="bg-white border border-gray-200 rounded-sm">
        <div className="px-4 py-3 border-b border-gray-200 flex items-center gap-2">
          <Server className="h-4 w-4 text-gray-500" />
          <h2 className="text-sm font-medium text-gray-900">
            System Components
          </h2>
        </div>
        <div className="divide-y divide-gray-100">
          {systemComponents.map((component, index) => (
            <div key={index} className="px-4 py-4 flex items-center gap-3">
              <div className="p-2 bg-gray-100 rounded-sm">
                <component.icon className="h-5 w-5 text-gray-600" />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <p className="font-medium text-gray-900">{component.name}</p>
                  {getStatusIcon(component.status)}
                </div>
                <p className="text-sm text-gray-500">{component.details}</p>
              </div>
              <div className="text-right">
                <p className="text-sm font-medium text-gray-900">
                  {component.responseTime}
                </p>
                <p className="text-xs text-gray-500">Response</p>
              </div>
              <div className="text-right">
                <p className="text-sm font-medium text-gray-900">
                  {component.uptime}
                </p>
                <p className="text-xs text-gray-500">Uptime</p>
              </div>
              <span
                className={`text-xs px-2 py-1 rounded-full border ${getStatusBadge(component.status)}`}
              >
                {component.status}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Two Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        {/* Resource Metrics */}
        <div className="bg-white border border-gray-200 rounded-sm">
          <div className="px-4 py-3 border-b border-gray-200 flex items-center gap-2">
            <Cpu className="h-4 w-4 text-gray-500" />
            <h2 className="text-sm font-medium text-gray-900">
              Resource Utilization
            </h2>
          </div>
          <div className="p-4 space-y-3">
            {resources.map((resource, index) => (
              <div key={index}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm text-gray-700">{resource.name}</span>
                  <span className="text-sm font-medium text-gray-900">
                    {resource.value}
                    {resource.unit} / {resource.max}
                    {resource.unit}
                  </span>
                </div>
                <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full ${
                      (resource.value / resource.max) * 100 > 80
                        ? "bg-red-500"
                        : (resource.value / resource.max) * 100 > 60
                          ? "bg-amber-500"
                          : "bg-green-500"
                    }`}
                    style={{
                      width: `${(resource.value / resource.max) * 100}%`,
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Queue Status */}
        <div className="bg-white border border-gray-200 rounded-sm">
          <div className="px-4 py-3 border-b border-gray-200 flex items-center gap-2">
            <Wifi className="h-4 w-4 text-gray-500" />
            <h2 className="text-sm font-medium text-gray-900">Queue Status</h2>
          </div>
          <div className="divide-y divide-gray-100">
            {queues.map((queue, index) => (
              <div key={index} className="px-4 py-3">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <queue.icon className="h-4 w-4 text-gray-500" />
                    <span className="text-sm font-medium text-gray-900">
                      {queue.name}
                    </span>
                  </div>
                  {getStatusIcon(queue.status)}
                </div>
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div className="bg-amber-50 rounded px-2 py-1">
                    <p className="text-sm font-medium text-amber-700">
                      {queue.pending}
                    </p>
                    <p className="text-xs text-amber-600">Pending</p>
                  </div>
                  <div className="bg-green-50 rounded px-2 py-1">
                    <p className="text-sm font-medium text-green-700">
                      {queue.processed.toLocaleString()}
                    </p>
                    <p className="text-xs text-green-600">Processed</p>
                  </div>
                  <div className="bg-red-50 rounded px-2 py-1">
                    <p className="text-sm font-medium text-red-700">
                      {queue.failed}
                    </p>
                    <p className="text-xs text-red-600">Failed</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Recent Incidents */}
      <div className="bg-white border border-gray-200 rounded-sm">
        <div className="px-4 py-3 border-b border-gray-200 flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-gray-500" />
          <h2 className="text-sm font-medium text-gray-900">
            Recent Incidents
          </h2>
        </div>
        {recentIncidents.length === 0 ? (
          <div className="px-4 py-8 text-center text-gray-500">
            <CheckCircle2 className="h-8 w-8 mx-auto mb-2 text-green-500" />
            <p>No recent incidents</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {recentIncidents.map((incident, index) => (
              <div
                key={index}
                className="px-4 py-3 flex items-center justify-between"
              >
                <div>
                  <p className="text-sm font-medium text-gray-900">
                    {incident.title}
                  </p>
                  <p className="text-xs text-gray-500">
                    Duration: {incident.duration} • Impact: {incident.impact}
                  </p>
                </div>
                <div className="text-right flex items-center gap-3">
                  <span className="text-xs text-gray-500">{incident.time}</span>
                  <span
                    className={`text-xs px-2 py-1 rounded-full border ${getStatusBadge(incident.status)}`}
                  >
                    {incident.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
