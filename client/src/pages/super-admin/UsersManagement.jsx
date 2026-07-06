import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import {
  Users,
  Shield,
  Building2,
  Mail,
  Calendar,
  Search,
  Filter,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";

export default function UsersManagement() {
  const [, navigate] = useLocation();
  const {
    data: users = [],
    isLoading,
    error,
  } = useQuery({
    queryKey: ["/api/super-admin/users"],
    retry: false,
  });
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [companyFilter, setCompanyFilter] = useState("all");

  // Debug logging
  console.log("=== USERS MANAGEMENT DEBUG ===");
  console.log("Users data:", users);
  console.log("Users length:", users?.length);
  console.log("Loading state:", isLoading);
  console.log("Error state:", error);
  console.log("Auth token exists:", !!localStorage.getItem("token"));

  const handleAssignAdmin = async (userId, companyId) => {
    try {
      // This would be implemented when admin assignment functionality is needed
      toast({
        title: "Info",
        description: "Admin assignment functionality coming soon",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to assign admin role",
        variant: "destructive",
      });
    }
  };

  const filteredUsers =
    users?.filter((user) => {
      const orgName =
        user.organization_id?.name ||
        user.organizationId?.name ||
        user.organizationId;
      const matchesSearch =
        user.firstName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        user.lastName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        user.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        orgName?.toLowerCase().includes(searchTerm.toLowerCase());

      // Get user's role - handle both string and array
      const userRole = Array.isArray(user.role) ? user.role[0] : user.role;

      const matchesRole = roleFilter === "all" || userRole === roleFilter;

      // Company filter: match by organization_id.name (dropdown value is name)
      const matchesCompany =
        companyFilter === "all" || orgName === companyFilter;

      return matchesSearch && matchesRole && matchesCompany;
    }) || [];

  // Build unique, sorted company list with name (for filter)
  const companies = React.useMemo(() => {
    const nameSet = new Set();
    users?.forEach((u) => {
      const orgName =
        u.organization_id?.name || u.organizationId?.name || u.organizationId;
      if (orgName) nameSet.add(orgName);
    });
    return Array.from(nameSet).sort((a, b) => a.localeCompare(b));
  }, [users]);

  const getRoleBadge = (role) => {
    // Handle both string and array roles
    const roleStr = Array.isArray(role) ? role[0] : role;
    const styles = {
      super_admin: "bg-red-100 text-red-800",
      org_admin: "bg-blue-100 text-blue-800",
      admin: "bg-blue-100 text-blue-800",
      manager: "bg-purple-100 text-purple-800",
      employee: "bg-green-100 text-green-800",
      individual: "bg-gray-100 text-gray-800",
    };
    return styles[roleStr] || styles.individual;
  };

  const getRoleLabel = (role) => {
    // Handle both string and array roles
    const roleStr = Array.isArray(role) ? role[0] : role;
    const labels = {
      super_admin: "Super Admin",
      org_admin: "Org Admin",
      admin: "Admin",
      manager: "Manager",
      employee: "Employee",
      individual: "Individual",
    };
    return labels[roleStr] || "User";
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 p-7">
        <div className="animate-pulse space-y-3">
          <div className="space-y-3">
            <div className="h-10 bg-gray-300 rounded-sm w-1/3"></div>
            <div className="h-6 bg-gray-200 rounded-sm w-1/2"></div>
          </div>
          <div className="h-96 bg-gray-100 rounded-sm"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-3">
          <div className="p-3 bg-green-100 rounded-sm border border-green-200">
            <Users className="h-7 w-7 text-green-700" />
          </div>
          <div>
            <h1 className="text-4xl font-bold text-gray-900">
              Users Management
            </h1>
            <p className="text-base text-gray-600 mt-1 flex items-center gap-2">
              <span className="w-2 h-2 bg-gray-400 rounded-full"></span>
              View and manage all users across the platform
            </p>
          </div>
        </div>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3 my-3">
        <div className="bg-white rounded-sm border border-gray-200 p-4">
          <div className="text-center">
            <p className="text-2xl font-bold text-gray-900">
              {filteredUsers.length}
            </p>
            <p className="text-sm text-gray-600">Filtered Users</p>
          </div>
        </div>
        <div className="bg-white rounded-sm border border-gray-200 p-4">
          <div className="text-center">
            <p className="text-2xl font-bold text-red-600">
              {
                filteredUsers.filter((u) => {
                  const role = Array.isArray(u.role) ? u.role[0] : u.role;
                  return role === "super_admin";
                }).length
              }
            </p>
            <p className="text-sm text-gray-600">Super Admins</p>
          </div>
        </div>
        <div className="bg-white rounded-sm border border-gray-200 p-4">
          <div className="text-center">
            <p className="text-2xl font-bold text-blue-600">
              {
                filteredUsers.filter((u) => {
                  const role = Array.isArray(u.role) ? u.role[0] : u.role;
                  return role === "org_admin" || role === "admin";
                }).length
              }
            </p>
            <p className="text-sm text-gray-600">Org Admins</p>
          </div>
        </div>
        <div className="bg-white rounded-sm border border-gray-200 p-4">
          <div className="text-center">
            <p className="text-2xl font-bold text-green-600">
              {filteredUsers.filter((u) => u.status === "active").length}
            </p>
            <p className="text-sm text-gray-600">Active Users</p>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-sm border border-gray-200 p-4 mb-3">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search users by name, email, or company..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full h-9 pl-10 pr-4 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
            />
          </div>
          <div className="flex gap-2">
            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              className="h-9 px-3 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="all">All Roles</option>
              <option value="super_admin">Super Admin</option>
              <option value="org_admin">Org Admin</option>
              {/* <option value="admin">Admin</option> */}
              <option value="manager">Manager</option>
              <option value="employee">Employee</option>
              <option value="individual">Individual</option>
            </select>
            <select
              value={companyFilter}
              onChange={(e) => setCompanyFilter(e.target.value)}
              className="h-9 px-3 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="all">All Companies</option>
              {companies.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Users List */}
      <div className="bg-white rounded-sm border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  User
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Company
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Role
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Joined
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filteredUsers.map((user) => (
                <tr key={user._id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center text-white text-sm font-medium">
                        {user.firstName?.[0]}
                        {user.lastName?.[0]}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-900">
                          {user.firstName} {user.lastName}
                        </p>
                        <p className="text-sm text-gray-500 flex items-center gap-1">
                          <Mail className="h-3 w-3" />
                          {user.email}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <Building2 className="h-4 w-4 text-gray-400" />
                      <span className="text-sm text-gray-900">
                        {user.organizationId?.name || "No Company"}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getRoleBadge(user.role)}`}
                    >
                      {getRoleLabel(user.role)}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                        user.status === "active"
                          ? "bg-green-100 text-green-800"
                          : "bg-red-100 text-red-800"
                      }`}
                    >
                      {user.status === "active"
                        ? "Active"
                        : user.status || "Inactive"}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2 text-sm text-gray-500">
                      <Calendar className="h-4 w-4" />
                      {new Date(user.createdAt).toLocaleDateString()}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      {/* {user.role !== 'super_admin' && user.role !== 'admin' && user.organizationId && (
                        <Button
                          variant="outline"
                          onClick={() => handleAssignAdmin(user._id, user.organizationId._id)}
                          className="h-7 px-2 text-xs bg-blue-100 text-blue-700 hover:bg-blue-200"
                        >
                          <Shield className="h-3 w-3" />
                          Make Admin
                        </Button>
                      )} */}
                      <Button
                        variant="primary"
                        className="h-7 px-2 text-xs"
                        onClick={() =>
                          navigate(`/super-admin/users/${user._id}`)
                        }
                      >
                        View Profile
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {filteredUsers.length === 0 && !isLoading && (
        <div className="text-center py-12">
          <Users className="h-12 w-12 text-gray-400 mx-auto mb-3" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">
            No users found
          </h3>
          <p className="text-gray-600">
            {users.length === 0
              ? "No users have been registered yet."
              : "No users match your current filters."}
          </p>
          {users.length === 0 && (
            <div className="mt-4 text-sm text-gray-500">
              Users will appear here once they register or are invited to
              organizations.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
