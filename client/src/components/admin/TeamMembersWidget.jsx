import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Users, UserPlus, Eye, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function TeamMembersWidget({
  showActions = true,
  maxItems = 5,
}) {
  const { toast } = useToast();
  const [users, setUsers] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const token = localStorage.getItem("token");
  console.log("token in team mebers : ", token);
  // Fetch team members data
  const fetchTeamMembers = async () => {
    try {
      setIsLoading(true);

      if (!token) {
        throw new Error("No authentication token found");
      }

      const response = await fetch("/api/organization/users", {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch team members: ${response.status}`);
      }

      const data = await response.json();
      console.log("Fetching team members...", data);
      console.log("Fetched team members for widget:", data.length, "users");
      setUsers(data || []);
      setError(null);
    } catch (error) {
      console.error("Error fetching team members:", error);
      setError(error.message);
      toast({
        title: "Error",
        description: "Failed to fetch team members data",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };
  useEffect(() => {
    fetchTeamMembers();
  }, []);

  console.log("users in memebers widget : ", users);

  const getStatusBadge = (user) => {
    if (user.status === "active") {
      return (
        <Badge
          variant="default"
          className="bg-green-100 text-green-800 text-xs"
        >
          Active
        </Badge>
      );
    } else if (user.status === "pending") {
      return (
        <Badge
          variant="secondary"
          className="bg-yellow-100 text-yellow-800 text-xs"
        >
          Pending
        </Badge>
      );
    } else if (user.invited) {
      return (
        <Badge
          variant="secondary"
          className="bg-blue-100 text-blue-800 text-xs"
        >
          Invited
        </Badge>
      );
    }
    return (
      <Badge variant="outline" className="text-xs">
        Unknown
      </Badge>
    );
  };

  const formatUserName = (user) => {
    if (user.firstName && user.lastName) {
      return `${user.firstName} ${user.lastName}`;
    } else if (user.name) {
      return user.name;
    } else if (user.email) {
      return user.email.split("@")[0];
    }
    return "Unknown User";
  };

  const formatUserRole = (user) => {
    if (user.roles && Array.isArray(user.roles)) {
      return user.roles.join(", ");
    } else if (user.role) {
      return user.role;
    }
    return "No role";
  };

  const displayUsers = users.slice(0, maxItems);

  if (isLoading) {
    return (
      <Card className="bg-white  border border-slate-200  shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-lg font-semibold text-slate-900 dark:text-white flex items-center">
            <Users className="h-5 w-5 mr-2 text-blue-600" />
            Team Members
          </CardTitle>
        </CardHeader>
        <CardContent className="p-3">
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
            <span className="ml-2 text-sm text-slate-600">
              Loading team members...
            </span>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error || users.length === 0) {
    return (
      <Card className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-lg font-semibold text-slate-900 dark:text-white flex items-center">
            <Users className="h-5 w-5 mr-2 text-blue-600" />
            Team Members
          </CardTitle>
        </CardHeader>
        <CardContent className="p-3">
          <div className="text-center py-8">
            <Users className="h-12 w-12 mx-auto mb-3 text-slate-300" />
            <p className="text-sm text-slate-500 dark:text-slate-400">
              {error ? "Failed to load team members" : "No team members found"}
            </p>
            {showActions && (
              <Button
                onClick={() => (window.location.href = "/admin/invite-users")}
                size="sm"
                className="mt-3 bg-blue-600 "
              >
                <UserPlus className="h-4 w-4 mr-2" />
                Invite Members
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-white border border-slate-200 shadow-sm hover:shadow-md transition-shadow">
      <CardHeader className="pb-4 border-b border-slate-100">
        <CardTitle className="text-lg font-semibold text-slate-900 flex items-center justify-between">
          <div className="flex items-center">
            <div className="p-2 bg-blue-100 rounded-sm mr-3">
              <Users className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <span>Team Members</span>
              <div className="text-sm font-normal text-slate-600">
                {users.length} active members
              </div>
            </div>
          </div>
          {showActions && (
            <Button
              onClick={() => (window.location.href = "/admin/team-members")}
              variant="ghost"
              size="sm"
              className="text-blue-600 "
            >
              <Eye className="h-4 w-4 mr-1" />
              View All
            </Button>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="p-4">
        <div className="space-y-3">
          {displayUsers.map((user, index) => (
            <div
              key={user._id || index}
              className="flex items-start space-x-3 p-3 rounded-sm bg-slate-50 hover:bg-slate-100 transition-colors border border-slate-100 hover:border-slate-200"
            >
              <div className="flex-shrink-0">
                <div className="w-8 h-8 bg-gradient-to-br from-blue-400 to-blue-600 rounded-full flex items-center justify-center">
                  <span className="text-white text-xs font-semibold">
                    {formatUserName(user).charAt(0).toUpperCase()}
                  </span>
                </div>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center space-x-2 mb-1">
                  <h4
                    className="text-sm font-semibold text-slate-900 truncate"
                    title={formatUserName(user)}
                  >
                    {formatUserName(user)}
                  </h4>
                  {getStatusBadge(user)}
                </div>
                <p
                  className="text-xs text-slate-600 truncate mb-1"
                  title={user.email}
                >
                  {user.email}
                </p>
                <p className="text-xs text-slate-500 capitalize">
                  {formatUserRole(user)}
                </p>
              </div>
            </div>
          ))}

          {users.length > maxItems && (
            <div className="text-center pt-2">
              <Button
                onClick={() => (window.location.href = "/admin/team-members")}
                variant="outline"
                size="sm"
                className="text-xs"
              >
                View {users.length - maxItems} more members
              </Button>
            </div>
          )}
        </div>

        {showActions && (
          <div className="mt-4 pt-3 border-t border-slate-200 dark:border-slate-600">
            <div className="flex gap-2">
              <Button
                onClick={() => (window.location.href = "/admin/invite-users")}
                size="sm"
                className="flex-1 bg-blue-600 "
              >
                <UserPlus className="h-4 w-4 mr-2" />
                Invite Members
              </Button>
              <Button
                onClick={() => (window.location.href = "/admin/team-members")}
                variant="outline"
                size="sm"
                className="flex-1"
              >
                <Users className="h-4 w-4 mr-2" />
                Manage Team
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
