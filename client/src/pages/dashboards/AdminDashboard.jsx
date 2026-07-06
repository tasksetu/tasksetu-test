import { useState } from "react";
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Building2,
  Users,
  Settings,
  BarChart3,
  UserPlus,
  Mail,
  Trash2,
  Crown,
  User,
  AlertCircle,
} from "lucide-react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import ProfileWidget from "@/components/profile/ProfileWidget";

export default function AdminDashboard() {
  const [activeTab, setActiveTab] = useState("overview");
  const [inviteDialogOpen, setInviteDialogOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("employee");
  const [emailError, setEmailError] = useState("");
  const [isCheckingEmail, setIsCheckingEmail] = useState(false);
  const { toast } = useToast();

  // Check if email has already been invited
  const checkExistingInvitation = async (email) => {
    if (!email.trim()) {
      setEmailError("");
      return;
    }

    setIsCheckingEmail(true);
    setEmailError("");

    try {
      const token = localStorage.getItem("token");
      if (!token) {
        throw new Error("Authentication token not found");
      }

      const response = await fetch("/api/organization/check-invitation", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ email: email.trim() }),
      });

      let data;
      try {
        data = await response.json();
      } catch (parseError) {
        throw new Error("Invalid response from server");
      }

      if (!response.ok) {
        throw new Error(data.message || `Server error: ${response.status}`);
      }

      if (data.exists) {
        setEmailError(data.message);
      }
    } catch (error) {
      console.error("Error checking invitation:", error);
      setEmailError(`Unable to verify email: ${error.message}`);
    } finally {
      setIsCheckingEmail(false);
    }
  };

  const { data: orgStats } = useQuery({
    queryKey: ["/api/admin/organization-stats"],
    enabled: true,
  });

  const { data: orgUsers } = useQuery({
    queryKey: ["/api/admin/users"],
    enabled: true,
  });

  const { data: orgProjects } = useQuery({
    queryKey: ["/api/admin/projects"],
    enabled: true,
  });

  const { data: orgTasks } = useQuery({
    queryKey: ["/api/admin/tasks"],
    enabled: true,
  });

  const inviteUserMutation = useMutation({
    mutationFn: async (data) => {
      return await apiRequest("POST", "/api/admin/invite-user", data);
    },
    onSuccess: () => {
      toast({
        title: "Invitation sent",
        description: "User invitation has been sent successfully.",
        duration: 5000,
      });
      setInviteDialogOpen(false);
      setInviteEmail("");
      setInviteRole("employee");
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
    },
    onError: (error) => {
      toast({
        title: "Failed to send invitation",
        description:
          error.message || "An error occurred while sending the invitation.",
        variant: "destructive",
        duration: 5000,
      });
    },
  });

  const handleInviteUser = () => {
    if (!inviteEmail.trim()) {
      toast({
        title: "Email required",
        description: "Please enter a valid email address.",
        variant: "destructive",
        duration: 5000,
      });
      return;
    }

    inviteUserMutation.mutate({
      email: inviteEmail,
      role: inviteRole,
    });
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="border-b bg-white dark:bg-gray-800">
        <div className="flex h-16 items-center justify-between px-6">
          <div className="flex items-center">
            <Crown className="h-6 w-6 text-orange-600 mr-3" />
            <h1 className="text-xl font-semibold text-gray-900 dark:text-white">
              Organization Dashboard
            </h1>
            <Badge variant="outline" className="ml-3">
              Admin Access
            </Badge>
          </div>

          <Dialog open={inviteDialogOpen} onOpenChange={setInviteDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <UserPlus className="h-4 w-4 mr-2" />
                Invite User
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Invite New User</DialogTitle>
                <DialogDescription>
                  Send an invitation to a new team member to join your
                  organization.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-3 py-4">
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <div className="relative">
                    <Input
                      id="email"
                      type="email"
                      placeholder="user@example.com"
                      value={inviteEmail}
                      onChange={(e) => {
                        setInviteEmail(e.target.value);
                        if (emailError) setEmailError("");
                      }}
                      onBlur={(e) => checkExistingInvitation(e.target.value)}
                      disabled={isCheckingEmail}
                      className={
                        emailError
                          ? "border-red-300 focus:border-red-400 focus:ring-red-200"
                          : ""
                      }
                    />
                    {isCheckingEmail && (
                      <div className="absolute inset-y-0 right-0 pr-3 flex items-center">
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-slate-400"></div>
                      </div>
                    )}
                  </div>
                  {emailError && (
                    <div className="bg-red-50 border border-red-200 rounded-md p-2 mt-1">
                      <p className="text-sm text-red-700 flex items-center">
                        <AlertCircle className="h-3 w-3 mr-1 text-red-500" />
                        {emailError}
                      </p>
                    </div>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="role">Role</Label>
                  <Select value={inviteRole} onValueChange={setInviteRole}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="employee">Employee</SelectItem>
                      <SelectItem value="admin">Admin</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => setInviteDialogOpen(false)}
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleInviteUser}
                  disabled={inviteUserMutation.isPending}
                >
                  {inviteUserMutation.isPending
                    ? "Sending..."
                    : "Send Invitation"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="p-4">
        <Tabs
          value={activeTab}
          onValueChange={setActiveTab}
          className="space-y-3"
        >
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="users">Team</TabsTrigger>
            <TabsTrigger value="projects">Projects</TabsTrigger>
            <TabsTrigger value="settings">Settings</TabsTrigger>
            <TabsTrigger value="profile">Profile</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-3">
            <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">
                    Team Members
                  </CardTitle>
                  <Users className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {orgStats?.totalUsers || 0}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    +{orgStats?.newUsersThisMonth || 0} this month
                  </p>
                </CardContent>
              </Card>

              {/* <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Active Projects</CardTitle>
                  <Building2 className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{orgStats?.activeProjects || 0}</div>
                  <p className="text-xs text-muted-foreground">
                    {orgStats?.completedProjects || 0} completed
                  </p>
                </CardContent>
              </Card> */}

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">
                    Tasks This Month
                  </CardTitle>
                  <BarChart3 className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {orgStats?.tasksThisMonth || 0}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {orgStats?.completedTasksThisMonth || 0} completed
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">
                    Team Productivity
                  </CardTitle>
                  <Settings className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {orgStats?.productivityScore || 85}%
                  </div>
                  <p className="text-xs text-muted-foreground">
                    +{orgStats?.productivityGrowth || 5}% from last month
                  </p>
                </CardContent>
              </Card>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle>Recent Project Activity</CardTitle>
                  <CardDescription>
                    Latest updates from your projects
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {orgProjects?.slice(0, 3).map((project) => (
                      <div
                        key={project._id}
                        className="flex items-center justify-between border-b pb-2"
                      >
                        <div>
                          <p className="text-sm font-medium">{project.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {project.status}
                          </p>
                        </div>
                        <Badge variant="outline">{project.updatedAt}</Badge>
                      </div>
                    )) || (
                        <p className="text-sm text-muted-foreground">
                          No recent project activity
                        </p>
                      )}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Team Performance</CardTitle>
                  <CardDescription>
                    Individual team member progress
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {orgUsers?.slice(0, 3).map((user) => (
                      <div
                        key={user._id}
                        className="flex items-center justify-between border-b pb-2"
                      >
                        <div className="flex items-center space-x-3">
                          <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                            <span className="text-xs font-medium text-blue-600">
                              {user.firstName?.[0]}
                              {user.lastName?.[0]}
                            </span>
                          </div>
                          <div>
                            <p className="text-sm font-medium">
                              {user.firstName} {user.lastName}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {user.role}
                            </p>
                          </div>
                        </div>
                        <Badge variant="outline">
                          {user.tasksCompleted || 0} tasks
                        </Badge>
                      </div>
                    )) || (
                        <p className="text-sm text-muted-foreground">
                          No team members found
                        </p>
                      )}
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="users" className="space-y-3">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-medium">Team Management</h3>
              <Button onClick={() => setInviteDialogOpen(true)}>
                <UserPlus className="h-4 w-4 mr-2" />
                Invite User
              </Button>
            </div>

            <div className="grid gap-3">
              {orgUsers?.map((user) => (
                <Card key={user._id}>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                          <span className="text-sm font-medium text-blue-600">
                            {user.firstName?.[0]}
                            {user.lastName?.[0]}
                          </span>
                        </div>
                        <div>
                          <h4 className="font-medium">
                            {user.firstName} {user.lastName}
                          </h4>
                          <p className="text-sm text-muted-foreground">
                            {user.email}
                          </p>
                          <div className="flex items-center space-x-2 mt-1">
                            <Badge variant="outline">{user.role}</Badge>
                            {user.status && (
                              <Badge
                                variant={
                                  user.status === "active"
                                    ? "default"
                                    : "secondary"
                                }
                              >
                                {user.status}
                              </Badge>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Button variant="outline" size="sm">
                          <Mail className="h-4 w-4 mr-1" />
                          Contact
                        </Button>
                        <Button variant="outline" size="sm">
                          Edit
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )) || (
                  <Card>
                    <CardContent className="p-4 text-center">
                      <p className="text-muted-foreground">
                        No team members found
                      </p>
                    </CardContent>
                  </Card>
                )}
            </div>
          </TabsContent>

          <TabsContent value="projects" className="space-y-3">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-medium">Project Management</h3>
              <Button>Create Project</Button>
            </div>

            <div className="grid gap-3">
              {orgProjects?.map((project) => (
                <Card key={project._id}>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="font-medium">{project.name}</h4>
                        <p className="text-sm text-muted-foreground">
                          {project.description}
                        </p>
                        <div className="flex items-center space-x-2 mt-2">
                          <Badge variant="outline">{project.status}</Badge>
                          <span className="text-xs text-muted-foreground">
                            {project.taskCount || 0} tasks
                          </span>
                        </div>
                      </div>
                      <Button variant="outline" size="sm">
                        Manage
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )) || (
                  <Card>
                    <CardContent className="p-4 text-center">
                      <p className="text-muted-foreground">No projects found</p>
                    </CardContent>
                  </Card>
                )}
            </div>
          </TabsContent>

          <TabsContent value="settings" className="space-y-3">
            <div className="grid gap-3 md:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle>Organization Settings</CardTitle>
                  <CardDescription>
                    Manage your organization preferences
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <Button variant="outline" className="w-full">
                    Organization Profile
                  </Button>
                  <Button variant="outline" className="w-full">
                    Team Permissions
                  </Button>
                  <Button variant="outline" className="w-full">
                    Notification Settings
                  </Button>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Subscription & Billing</CardTitle>
                  <CardDescription>
                    Manage your subscription plan
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-sm">Current Plan</span>
                    <Badge>Pro Plan</Badge>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm">Users</span>
                    <span className="text-sm font-medium">
                      {orgStats?.totalUsers || 0} / 50
                    </span>
                  </div>
                  <Button variant="outline" className="w-full">
                    Upgrade Plan
                  </Button>
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
