import { useState, useEffect } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Building2,
  Users,
  Settings,
  BarChart3,
  Shield,
  Plus,
  User,
  Package,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import ProfileWidget from "@/components/profile/ProfileWidget";
import LicensePlansManagement from "@/components/super-admin/LicensePlansManagement";

export default function SuperAdminDashboard() {
  // Get tab from URL parameter
  const urlParams = new URLSearchParams(window.location.search);
  const tabFromUrl = urlParams.get("tab") || "overview";
  const [activeTab, setActiveTab] = useState(tabFromUrl);

  // Mock data until backend APIs are implemented
  const platformStats = {
    totalOrganizations: 12,
    newOrganizationsThisMonth: 3,
    totalUsers: 456,
    newUsersThisMonth: 23,
    activeOrganizations: 10,
    organizationGrowthRate: 15,
    revenue: 45678,
    revenueGrowth: 12,
  };

  const organizations = {
    data: [],
  };

  const systemLogs = {
    data: [],
  };

  // Uncomment when backend APIs are ready
  // const { data: platformStats } = useQuery({
  //   queryKey: ['/api/superadmin/platform-stats'],
  //   enabled: false
  // });

  // const { data: organizations } = useQuery({
  //   queryKey: ['/api/superadmin/organizations'],
  //   enabled: false
  // });

  // const { data: systemLogs } = useQuery({
  //   queryKey: ['/api/superadmin/system-logs'],
  //   enabled: false
  // });

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="border-b bg-white dark:bg-gray-800">
        <div className="flex h-16 items-center px-6">
          <Shield className="h-6 w-6 text-blue-600 mr-3" />
          <h1 className="text-xl font-semibold text-gray-900 dark:text-white">
            Super Admin Dashboard
          </h1>
          <Badge variant="outline" className="ml-3">
            Platform Management
          </Badge>
        </div>
      </div>

      <div className="p-4">
        <Tabs
          value={activeTab}
          onValueChange={setActiveTab}
          className="space-y-3"
        >
          <TabsList className="grid w-full grid-cols-6">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="organizations">Organizations</TabsTrigger>
            <TabsTrigger value="users">Users</TabsTrigger>
            <TabsTrigger value="license-plans">
              <Package className="h-4 w-4 mr-2" />
              License Plans
            </TabsTrigger>
            <TabsTrigger value="system">System</TabsTrigger>
            <TabsTrigger value="profile">Profile</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-3">
            <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">
                    Total Organizations
                  </CardTitle>
                  <Building2 className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {platformStats?.totalOrganizations || 0}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    +{platformStats?.newOrganizationsThisMonth || 0} this month
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">
                    Total Users
                  </CardTitle>
                  <Users className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {platformStats?.totalUsers || 0}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    +{platformStats?.newUsersThisMonth || 0} this month
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">
                    Active Organizations
                  </CardTitle>
                  <BarChart3 className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {platformStats?.activeOrganizations || 0}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {platformStats?.organizationGrowthRate || 0}% growth
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">
                    System Health
                  </CardTitle>
                  <Settings className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-green-600">
                    Healthy
                  </div>
                  <p className="text-xs text-muted-foreground">99.9% uptime</p>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Recent System Activity</CardTitle>
                <CardDescription>
                  Latest platform events and changes
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {systemLogs?.data?.length > 0 ? (
                    systemLogs.data.slice(0, 5).map((log, index) => (
                      <div
                        key={index}
                        className="flex items-center justify-between border-b pb-2"
                      >
                        <div>
                          <p className="text-sm font-medium">{log.action}</p>
                          <p className="text-xs text-muted-foreground">
                            {log.details}
                          </p>
                        </div>
                        <Badge variant="outline">{log.timestamp}</Badge>
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      No recent activity
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="organizations" className="space-y-3">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-medium">Organization Management</h3>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Create Organization
              </Button>
            </div>

            <div className="grid gap-3">
              {organizations?.data?.length > 0 ? (
                organizations.data.map((org) => (
                  <Card key={org._id}>
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-3">
                          <div className="w-10 h-10 bg-blue-100 rounded-sm flex items-center justify-center">
                            <Building2 className="h-5 w-5 text-blue-600" />
                          </div>
                          <div>
                            <h4 className="font-medium">{org.name}</h4>
                            <p className="text-sm text-muted-foreground">
                              {org.userCount || 0} users • Created{" "}
                              {org.createdAt}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center space-x-2">
                          <Badge
                            variant={org.isActive ? "default" : "secondary"}
                          >
                            {org.isActive ? "Active" : "Inactive"}
                          </Badge>
                          <Button variant="outline" size="sm">
                            Manage
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))
              ) : (
                <Card>
                  <CardContent className="p-4 text-center">
                    <p className="text-muted-foreground">
                      No organizations found
                    </p>
                  </CardContent>
                </Card>
              )}
            </div>
          </TabsContent>

          <TabsContent value="users" className="space-y-3">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-medium">User Management</h3>
              <Button variant="outline">Export Users</Button>
            </div>

            <Card>
              <CardContent className="p-4">
                <p className="text-center text-muted-foreground">
                  User management interface will be implemented here
                </p>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="license-plans" className="space-y-3">
            <LicensePlansManagement />
          </TabsContent>

          <TabsContent value="system" className="space-y-3">
            <div className="grid gap-3 md:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle>System Settings</CardTitle>
                  <CardDescription>Platform-wide configuration</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <Button variant="outline" className="w-full">
                    Email Configuration
                  </Button>
                  <Button variant="outline" className="w-full">
                    Security Settings
                  </Button>
                  <Button variant="outline" className="w-full">
                    Feature Flags
                  </Button>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Database Status</CardTitle>
                  <CardDescription>
                    MongoDB connection and health
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-sm">Connection Status</span>
                      <Badge className="bg-green-100 text-green-800">
                        Connected
                      </Badge>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm">Total Collections</span>
                      <span className="text-sm font-medium">12</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm">Storage Used</span>
                      <span className="text-sm font-medium">2.4 GB</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="profile" className="space-y-3">
            <ProfileWidget />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
