import React, { useState, useMemo, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";
import { getAuthUser } from "@/utils/auth";

import {
  Users,
  UserPlus,
  Search,
  Filter,
  MoreHorizontal,
  RefreshCw,
  RotateCcw,
  UserX,
  ChevronLeft,
  ChevronRight,
  Shield,
  UserCheck,
  Clock,
  Crown,
  User,
  Loader,
} from "lucide-react";
import { get } from "mongoose";
import { getInitials } from "../../lib/utils";

export default function TeamMembers() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [inviteModalOpen, setInviteModalOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [roleFilter, setRoleFilter] = useState("all");
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  const [inviteUsers, setInviteUsers] = useState([
    { email: "", roles: ["employee"], firstName: "", lastName: "" },
  ]);

  const [teamMembers, setTeamMembers] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const token = localStorage.getItem("token");

  // Fetch team members data
  const fetchTeamMembers = async (silent = false) => {
    try {
      if (!silent) setIsLoading(true);

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
      setTeamMembers(data || []);
      setError(null);
    } catch (error) {
      console.error("Error fetching team members:", error);
      if (!silent) {
        setError(error.message);
        toast({
          title: "Error",
          description: "Failed to fetch team members data",
          variant: "destructive",
        });
      }
    } finally {
      if (!silent) setIsLoading(false);
    }
  };
  useEffect(() => {
    fetchTeamMembers();
  }, []);

  // Debug logging
  console.log("TeamMembers Component Debug:");
  console.log("- isLoading:", isLoading);
  console.log("- error:", error);
  console.log("- teamMembers:", teamMembers);
  console.log("- teamMembers length:", teamMembers?.length);

  // Fetch license info
  const { data: licenseInfo } = useQuery({
    queryKey: ["/api/organization/license"],
    enabled: true,
  });

  // Refresh team members data
  const refreshData = () => {
    fetchTeamMembers();
  };

  // Mutations
  const inviteUsersMutation = useMutation({
    mutationFn: async (inviteData) => {
      console.log("Sending invitations:", inviteData);

      const token = localStorage.getItem("token");
      const response = await fetch("/api/organization/invite-users", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ invites: inviteData }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          errorData.message || `Failed to send invitations: ${response.status}`,
        );
      }

      return await response.json();
    },
    onSuccess: () => {
      console.log("Invitations sent successfully");
      fetchTeamMembers(true); // Refresh data after sending invitations
      setInviteModalOpen(false);
      setInviteUsers([
        { email: "", roles: ["employee"], firstName: "", lastName: "" },
      ]);
      toast({
        title: "Invitations sent",
        description: "Team member invitations have been sent successfully",
      });
    },
    onError: (error) => {
      console.error("Invitation error:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to send invitations",
        variant: "destructive",
      });
    },
  });

  const resendInviteMutation = useMutation({
    mutationFn: (userId) =>
      apiRequest(`/api/organization/users/${userId}/resend-invite`, {
        method: "POST",
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["/api/organization/users-detailed"],
      });
      toast({
        title: "Invitation resent",
        description: "The invitation has been resent successfully",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to resend invitation",
        variant: "destructive",
      });
    },
  });

  const revokeInviteMutation = useMutation({
    mutationFn: (userId) =>
      apiRequest(`/api/organization/users/${userId}/revoke-invite`, {
        method: "DELETE",
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["/api/organization/users-detailed"],
      });
      toast({
        title: "Invitation revoked",
        description: "The invitation has been revoked successfully",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to revoke invitation",
        variant: "destructive",
      });
    },
  });

  const removeUserMutation = useMutation({
    mutationFn: async (userId) => {
      const token = localStorage.getItem("token");
      const res = await fetch(`/api/organization/users/${userId}`, {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.message || "Failed to remove user");
      }
      return res.json();
    },
    onSuccess: () => {
      fetchTeamMembers(true);
      toast({
        title: "User removed",
        description: "The user has been removed from the organization",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to remove user",
        variant: "destructive",
      });
    },
  });

  // Enhanced filter and pagination logic
  const filteredAndPaginatedData = useMemo(() => {
    let filtered = teamMembers.filter((user) => {
      // Enhanced search functionality
      const searchQuery = searchTerm.toLowerCase();
      const userName = `${user.firstName || ""} ${
        user.lastName || ""
      }`.toLowerCase();
      const userEmail = user.email?.toLowerCase() || "";
      const userRoles = getUserRoles(user).join(" ").toLowerCase();

      const matchesSearch =
        searchTerm === "" ||
        userName.includes(searchQuery) ||
        userEmail.includes(searchQuery) ||
        userRoles.includes(searchQuery);

      // Status filtering
      const matchesStatus =
        statusFilter === "all" || user.status === statusFilter;

      // Role filtering with support for multiple roles
      const userRolesList = getUserRoles(user);
      const matchesRole =
        roleFilter === "all" ||
        userRolesList.some((role) => role === roleFilter);

      return matchesSearch && matchesStatus && matchesRole;
    });

    // Sort users: active users first, then by creation date
    filtered.sort((a, b) => {
      if (a.status === "active" && b.status !== "active") return -1;
      if (a.status !== "active" && b.status === "active") return 1;
      return new Date(b.createdAt) - new Date(a.createdAt);
    });

    const totalItems = filtered.length;
    const totalPages = Math.ceil(totalItems / itemsPerPage);
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    const paginatedUsers = filtered.slice(startIndex, endIndex);

    return {
      users: paginatedUsers,
      totalItems,
      totalPages,
      hasNextPage: currentPage < totalPages,
      hasPrevPage: currentPage > 1,
      currentStart: startIndex + 1,
      currentEnd: Math.min(endIndex, totalItems),
    };
  }, [teamMembers, searchTerm, statusFilter, roleFilter, currentPage]);

  // Helper functions
  const getDisplayName = (user) => {
    if (user.firstName && user.lastName) {
      return `${user.firstName} ${user.lastName}`;
    }
    return user.email?.split("@")[0] || "Unknown User";
  };

  const getRoleIcon = (roles) => {
    const roleList = Array.isArray(roles) ? roles : [roles];
    if (roleList.includes("admin"))
      return <Crown className="h-4 w-4 text-yellow-600" />;
    if (roleList.includes("manager"))
      return <Shield className="h-4 w-4 text-purple-600" />;
    if (roleList.includes("employee"))
      return <UserCheck className="h-4 w-4 text-blue-600" />;
    if (roleList.includes("member"))
      return <User className="h-4 w-4 text-gray-600" />;
    return <User className="h-4 w-4 text-gray-600" />;
  };

  const getRoleColor = (role) => {
    switch (role) {
      case "admin":
        return "bg-yellow-100 text-yellow-800 border-yellow-200";
      case "manager":
        return "bg-purple-100 text-purple-800 border-purple-200";
      case "employee":
        return "bg-blue-100 text-blue-800 border-blue-200";
      case "member":
        return "bg-gray-100 text-gray-800 border-gray-200";
      default:
        return "bg-gray-100 text-gray-800 border-gray-200";
    }
  };

  const getStatusIcon = (status) => {
    if (status === "active")
      return <UserCheck className="h-4 w-4 text-green-600" />;
    if (status === "inactive")
      return <UserX className="h-4 w-4 text-gray-400" />;
    return <Clock className="h-4 w-4 text-orange-600" />;
  };

  const getStatusColor = (status) => {
    if (status === "active") return "text-green-600";
    if (status === "inactive") return "text-gray-400";
    return "text-orange-600";
  };

  const formatDate = (dateString) => {
    if (!dateString) return "-";
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  function getUserRoles(user) {
    if (user.roles?.length) return user.roles;
    if (Array.isArray(user.role)) return user.role;
    return user.role ? [user.role] : [];
  }

  const getRelativeTime = (dateString) => {
    if (!dateString) return "-";
    const date = new Date(dateString);
    const now = new Date();
    const diffInDays = Math.floor((now - date) / (1000 * 60 * 60 * 24));

    if (diffInDays === 0) return "Today";
    if (diffInDays === 1) return "Yesterday";
    if (diffInDays < 7) return `${diffInDays} days ago`;
    if (diffInDays < 30) return `${Math.floor(diffInDays / 7)} weeks ago`;
    return formatDate(dateString);
  };

  const addInviteUser = () => {
    setInviteUsers([
      ...inviteUsers,
      { email: "", roles: ["employee"], firstName: "", lastName: "" },
    ]);
  };

  const removeInviteUser = (index) => {
    if (inviteUsers.length > 1) {
      setInviteUsers(inviteUsers.filter((_, i) => i !== index));
    }
  };

  const updateInviteUser = (index, field, value) => {
    const updated = [...inviteUsers];
    updated[index] = { ...updated[index], [field]: value };
    setInviteUsers(updated);
  };

  const handleInviteSubmit = () => {
    const validUsers = inviteUsers.filter((user) => user.email.trim());
    if (validUsers.length === 0) {
      toast({
        title: "Error",
        description: "Please enter at least one email address",
        variant: "destructive",
      });
      return;
    }

    // Transform data to match backend expectations
    const transformedUsers = validUsers.map((user) => ({
      name:
        `${user.firstName || ""} ${user.lastName || ""}`.trim() ||
        user.email.split("@")[0],
      email: user.email,
      role: user.roles || ["employee"], // Keep as array
      licenseId: user.licenseId || "Explore (Free)",
      department: user.department || null,
      designation: user.designation || null,
      location: user.location || null,
      phone: user.phone || null,
      sendEmail: true,
    }));

    inviteUsersMutation.mutate(transformedUsers);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="flex flex-col items-center gap-3">
          <Loader className="w-8 h-8 animate-spin text-blue-600" />
          <p className="text-lg text-gray-600">Loading team members...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-12">
        <div className="text-red-600 mb-3">
          {error.message?.includes("401")
            ? "Please log in to view team members"
            : "Error loading team members"}
        </div>
        <div className="space-x-2">
          <Button onClick={refreshData}>Retry</Button>
          <Button
            variant="outline"
            onClick={() => {
              window.location.href = "/login";
            }}
          >
            Re-login
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="team-members-container py-2 sm:py-3 px-2 sm:px-4 lg:px-6 space-y-2 sm:space-y-3 bg-gray-50 min-h-full">
      {/* License Information Card
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-3">
            <Shield className="h-6 w-6 text-blue-600" />
            License Information
          </CardTitle>
          <CardDescription>
            Current subscription and usage details
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-md p-4 border border-blue-200">
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2 bg-blue-600 rounded-md">
                  <Users className="h-5 w-5 text-white" />
                </div>
                <span className="text-lg font-bold text-blue-600">
                  {licenseInfo?.usedLicenses || 0}
                </span>
              </div>
              <h4 className="font-semibold text-gray-900 mb-1">Active Users</h4>
              <p className="text-sm text-gray-600">Currently using licenses</p>
            </div>

            <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-md p-4 border border-green-200">
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2 bg-green-600 rounded-md">
                  <Shield className="h-5 w-5 text-white" />
                </div>
                <span className="text-lg font-bold text-green-600">
                  {licenseInfo?.totalLicenses || 0}
                </span>
              </div>
              <h4 className="font-semibold text-gray-900 mb-1">
                Total Licenses
              </h4>
              <p className="text-sm text-gray-600">
                Available for your organization
              </p>
            </div>

            <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-md p-4 border border-purple-200">
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2 bg-purple-600 rounded-md">
                  <Shield className="h-5 w-5 text-purple-600" />
                </div>
                <span className="text-lg font-bold text-purple-600">
                  {licenseInfo?.licenseType || "Standard"}
                </span>
              </div>
              <h4 className="font-semibold text-gray-900 mb-1">Plan Type</h4>
              <p className="text-sm text-gray-600">Current subscription</p>
            </div>
          </div>

          <div className="mt-6 bg-white rounded-md p-4 border border-gray-100">
            <div className="flex justify-between items-center mb-2">
              <span className="text-sm font-medium text-gray-700">
                License Usage
              </span>
              <span className="text-sm text-gray-600">
                {licenseInfo?.usedLicenses || 0} of{" "}
                {licenseInfo?.totalLicenses || 0} used
              </span>
            </div>
            <div className="w-full bg-gray-200 rounded-md h-2">
              <div
                className="bg-gradient-to-r from-blue-500 to-blue-600 h-2 rounded-md transition-all duration-300"
                style={{
                  width: `${
                    licenseInfo?.totalLicenses > 0
                      ? (licenseInfo.usedLicenses / licenseInfo.totalLicenses) *
                        100
                      : 0
                  }%`,
                }}
              ></div>
            </div>
          </div>
        </CardContent>
      </Card> */}

      {/* Team Members Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl font-normal m-0"
                style={{ color: "#676a6c" }}>Team Members ({teamMembers.length})</CardTitle>
          <CardDescription className="mt-0 text-sm text-blue-600">
            All team members including active users and pending invitations
          </CardDescription>
        </CardHeader>
        <CardContent>
          {/* Enhanced Filter Controls */}
          <div className="space-y-3 mb-3">
            {/* Primary Search and Actions */}
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="flex-1">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                  <Input
                    placeholder="Search by name, email, or role..."
                    value={searchTerm}
                    onChange={(e) => {
                      setSearchTerm(e.target.value);
                      setCurrentPage(1);
                    }}
                    className="pl-2"
                  />
                </div>
              </div>
              <div className="flex gap-2">
                {/* <Button
                    onClick={() => setInviteModalOpen(true)}
                    className="bg-blue-600 hover:bg-blue-700 whitespace-nowrap"
                  >
                    <UserPlus className="h-4 w-4 mr-2" />
                    Invite Members
                  </Button> */}
                <Button
                  onClick={refreshData}
                  variant="outline"
                  className="whitespace-nowrap"
                >
                  <RotateCcw className="h-4 w-4 mr-2" />
                  Refresh
                </Button>
              </div>
            </div>

            {/* Filter Row */}
            <div className="flex flex-wrap gap-3">
              <div className="flex items-center gap-2">
                <Filter className="h-4 w-4 text-gray-500" />
                <span className="text-sm font-medium text-gray-700">
                  Filters:
                </span>
              </div>

              <Select
                value={statusFilter}
                onValueChange={(value) => {
                  setStatusFilter(value);
                  setCurrentPage(1);
                }}
              >
                <SelectTrigger className="w-full sm:w-36">
                  <SelectValue placeholder="All Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="active">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                      Active
                    </div>
                  </SelectItem>
                  <SelectItem value="invited">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 bg-orange-500 rounded-full"></div>
                      Invited
                    </div>
                  </SelectItem>
                  <SelectItem value="inactive">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 bg-gray-400 rounded-full"></div>
                      Inactive
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
              <Select
                value={roleFilter}
                onValueChange={(value) => {
                  setRoleFilter(value);
                  setCurrentPage(1);
                }}
              >
                <SelectTrigger className="w-full sm:w-36">
                  <SelectValue placeholder="All Roles" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Roles</SelectItem>
                  <SelectItem value="org_admin">
                    <div className="flex items-center gap-2">
                      <Crown className="h-3 w-3 text-yellow-600" />
                      Org_admin
                    </div>
                  </SelectItem>
                  <SelectItem value="employee">
                    <div className="flex items-center gap-2">
                      <UserCheck className="h-3 w-3 text-blue-600" />
                      Employee
                    </div>
                  </SelectItem>
                  <SelectItem value="manager">
                    <div className="flex items-center gap-2">
                      <Shield className="h-3 w-3 text-purple-600" />
                      Manager
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>

              {(searchTerm ||
                statusFilter !== "all" ||
                roleFilter !== "all") && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setSearchTerm("");
                    setStatusFilter("all");
                    setRoleFilter("all");
                    setCurrentPage(1);
                  }}
                  className="text-gray-500 hover:text-gray-700"
                >
                  Clear Filters
                </Button>
              )}
            </div>

            {/* Results Summary */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 text-sm text-gray-600">
              <div>
                Showing {filteredAndPaginatedData.users.length} of{" "}
                {filteredAndPaginatedData.totalItems} members
                {searchTerm && ` matching "${searchTerm}"`}
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                  <span>
                    {teamMembers.filter((u) => u.status === "active").length}{" "}
                    Active
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-orange-500 rounded-full"></div>
                  <span>
                    {teamMembers.filter((u) => u.status === "invited").length}{" "}
                    Invited
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-gray-400 rounded-full"></div>
                  <span>
                    {teamMembers.filter((u) => u.status === "inactive").length}{" "}
                    Inactive
                  </span>
                </div>
              </div>
            </div>
          </div>

          {filteredAndPaginatedData.users.length === 0 ? (
            <div className="text-center py-12">
              <div className="mx-auto w-24 h-24 bg-gray-100 rounded-md flex items-center justify-center mb-3">
                <Users className="h-12 w-12 text-gray-400" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                No team members added yet
              </h3>
              <p className="text-gray-600 mb-3">
                Start building your team by inviting members to collaborate.
              </p>
              <Button
                onClick={() => setInviteModalOpen(true)}
                className="bg-blue-600 hover:bg-blue-700"
              >
                <UserPlus className="h-4 w-4 mr-2" />
                Invite First Member
              </Button>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <Table className="w-full">
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead className="hidden sm:table-cell">Email</TableHead>
                      <TableHead>Role(s)</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Invited At</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredAndPaginatedData.users.map((user) => (
                      <TableRow key={user._id}>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-md flex items-center justify-center">
                              <span className="text-white text-xs font-semibold">
                                {getInitials(
                                  user?.firstName,
                                  user?.lastName,
                                  user?.email,
                                )}
                              </span>
                            </div>
                            <div>
                              <div className="font-medium text-gray-900">
                                {getDisplayName(user)}
                              </div>
                              {user.status === "invited" && (
                                <div className="text-xs text-gray-500">
                                  Pending registration
                                </div>
                              )}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="hidden sm:table-cell">
                          <div className="text-sm text-gray-900">
                            {user.email}
                          </div>
                        </TableCell>
                        <TableCell className="">
                          <div className="flex items-center gap-2">
                            {getRoleIcon(getUserRoles(user))}
                            <div className="flex flex-wrap gap-1">
                              {getUserRoles(user).map((role) => (
                                <span
                                  key={role}
                                  className={`inline-flex items-center px-2 py-1 rounded-md text-xs font-medium border ${getRoleColor(
                                    role,
                                  )}`}
                                >
                                  {role.charAt(0).toUpperCase() + role.slice(1)}
                                </span>
                              ))}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            {getStatusIcon(user.status)}
                            <span
                              className={`text-sm font-medium ${getStatusColor(
                                user.status,
                              )}`}
                            >
                              {user.status === "active"
                                ? "Active"
                                : user.status === "invited"
                                  ? "Pending"
                                  : "Inactive"}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell className="">
                          <div className="text-sm text-gray-600">
                            <div className="font-medium">
                              {getRelativeTime(
                                user.invitedAt || user.createdAt,
                              )}
                            </div>
                            {(user.invitedAt || user.createdAt) && (
                              <div className="text-xs text-gray-400">
                                {formatDate(user.invitedAt || user.createdAt)}
                              </div>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <DropdownMenu modal={false}>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="sm">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              {user.status === "invited" ? (
                                <>
                                  <DropdownMenuItem
                                    onClick={() =>
                                      resendInviteMutation.mutate(user._id)
                                    }
                                    disabled={resendInviteMutation.isPending}
                                  >
                                    <RefreshCw className="h-4 w-4 mr-2" />
                                    Resend Invite
                                  </DropdownMenuItem>
                                  <DropdownMenuItem
                                    onClick={() =>
                                      revokeInviteMutation.mutate(user._id)
                                    }
                                    disabled={revokeInviteMutation.isPending}
                                    className="text-red-600"
                                  >
                                    <UserX className="h-4 w-4 mr-2" />
                                    Revoke Invite
                                  </DropdownMenuItem>
                                </>
                              ) : (
                                <>
                                  <DropdownMenuItem
                                    onClick={() =>
                                      removeUserMutation.mutate(user._id)
                                    }
                                    disabled={removeUserMutation.isPending}
                                    className="text-red-600"
                                  >
                                    <UserX className="h-4 w-4 mr-2" />
                                    Remove User
                                  </DropdownMenuItem>
                                </>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* Enhanced Pagination Controls */}
              {filteredAndPaginatedData.totalPages > 1 && (
                <div className="flex flex-col sm:flex-row items-center justify-between pt-4 border-t gap-3">
                  <div className="text-sm text-gray-700">
                    Showing {filteredAndPaginatedData.currentStart} to{" "}
                    {filteredAndPaginatedData.currentEnd} of{" "}
                    {filteredAndPaginatedData.totalItems} members
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(currentPage - 1)}
                      disabled={!filteredAndPaginatedData.hasPrevPage}
                    >
                      <ChevronLeft className="h-4 w-4" />
                      Previous
                    </Button>

                    <div className="flex items-center gap-1">
                      {/* Smart pagination: show first page, current range, and last page */}
                      {currentPage > 2 && (
                        <>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setCurrentPage(1)}
                            className="w-8 h-8 p-0"
                          >
                            1
                          </Button>
                          {currentPage > 3 && (
                            <span className="px-2 text-gray-400">...</span>
                          )}
                        </>
                      )}

                      {Array.from(
                        {
                          length: Math.min(
                            5,
                            filteredAndPaginatedData.totalPages,
                          ),
                        },
                        (_, i) => {
                          const page =
                            Math.max(
                              1,
                              Math.min(
                                filteredAndPaginatedData.totalPages - 4,
                                currentPage - 2,
                              ),
                            ) + i;
                          if (page > filteredAndPaginatedData.totalPages)
                            return null;
                          return (
                            <Button
                              key={page}
                              variant={
                                page === currentPage ? "default" : "outline"
                              }
                              size="sm"
                              onClick={() => setCurrentPage(page)}
                              className="w-8 h-8 p-0"
                            >
                              {page}
                            </Button>
                          );
                        },
                      )}

                      {currentPage <
                        filteredAndPaginatedData.totalPages - 1 && (
                        <>
                          {currentPage <
                            filteredAndPaginatedData.totalPages - 2 && (
                            <span className="px-2 text-gray-400">...</span>
                          )}
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() =>
                              setCurrentPage(
                                filteredAndPaginatedData.totalPages,
                              )
                            }
                            className="w-8 h-8 p-0"
                          >
                            {filteredAndPaginatedData.totalPages}
                          </Button>
                        </>
                      )}
                    </div>

                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(currentPage + 1)}
                      disabled={!filteredAndPaginatedData.hasNextPage}
                    >
                      Next
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Invite Users Modal */}
      <Dialog open={inviteModalOpen} onOpenChange={setInviteModalOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-xl font-semibold text-gray-900">
              Invite Team Members
            </DialogTitle>
            <DialogDescription className="text-gray-600">
              Add new team members to your organization. Each member will
              receive an email invitation.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 pt-6">
            {inviteUsers.map((user, index) => (
              <div
                key={index}
                className="bg-gray-50 border border-gray-200 rounded-md p-4 space-y-3"
              >
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-md flex items-center justify-center">
                      <span className="text-white font-semibold text-sm">
                        {index + 1}
                      </span>
                    </div>
                    <div>
                      <h4 className="font-medium text-gray-900">
                        Team Member {index + 1}
                      </h4>
                      <p className="text-sm text-gray-600">
                        Enter details for the new team member
                      </p>
                    </div>
                  </div>
                  {inviteUsers.length > 1 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => removeInviteUser(index)}
                      className="text-red-600 hover:text-red-800 hover:bg-red-50"
                    >
                      <UserX className="h-4 w-4" />
                    </Button>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      First Name
                    </label>
                    <Input
                      placeholder="Enter first name"
                      value={user.firstName}
                      onChange={(e) =>
                        updateInviteUser(index, "firstName", e.target.value)
                      }
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Last Name
                    </label>
                    <Input
                      placeholder="Enter last name"
                      value={user.lastName}
                      onChange={(e) =>
                        updateInviteUser(index, "lastName", e.target.value)
                      }
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Email Address *
                  </label>
                  <Input
                    type="email"
                    placeholder="Enter email address"
                    value={user.email}
                    onChange={(e) =>
                      updateInviteUser(index, "email", e.target.value)
                    }
                    className="w-full"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Role
                  </label>
                  <Select
                    value={user.roles[0]}
                    onValueChange={(value) =>
                      updateInviteUser(index, "roles", [value])
                    }
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select role" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="admin">Admin</SelectItem>
                      <SelectItem value="employee">Employee</SelectItem>
                      <SelectItem value="member">Member</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            ))}

            <div className="flex flex-col sm:flex-row gap-3">
              <Button
                variant="outline"
                onClick={addInviteUser}
                className="flex-1"
              >
                <UserPlus className="h-4 w-4 mr-2" />
                Add Another Member
              </Button>
              <Button
                onClick={handleInviteSubmit}
                disabled={inviteUsersMutation.isPending}
                className="flex-1 bg-blue-600 hover:bg-blue-700"
              >
                {inviteUsersMutation.isPending
                  ? "Sending..."
                  : "Send Invitations"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
