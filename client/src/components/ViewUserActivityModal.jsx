import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Eye,
  Calendar,
  Clock,
  CheckCircle,
  FileText,
  Settings,
  Download,
  Mail,
  MapPin,
  Building2,
  Briefcase,
  User,
  BadgeCheck,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { getInitials } from "../lib/utils";
import { renderRoles, roleLabels } from "../utils/roleBadge";
import { getStatusBadge } from "./common/statusBadge";

export function ViewUserActivityModal({ isOpen, onClose, user }) {
  const { toast } = useToast();

  if (!user) return null;

  // Export individual user activity data
  const exportUserActivity = () => {
    const userData = {
      "User Name": user.name,
      Email: user.email,
      Role: user.role,
      License: user.licenseId,
      Department: user.department || "N/A",
      Designation: user.designation || "N/A",
      Location: user.location || "N/A",
      Status: user.status,
      "Date Joined": new Date(user.createdAt).toLocaleDateString(),
      "Last Login": user.lastLoginAt
        ? new Date(user.lastLoginAt).toLocaleDateString()
        : "Never",
      "Tasks Assigned": user.assignedTasks || 0,
      "Tasks Completed": user.completedTasks || 0,
      "Forms Created": user.formsCreated || 0,
      "Active Processes": user.activeProcesses || 0,
      "Completion Rate":
        user.assignedTasks > 0
          ? `${((user.completedTasks / user.assignedTasks) * 100).toFixed(1)}%`
          : "0%",
    };

    const csvContent =
      "data:text/csv;charset=utf-8," +
      [Object.keys(userData).join(",")]
        .concat([Object.values(userData).join(",")])
        .join("\n");

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute(
      "download",
      `${user.name.replace(/\s+/g, "_")}_activity_data.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    toast({
      title: "Export Successful!",
      description: `${user.name}'s activity data has been exported to CSV.`,
      variant: "default",
      duration: 3000,
    });
  };

  const completionRate =
    user.assignedTasks > 0
      ? ((user.completedTasks / user.assignedTasks) * 100).toFixed(1)
      : 0;



  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto z-50">
        <DialogHeader>
          <DialogTitle className="flex items-center space-x-2 text-xl font-semibold">
            <Eye className="h-5 w-5 text-blue-600" />
            <span>User Activity - {user.name}</span>
          </DialogTitle>
          <DialogDescription>
            Detailed activity summary and performance metrics for this user
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          {/* User Profile Section */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-3">
                <div className="w-12 h-12 bg-blue-600 text-white rounded-full flex items-center justify-center text-lg font-medium">
                  {getInitials(user.name)}
                </div>
                <div>
                  <div className="text-xl font-semibold">{user.name}</div>
                  <div className="text-sm text-gray-500">{user.email}</div>
                </div>
                <div className="ml-auto">{getStatusBadge(user.status)}</div>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                <div className="flex items-center gap-2">
                  <User className="h-4 w-4 text-gray-500" />
                  <span className="text-sm ">
                    <strong>Role:</strong>{" "}
                    {user.role.map((r) => roleLabels[r]).join(", ")}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Building2 className="h-4 w-4 text-gray-500" />
                  <span className="text-sm">
                    <strong>Department:</strong> {user.department || "N/A"}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Briefcase className="h-4 w-4 text-gray-500" />
                  <span className="text-sm">
                    <strong>Designation:</strong> {user.designation || "N/A"}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-gray-500" />
                  <span className="text-sm">
                    <strong>Location:</strong> {user.location || "N/A"}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <BadgeCheck className="h-4 w-4 text-gray-500" />
                  <span className="text-sm">
                    <strong>License:</strong>{" "}
                    <Badge variant="outline" className="font-mono text-xs">
                      {user.licenseId}
                    </Badge>
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Activity Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  Date Joined
                </CardTitle>
                <Calendar className="h-4 w-4 text-blue-600" />
              </CardHeader>
              <CardContent>
                <div className="text-lg font-bold">
                  {new Date(user.createdAt).toLocaleDateString()}
                </div>
                <p className="text-xs text-gray-500">
                  {Math.floor(
                    (new Date() - new Date(user.createdAt)) /
                    (1000 * 60 * 60 * 24)
                  )}{" "}
                  days ago
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  Last Login
                </CardTitle>
                <Clock className="h-4 w-4 text-green-600" />
              </CardHeader>
              <CardContent>
                <div className="text-lg font-bold">
                  {user.lastLoginAt
                    ? new Date(user.lastLoginAt).toLocaleDateString()
                    : "Never"}
                </div>
                <p className="text-xs text-gray-500">
                  {user.lastLoginAt
                    ? `${Math.floor(
                      (new Date() - new Date(user.lastLoginAt)) /
                      (1000 * 60 * 60 * 24)
                    )} days ago`
                    : "No login recorded"}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  Tasks Assigned
                </CardTitle>
                <CheckCircle className="h-4 w-4 text-purple-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {user.assignedTasks || 0}
                </div>
                <p className="text-xs text-gray-500">Total assigned tasks</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  Completion Rate
                </CardTitle>
                <CheckCircle className="h-4 w-4 text-green-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-600">
                  {completionRate}%
                </div>
                <p className="text-xs text-gray-500">
                  {user.completedTasks || 0}/{user.assignedTasks || 0} completed
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Detailed Activity Stats */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  Forms Created
                </CardTitle>
                <FileText className="h-4 w-4 text-blue-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {user.formsCreated || 0}
                </div>
                <p className="text-xs text-gray-500">Total forms created</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  Active Processes
                </CardTitle>
                <Settings className="h-4 w-4 text-orange-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-orange-600">
                  {user.activeProcesses || 0}
                </div>
                <p className="text-xs text-gray-500">Currently running</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  Performance
                </CardTitle>
                <CheckCircle className="h-4 w-4 text-purple-600" />
              </CardHeader>
              <CardContent>
                {user.assignedTasks > 0 ? (
                  (() => {
                    const rate = completionRate || 0;
                    let label = "";
                    let color = "";

                    if (rate < 25) {
                      label = "Emerging";
                      color = "text-red-500";
                    } else if (rate < 50) {
                      label = "Average";
                      color = "text-orange-500";
                    } else if (rate < 75) {
                      label = "Good";
                      color = "text-blue-500";
                    } else if (rate < 100) {
                      label = "Excellent";
                      color = "text-green-500";
                    } else {
                      label = "Outstanding";
                      color = "text-emerald-500";
                    }

                    return (
                      <>
                        <div className={`text-2xl font-bold ${color}`}>
                          {label}
                        </div>
                        <p className="text-xs text-gray-500">
                          {rate}% completion rate
                        </p>
                      </>
                    );
                  })()
                ) : (
                  <>
                    <div className="text-2xl font-bold text-gray-500">New</div>
                    <p className="text-xs text-gray-400">
                      No tasks assigned yet
                    </p>
                  </>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Performance Insights */}
          {user.status === "Inactive" && (
            <Card className="border-red-200 bg-red-50">
              <CardHeader>
                <CardTitle className="text-red-800 flex items-center gap-2">
                  <Clock className="h-5 w-5" />
                  User Status Alert
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-red-700">
                  This user is currently inactive and cannot log in.
                  {user.activeProcesses > 0 &&
                    ` They have ${user.activeProcesses} active task(s) that will show "Owner Inactive" label.`}
                </p>
              </CardContent>
            </Card>
          )}

          {user.status === "Pending" && (
            <Card className="border-yellow-200 bg-yellow-50">
              <CardHeader>
                <CardTitle className="text-yellow-800 flex items-center gap-2">
                  <Mail className="h-5 w-5" />
                  Pending Activation
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-yellow-700">
                  This user hasn't activated their account yet. The invitation
                  was sent on {new Date(user.dateCreated).toLocaleDateString()}.
                  Invitation links expire in 72 hours.
                </p>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Modal Actions */}
        <div className="flex items-center justify-between pt-6 border-t border-gray-200">
          <Button
            variant="outline"
            onClick={exportUserActivity}
            className="h-9 flex items-center gap-2"
          >
            <Download className="h-4 w-4" />
            Export Activity CSV
          </Button>
          <Button className="h-9" onClick={onClose}>Close</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
