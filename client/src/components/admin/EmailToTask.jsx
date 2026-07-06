/**
 * Email to Task Component
 * Allows admins to configure and manage email-to-task functionality
 */

import React, { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import {
  Mail,
  RefreshCw,
  Play,
  Square,
  CheckCircle,
  XCircle,
  Info,
  Copy,
  ExternalLink,
  Inbox,
  Clock,
  AlertTriangle,
} from "lucide-react";

export default function EmailToTask() {
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);

  // Fetch email-to-task status
  const {
    data: status,
    isLoading: statusLoading,
    refetch: refetchStatus,
  } = useQuery({
    queryKey: ["/api/email-to-task/status"],
    refetchInterval: 30000, // Refresh every 30 seconds
    retry: 1,
  });

  // Fetch email-to-task config
  const { data: config, isLoading: configLoading } = useQuery({
    queryKey: ["/api/email-to-task/config"],
    retry: 1,
  });

  // Start service mutation
  const startServiceMutation = useMutation({
    mutationFn: async (intervalMinutes = 5) => {
      return await apiRequest("/api/email-to-task/start", {
        method: "POST",
        body: { intervalMinutes },
      });
    },
    onSuccess: (data) => {
      toast({
        title: "✅ Service Started",
        description: data.message || "Email polling service is now running",
      });
      queryClient.invalidateQueries({
        queryKey: ["/api/email-to-task/status"],
      });
    },
    onError: (error) => {
      toast({
        title: "❌ Error",
        description: error.message || "Failed to start email service",
        variant: "destructive",
      });
    },
  });

  // Stop service mutation
  const stopServiceMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest("/api/email-to-task/stop", {
        method: "POST",
      });
    },
    onSuccess: (data) => {
      toast({
        title: "Service Stopped",
        description: data.message || "Email polling service has been stopped",
      });
      queryClient.invalidateQueries({
        queryKey: ["/api/email-to-task/status"],
      });
    },
    onError: (error) => {
      toast({
        title: "❌ Error",
        description: error.message || "Failed to stop email service",
        variant: "destructive",
      });
    },
  });

  // Check emails manually mutation
  const checkEmailsMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest("/api/email-to-task/check", {
        method: "POST",
      });
    },
    onSuccess: (data) => {
      toast({
        title: "📧 Email Check Complete",
        description:
          data.message ||
          `Processed emails and created ${data.data?.tasksCreated || 0} tasks`,
      });
      queryClient.invalidateQueries({
        queryKey: ["/api/email-to-task/status"],
      });
    },
    onError: (error) => {
      toast({
        title: "❌ Error",
        description: error.message || "Failed to check emails",
        variant: "destructive",
      });
    },
  });

  const handleCopyEmail = () => {
    const email =
      config?.data?.instructions?.emailFormat?.to || "tasksetu@gmail.com";
    navigator.clipboard.writeText(email);
    setCopied(true);
    toast({
      title: "📋 Copied!",
      description: "Email address copied to clipboard",
    });
    setTimeout(() => setCopied(false), 2000);
  };

  const isRunning = status?.data?.isRunning;

  if (statusLoading || configLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="w-8 h-8 animate-spin text-blue-500" />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="p-3 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl shadow-lg">
          <Mail className="w-6 h-6 text-white" />
        </div>
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
            Email to Task
          </h2>
          <p className="text-gray-600 dark:text-gray-300">
            Email bhejkar automatically task create karein
          </p>
        </div>
      </div>

      {/* Status Card */}
      <Card className="border-2 border-gray-200 dark:border-gray-700 shadow-lg">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <div
                className={`w-3 h-3 rounded-full ${isRunning ? "bg-green-500 animate-pulse" : "bg-gray-400"}`}
              />
              Service Status
            </CardTitle>
            <Badge
              variant={isRunning ? "default" : "secondary"}
              className={`${isRunning ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200" : "bg-gray-100 text-gray-800"}`}
            >
              {isRunning ? (
                <>
                  <CheckCircle className="w-3 h-3 mr-1" /> Running
                </>
              ) : (
                <>
                  <XCircle className="w-3 h-3 mr-1" /> Stopped
                </>
              )}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-sm">
              <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400 mb-1">
                <Inbox className="w-4 h-4" />
                <span className="text-sm">Email Address</span>
              </div>
              <p
                className="font-medium text-gray-900 dark:text-white truncate"
                title={status?.data?.email || "Not configured"}
              >
                {status?.data?.email || "Not configured"}
              </p>
            </div>
            <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-sm">
              <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400 mb-1">
                <Clock className="w-4 h-4" />
                <span className="text-sm">Check Interval</span>
              </div>
              <p className="font-medium text-gray-900 dark:text-white">
                Every 5 minutes
              </p>
            </div>
            <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-sm">
              <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400 mb-1">
                <Mail className="w-4 h-4" />
                <span className="text-sm">IMAP Host</span>
              </div>
              <p className="font-medium text-gray-900 dark:text-white">
                {status?.data?.imapHost || "imap.gmail.com"}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap gap-3">
            {isRunning ? (
              <Button
                onClick={() => stopServiceMutation.mutate()}
                disabled={stopServiceMutation.isPending}
                variant="destructive"
                className="flex items-center gap-2"
              >
                {stopServiceMutation.isPending ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <Square className="w-4 h-4" />
                )}
                Stop Service
              </Button>
            ) : (
              <Button
                onClick={() => startServiceMutation.mutate(5)}
                disabled={startServiceMutation.isPending}
                className="flex items-center gap-2 bg-green-600 hover:bg-green-700"
              >
                {startServiceMutation.isPending ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <Play className="w-4 h-4" />
                )}
                Start Service
              </Button>
            )}

            <Button
              onClick={() => checkEmailsMutation.mutate()}
              disabled={checkEmailsMutation.isPending}
              variant="outline"
              className="flex items-center gap-2"
            >
              {checkEmailsMutation.isPending ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                <RefreshCw className="w-4 h-4" />
              )}
              Check Emails Now
            </Button>

            <Button onClick={() => refetchStatus()} variant="ghost" size="icon">
              <RefreshCw className="w-4 h-4" />
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* How to Use Card */}
      <Card className="border-2 border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-950/30">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-blue-700 dark:text-blue-300">
            <Info className="w-5 h-5" />
            कैसे Use करें? (How to Use)
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {/* Step 1 */}
            <div className="flex gap-3">
              <div className="flex-shrink-0 w-10 h-10 bg-blue-600 text-white rounded-full flex items-center justify-center font-bold">
                1
              </div>
              <div>
                <h4 className="font-semibold text-gray-900 dark:text-white">
                  Email bhejein
                </h4>
                <p className="text-gray-600 dark:text-gray-300 text-sm mt-1">
                  Neeche diye gaye email address par email bhejein
                </p>
              </div>
            </div>

            {/* Step 2 */}
            <div className="flex gap-3">
              <div className="flex-shrink-0 w-10 h-10 bg-blue-600 text-white rounded-full flex items-center justify-center font-bold">
                2
              </div>
              <div>
                <h4 className="font-semibold text-gray-900 dark:text-white">
                  Subject = Task Title
                </h4>
                <p className="text-gray-600 dark:text-gray-300 text-sm mt-1">
                  Email ka subject task ka title ban jayega
                </p>
              </div>
            </div>

            {/* Step 3 */}
            <div className="flex gap-3">
              <div className="flex-shrink-0 w-10 h-10 bg-blue-600 text-white rounded-full flex items-center justify-center font-bold">
                3
              </div>
              <div>
                <h4 className="font-semibold text-gray-900 dark:text-white">
                  Body = Description
                </h4>
                <p className="text-gray-600 dark:text-gray-300 text-sm mt-1">
                  Email ka body task ki description ban jayega
                </p>
              </div>
            </div>

            {/* Step 4 */}
            <div className="flex gap-3">
              <div className="flex-shrink-0 w-10 h-10 bg-green-600 text-white rounded-full flex items-center justify-center font-bold">
                ✓
              </div>
              <div>
                <h4 className="font-semibold text-gray-900 dark:text-white">
                  Task Create!
                </h4>
                <p className="text-gray-600 dark:text-gray-300 text-sm mt-1">
                  Task automatically "All Tasks" mein show hoga
                </p>
              </div>
            </div>
          </div>

          <Separator />

          {/* Email Address to Copy */}
          <div className="bg-white dark:bg-gray-800 p-4 rounded-sm border border-gray-200 dark:border-gray-700">
            <Label className="text-sm text-gray-500 dark:text-gray-400 mb-2 block">
              📮 Email Address (Is par email bhejein):
            </Label>
            <div className="flex items-center gap-2">
              <Input
                value={
                  config?.data?.instructions?.emailFormat?.to ||
                  "tasksetu@gmail.com"
                }
                readOnly
                className="font-mono text-lg bg-gray-50 dark:bg-gray-900"
              />
              <Button
                onClick={handleCopyEmail}
                variant="outline"
                className="flex-shrink-0"
              >
                {copied ? (
                  <CheckCircle className="w-4 h-4 text-green-500" />
                ) : (
                  <Copy className="w-4 h-4" />
                )}
              </Button>
            </div>
          </div>

          {/* Important Notes */}
          <Alert className="border-yellow-200 bg-yellow-50 dark:bg-yellow-950/30 dark:border-yellow-800">
            <AlertTriangle className="w-4 h-4 text-yellow-600" />
            <AlertTitle className="text-yellow-800 dark:text-yellow-200">
              Important Notes
            </AlertTitle>
            <AlertDescription className="text-yellow-700 dark:text-yellow-300">
              <ul className="list-disc list-inside mt-2 space-y-1 text-sm">
                {config?.data?.instructions?.notes?.map((note, index) => (
                  <li key={index}>{note}</li>
                )) || (
                  <>
                    <li>Tasks MEDIUM priority ke saath create hote hain</li>
                    <li>Due date 7 din baad set hoti hai</li>
                    <li>
                      Task sender ko assign hota hai (agar registered user hai)
                    </li>
                    <li>
                      Email registered user se hona chahiye proper assignment ke
                      liye
                    </li>
                  </>
                )}
              </ul>
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>

      {/* Email Format Example */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mail className="w-5 h-5 text-gray-500" />
            Email Format Example
          </CardTitle>
          <CardDescription>
            Aise email bhejein task create karne ke liye
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="bg-gray-50 dark:bg-gray-800 rounded-sm p-4 font-mono text-sm space-y-2">
            <div className="flex">
              <span className="text-gray-500 w-20">To:</span>
              <span className="text-blue-600">tasksetu@gmail.com</span>
            </div>
            <div className="flex">
              <span className="text-gray-500 w-20">Subject:</span>
              <span className="text-gray-900 dark:text-white">
                Complete project report
              </span>
            </div>
            <Separator className="my-2" />
            <div>
              <span className="text-gray-500">Body:</span>
              <p className="text-gray-700 dark:text-gray-300 mt-1">
                Please complete the monthly project report by end of week.
                Include all metrics and KPIs.
              </p>
            </div>
          </div>

          <div className="mt-4 p-4 bg-green-50 dark:bg-green-950/30 rounded-sm border border-green-200 dark:border-green-800">
            <p className="text-green-700 dark:text-green-300 flex items-center gap-2">
              <CheckCircle className="w-4 h-4" />
              <strong>Result:</strong> Task "Complete project report" create
              hoga with description
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
