import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { Mail, Calendar, Check, X, RefreshCw, Settings, Inbox } from 'lucide-react';
import EmailToTask from '../../components/admin/EmailToTask';

export default function Integrations() {
  const { toast } = useToast();
  const [emailConfig, setEmailConfig] = useState({
    type: 'gmail',
    credentials: {}
  });
  const [calendarConfig, setCalendarConfig] = useState({
    type: 'google',
    credentials: {}
  });

  // Fetch integration status
  const { data: status, isLoading: statusLoading } = useQuery({
    queryKey: ['/api/integrations/status'],
    refetchInterval: 30000 // Refresh every 30 seconds
  });

  // Email setup mutation
  const emailSetupMutation = useMutation({
    mutationFn: async (config) => {
      return await apiRequest('/api/integrations/email/setup', {
        method: 'POST',
        body: config
      });
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Email integration configured successfully"
      });
      queryClient.invalidateQueries({ queryKey: ['/api/integrations/status'] });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to configure email integration",
        variant: "destructive"
      });
    }
  });

  // Calendar setup mutation
  const calendarSetupMutation = useMutation({
    mutationFn: async (config) => {
      return await apiRequest('/api/integrations/calendar/setup', {
        method: 'POST',
        body: config
      });
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Calendar integration configured successfully"
      });
      queryClient.invalidateQueries({ queryKey: ['/api/integrations/status'] });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to configure calendar integration",
        variant: "destructive"
      });
    }
  });

  // Email sync mutation
  const emailSyncMutation = useMutation({
    mutationFn: async (method) => {
      return await apiRequest('/api/integrations/email/sync', {
        method: 'POST',
        body: { method }
      });
    },
    onSuccess: (data) => {
      toast({
        title: "Email Sync Complete",
        description: `Processed ${data.emailsProcessed} emails, created ${data.tasksCreated} tasks`
      });
    },
    onError: (error) => {
      toast({
        title: "Sync Failed",
        description: error.message || "Failed to sync emails",
        variant: "destructive"
      });
    }
  });

  // Calendar sync mutation
  const calendarSyncMutation = useMutation({
    mutationFn: async (sources) => {
      return await apiRequest('/api/integrations/calendar/sync', {
        method: 'POST',
        body: { sources }
      });
    },
    onSuccess: (data) => {
      toast({
        title: "Calendar Sync Complete",
        description: `Processed ${data.eventsProcessed} events, created ${data.tasksCreated} tasks`
      });
    },
    onError: (error) => {
      toast({
        title: "Sync Failed",
        description: error.message || "Failed to sync calendar events",
        variant: "destructive"
      });
    }
  });

  const handleEmailSetup = () => {
    emailSetupMutation.mutate(emailConfig);
  };

  const handleCalendarSetup = () => {
    calendarSetupMutation.mutate(calendarConfig);
  };

  const handleEmailSync = (method = 'gmail') => {
    emailSyncMutation.mutate(method);
  };

  const handleCalendarSync = (sources = ['google']) => {
    calendarSyncMutation.mutate(sources);
  };

  const StatusBadge = ({ connected, label }) => (
    <Badge
      variant={connected ? "default" : "secondary"}
      className={`flex items-center gap-1 font-semibold ${connected
        ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200 border-green-300 dark:border-green-700'
        : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200 border-red-300 dark:border-red-700'
        }`}
    >
      {connected ? <Check className="w-3 h-3" /> : <X className="w-3 h-3" />}
      {label} {connected ? 'Connected' : 'Not Connected'}
    </Badge>
  );

  if (statusLoading) {
    return (
      <div className="p-4">
        <div className="flex items-center justify-center h-64">
          <RefreshCw className="w-8 h-8 animate-spin" />
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-3">
      <div className="flex items-center gap-3">
        <Settings className="w-8 h-8 text-blue-600 dark:text-blue-400" />
        <div>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white">Integrations</h1>
          <p className="text-slate-600 dark:text-slate-300 font-medium">Connect your email and calendar to automatically create tasks</p>
        </div>
      </div>

      <Alert className="border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-950">
        <Mail className="w-4 h-4 text-blue-600 dark:text-blue-400" />
        <AlertDescription className="text-slate-700 dark:text-slate-200 font-medium">
          Email and calendar integrations automatically convert your emails and calendar events into actionable tasks.
          Configure your credentials below to get started.
        </AlertDescription>
      </Alert>

      {/* Status Overview */}
      <Card className="border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-lg">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-slate-900 dark:text-white">
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
            Integration Status
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <StatusBadge connected={status?.email?.gmail} label="Gmail" />
            <StatusBadge connected={status?.email?.imap} label="IMAP" />
            <StatusBadge connected={status?.calendar?.googleCalendar} label="Google Calendar" />
            <StatusBadge connected={status?.calendar?.outlook} label="Outlook" />
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="email-to-task" className="space-y-3">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="email-to-task" className="flex items-center gap-2">
            <Inbox className="w-4 h-4" />
            Email to Task
          </TabsTrigger>
          <TabsTrigger value="email" className="flex items-center gap-2">
            <Mail className="w-4 h-4" />
            Email Integration
          </TabsTrigger>
          <TabsTrigger value="calendar" className="flex items-center gap-2">
            <Calendar className="w-4 h-4" />
            Calendar Integration
          </TabsTrigger>
        </TabsList>

        {/* Email to Task Tab */}
        <TabsContent value="email-to-task" className="space-y-3">
          <EmailToTask />
        </TabsContent>

        <TabsContent value="email" className="space-y-3">
          <div className="grid gap-3 md:grid-cols-2">
            {/* Gmail Setup */}
            <Card className="border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-lg">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-slate-900 dark:text-white">
                  <Mail className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                  Gmail Integration
                </CardTitle>
                <CardDescription className="text-slate-600 dark:text-slate-300 font-medium">
                  Connect your Gmail account to automatically convert emails into tasks
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="space-y-2">
                  <Label htmlFor="gmail-client-id">Client ID</Label>
                  <Input
                    id="gmail-client-id"
                    placeholder="Your Gmail OAuth Client ID"
                    value={emailConfig.credentials.clientId || ''}
                    onChange={(e) => setEmailConfig(prev => ({
                      ...prev,
                      type: 'gmail',
                      credentials: { ...prev.credentials, clientId: e.target.value }
                    }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="gmail-client-secret">Client Secret</Label>
                  <Input
                    id="gmail-client-secret"
                    type="password"
                    placeholder="Your Gmail OAuth Client Secret"
                    value={emailConfig.credentials.clientSecret || ''}
                    onChange={(e) => setEmailConfig(prev => ({
                      ...prev,
                      type: 'gmail',
                      credentials: { ...prev.credentials, clientSecret: e.target.value }
                    }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="gmail-refresh-token">Refresh Token</Label>
                  <Input
                    id="gmail-refresh-token"
                    type="password"
                    placeholder="Your Gmail Refresh Token"
                    value={emailConfig.credentials.refreshToken || ''}
                    onChange={(e) => setEmailConfig(prev => ({
                      ...prev,
                      type: 'gmail',
                      credentials: { ...prev.credentials, refreshToken: e.target.value }
                    }))}
                  />
                </div>
                <Button
                  onClick={handleEmailSetup}
                  disabled={emailSetupMutation.isPending}
                  className="w-full"
                >
                  {emailSetupMutation.isPending ? <RefreshCw className="w-4 h-4 animate-spin mr-2" /> : null}
                  Configure Gmail
                </Button>
                {status?.email?.gmail && (
                  <Button
                    onClick={() => handleEmailSync('gmail')}
                    disabled={emailSyncMutation.isPending}
                    variant="outline"
                    className="w-full"
                  >
                    {emailSyncMutation.isPending ? <RefreshCw className="w-4 h-4 animate-spin mr-2" /> : null}
                    Sync Gmail Now
                  </Button>
                )}
              </CardContent>
            </Card>

            {/* IMAP Setup */}
            <Card className="border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-lg">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-slate-900 dark:text-white">
                  <Mail className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                  IMAP Integration
                </CardTitle>
                <CardDescription className="text-slate-600 dark:text-slate-300 font-medium">
                  Connect any IMAP email server to convert emails into tasks
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="space-y-2">
                  <Label htmlFor="imap-host">IMAP Host</Label>
                  <Input
                    id="imap-host"
                    placeholder="imap.yourdomain.com"
                    value={emailConfig.credentials.host || ''}
                    onChange={(e) => setEmailConfig(prev => ({
                      ...prev,
                      type: 'imap',
                      credentials: { ...prev.credentials, host: e.target.value }
                    }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="imap-port">Port</Label>
                  <Input
                    id="imap-port"
                    type="number"
                    placeholder="993"
                    value={emailConfig.credentials.port || ''}
                    onChange={(e) => setEmailConfig(prev => ({
                      ...prev,
                      type: 'imap',
                      credentials: { ...prev.credentials, port: parseInt(e.target.value) }
                    }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="imap-user">Username</Label>
                  <Input
                    id="imap-user"
                    placeholder="your-email@domain.com"
                    value={emailConfig.credentials.user || ''}
                    onChange={(e) => setEmailConfig(prev => ({
                      ...prev,
                      type: 'imap',
                      credentials: { ...prev.credentials, user: e.target.value }
                    }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="imap-password">Password</Label>
                  <Input
                    id="imap-password"
                    type="password"
                    placeholder="Your email password"
                    value={emailConfig.credentials.password || ''}
                    onChange={(e) => setEmailConfig(prev => ({
                      ...prev,
                      type: 'imap',
                      credentials: { ...prev.credentials, password: e.target.value }
                    }))}
                  />
                </div>
                <Button
                  onClick={handleEmailSetup}
                  disabled={emailSetupMutation.isPending}
                  className="w-full"
                >
                  {emailSetupMutation.isPending ? <RefreshCw className="w-4 h-4 animate-spin mr-2" /> : null}
                  Configure IMAP
                </Button>
                {status?.email?.imap && (
                  <Button
                    onClick={() => handleEmailSync('imap')}
                    disabled={emailSyncMutation.isPending}
                    variant="outline"
                    className="w-full"
                  >
                    {emailSyncMutation.isPending ? <RefreshCw className="w-4 h-4 animate-spin mr-2" /> : null}
                    Sync IMAP Now
                  </Button>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="calendar" className="space-y-3">
          <div className="grid gap-3 md:grid-cols-2">
            {/* Google Calendar Setup */}
            <Card className="border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-lg">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-slate-900 dark:text-white">
                  <Calendar className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                  Google Calendar Integration
                </CardTitle>
                <CardDescription className="text-slate-600 dark:text-slate-300 font-medium">
                  Connect your Google Calendar to automatically convert events into tasks
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="space-y-2">
                  <Label htmlFor="gcal-client-id">Client ID</Label>
                  <Input
                    id="gcal-client-id"
                    placeholder="Your Google Calendar OAuth Client ID"
                    value={calendarConfig.credentials.clientId || ''}
                    onChange={(e) => setCalendarConfig(prev => ({
                      ...prev,
                      type: 'google',
                      credentials: { ...prev.credentials, clientId: e.target.value }
                    }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="gcal-client-secret">Client Secret</Label>
                  <Input
                    id="gcal-client-secret"
                    type="password"
                    placeholder="Your Google Calendar OAuth Client Secret"
                    value={calendarConfig.credentials.clientSecret || ''}
                    onChange={(e) => setCalendarConfig(prev => ({
                      ...prev,
                      type: 'google',
                      credentials: { ...prev.credentials, clientSecret: e.target.value }
                    }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="gcal-refresh-token">Refresh Token</Label>
                  <Input
                    id="gcal-refresh-token"
                    type="password"
                    placeholder="Your Google Calendar Refresh Token"
                    value={calendarConfig.credentials.refreshToken || ''}
                    onChange={(e) => setCalendarConfig(prev => ({
                      ...prev,
                      type: 'google',
                      credentials: { ...prev.credentials, refreshToken: e.target.value }
                    }))}
                  />
                </div>
                <Button
                  onClick={handleCalendarSetup}
                  disabled={calendarSetupMutation.isPending}
                  className="w-full"
                >
                  {calendarSetupMutation.isPending ? <RefreshCw className="w-4 h-4 animate-spin mr-2" /> : null}
                  Configure Google Calendar
                </Button>
                {status?.calendar?.googleCalendar && (
                  <Button
                    onClick={() => handleCalendarSync(['google'])}
                    disabled={calendarSyncMutation.isPending}
                    variant="outline"
                    className="w-full"
                  >
                    {calendarSyncMutation.isPending ? <RefreshCw className="w-4 h-4 animate-spin mr-2" /> : null}
                    Sync Google Calendar Now
                  </Button>
                )}
              </CardContent>
            </Card>

            {/* Outlook Calendar Setup */}
            <Card className="border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-lg">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-slate-900 dark:text-white">
                  <Calendar className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                  Outlook Calendar Integration
                </CardTitle>
                <CardDescription className="text-slate-600 dark:text-slate-300 font-medium">
                  Connect your Outlook Calendar to automatically convert events into tasks
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="space-y-2">
                  <Label htmlFor="outlook-client-id">Client ID</Label>
                  <Input
                    id="outlook-client-id"
                    placeholder="Your Outlook OAuth Client ID"
                    value={calendarConfig.credentials.clientId || ''}
                    onChange={(e) => setCalendarConfig(prev => ({
                      ...prev,
                      type: 'outlook',
                      credentials: { ...prev.credentials, clientId: e.target.value }
                    }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="outlook-client-secret">Client Secret</Label>
                  <Input
                    id="outlook-client-secret"
                    type="password"
                    placeholder="Your Outlook OAuth Client Secret"
                    value={calendarConfig.credentials.clientSecret || ''}
                    onChange={(e) => setCalendarConfig(prev => ({
                      ...prev,
                      type: 'outlook',
                      credentials: { ...prev.credentials, clientSecret: e.target.value }
                    }))}
                  />
                </div>
                <Button
                  onClick={handleCalendarSetup}
                  disabled={calendarSetupMutation.isPending}
                  className="w-full"
                >
                  {calendarSetupMutation.isPending ? <RefreshCw className="w-4 h-4 animate-spin mr-2" /> : null}
                  Configure Outlook Calendar
                </Button>
                {status?.calendar?.outlook && (
                  <Button
                    onClick={() => handleCalendarSync(['outlook'])}
                    disabled={calendarSyncMutation.isPending}
                    variant="outline"
                    className="w-full"
                  >
                    {calendarSyncMutation.isPending ? <RefreshCw className="w-4 h-4 animate-spin mr-2" /> : null}
                    Sync Outlook Calendar Now
                  </Button>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}