import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { CalendarIcon, Copy, Check } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { useShowToast } from "../../utils/ToastMessage";

export default function FormPublishModal({
  open,
  onClose,
  formId,
  draftSchema,
}) {
  const { showSuccessToast, showErrorToast } = useShowToast();
  const queryClient = useQueryClient();
  const token = localStorage.getItem("token");

  const [releaseNotes, setReleaseNotes] = useState("");
  const [startDate, setStartDate] = useState(null);
  const [endDate, setEndDate] = useState(null);
  const [visibility, setVisibility] = useState("PRIVATE");
  const [scope, setScope] = useState("INTERNAL");
  const [externalSubmissionEnabled, setExternalSubmissionEnabled] =
    useState(false);
  const [requireCaptcha, setRequireCaptcha] = useState(false);
  const [externalUrl, setExternalUrl] = useState(null);
  const [copied, setCopied] = useState(false);

  // Fetch current user info to check organization membership
  const { data: userData } = useQuery({
    queryKey: ["currentUser"],
    queryFn: async () => {
      const res = await fetch("/api/auth/me", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      if (!res.ok) throw new Error("Failed to fetch user");
      const data = await res.json();
      return data.data;
    },
    enabled: !!token && open,
    staleTime: 1000 * 60 * 5, // Cache for 5 minutes
  });

  // Check if user belongs to an organization
  const hasOrganization = !!userData?.organizationId;

  // Publish mutation
  const publishMutation = useMutation({
    mutationFn: async (publishData) => {
      console.log("📡 Making API call to:", `/api/forms/${formId}/versions`);
      console.log("📡 With data:", publishData);

      const response = await fetch(`/api/forms/${formId}/versions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(publishData),
      });

      const data = await response.json();
      console.log("📡 API Response:", data);

      if (!response.ok) {
        throw new Error(data.message || "Failed to publish form");
      }
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries(["forms"]);
      queryClient.invalidateQueries(["form", formId]);

      showSuccessToast(
        `Form published successfully as version ${data.data?.version?.version_number || ""}`,
      );

      // Show external URL if generated
      if (data.data?.external_url) {
        setExternalUrl(data.data.external_url);
      } else {
        handleClose(true);
      }
    },
    onError: (error) => {
      showErrorToast(error.message || "Failed to publish form");
    },
  });

  const handlePublish = () => {
    console.log("🚀 Publishing form with ID:", formId);

    const publishData = {
      release_notes: releaseNotes,
      start_at: startDate ? startDate.toISOString() : null,
      end_at: endDate ? endDate.toISOString() : null,
      visibility,
      scope,
      external_submission_enabled: externalSubmissionEnabled,
      require_captcha: requireCaptcha,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    };

    console.log("📦 Publish data:", publishData);
    publishMutation.mutate(publishData);
  };

  const handleCopyUrl = () => {
    if (externalUrl) {
      navigator.clipboard.writeText(externalUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      showSuccessToast("External URL copied to clipboard");
    }
  };

  const handleClose = (refresh = false) => {
    setReleaseNotes("");
    setStartDate(null);
    setEndDate(null);
    setVisibility("PRIVATE");
    setScope("INTERNAL");
    setExternalSubmissionEnabled(false);
    setRequireCaptcha(false);
    setExternalUrl(null);
    setCopied(false);
    onClose?.(refresh);
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="bg-white rounded-md w-full max-w-2xl p-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h2 className="text-xl font-semibold">
              {externalUrl ? "Form Published Successfully!" : "Publish Form"}
            </h2>
            <p className="text-sm text-gray-600 mt-1">
              {externalUrl
                ? "Your form is now live and ready to receive submissions."
                : "Create a new version and publish this form template."}
            </p>
          </div>
          <Button variant="ghost" onClick={() => handleClose(false)}>
            ✕
          </Button>
        </div>

        {!externalUrl ? (
          <div className="space-y-3">
            {/* Release Notes */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Release Notes *</label>
              <Textarea
                placeholder="Describe what's new in this version..."
                value={releaseNotes}
                onChange={(e) => setReleaseNotes(e.target.value)}
                rows={3}
                className="resize-none"
              />
            </div>

            {/* Date Range */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <label className="text-sm font-medium">
                  Start Date{" "}
                  <span className="text-xs text-gray-500">(Optional)</span>
                </label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full justify-start text-left font-normal",
                        !startDate && "text-muted-foreground",
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {startDate ? format(startDate, "PPP") : "Pick a date"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0 bg-white" align="start">
                    <Calendar
                      mode="single"
                      selected={startDate}
                      onSelect={setStartDate}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">
                  End Date{" "}
                  <span className="text-xs text-gray-500">(Optional)</span>
                </label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full justify-start text-left font-normal",
                        !endDate && "text-muted-foreground",
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {endDate ? format(endDate, "PPP") : "Pick a date"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0 bg-white" align="start">
                    <Calendar
                      mode="single"
                      selected={endDate}
                      onSelect={setEndDate}
                      initialFocus
                      disabled={(date) => startDate && date < startDate}
                    />
                  </PopoverContent>
                </Popover>
              </div>
            </div>

            {/* Visibility */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Visibility</label>
              <Select value={visibility} onValueChange={setVisibility}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="PRIVATE">
                    Private - Only you can see this form
                  </SelectItem>
                  {hasOrganization && (
                    <SelectItem value="ORG">
                      Organization - Anyone in your org can use this
                    </SelectItem>
                  )}
                  <SelectItem value="PUBLIC">
                    Public - Available to everyone
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Scope */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Scope</label>
              <Select
                value={scope}
                onValueChange={(newScope) => {
                  setScope(newScope);
                  // Auto-enable external submission when EXTERNAL scope is selected
                  if (newScope === "EXTERNAL") {
                    setExternalSubmissionEnabled(true);
                  }
                }}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="INTERNAL">
                    Internal - For tasks and workflows only
                  </SelectItem>
                  <SelectItem value="EXTERNAL">
                    External - Can be submitted via public link
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* External Submission Options */}
            {scope === "EXTERNAL" && (
              <div className="space-y-3 p-4 border rounded-sm bg-blue-50">
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={externalSubmissionEnabled}
                    onChange={(e) =>
                      setExternalSubmissionEnabled(e.target.checked)
                    }
                    className="w-4 h-4"
                  />
                  <div>
                    <div className="font-medium">
                      Enable External Submissions
                    </div>
                    <div className="text-sm text-gray-600">
                      Generate a public link for anonymous submissions
                    </div>
                  </div>
                </label>

                {externalSubmissionEnabled && (
                  <label className="flex items-center gap-3 cursor-pointer ml-7">
                    <input
                      type="checkbox"
                      checked={requireCaptcha}
                      onChange={(e) => setRequireCaptcha(e.target.checked)}
                      className="w-4 h-4"
                    />
                    <div>
                      <div className="font-medium">Require CAPTCHA</div>
                      <div className="text-sm text-gray-600">
                        Prevent spam and bot submissions
                      </div>
                    </div>
                  </label>
                )}
              </div>
            )}
          </div>
        ) : (
          // External URL Display
          <div className="space-y-3">
            <div className="p-4 bg-green-50 border border-green-200 rounded-sm">
              <p className="text-sm font-medium text-green-900 mb-2">
                External Submission URL:
              </p>
              <div className="flex items-center gap-2">
                <Input
                  value={externalUrl}
                  readOnly
                  className="font-mono text-sm bg-white"
                />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleCopyUrl}
                  className="flex-shrink-0"
                >
                  {copied ? (
                    <Check className="h-4 w-4 text-green-600 mr-1" />
                  ) : (
                    <Copy className="h-4 w-4 mr-1" />
                  )}
                  {copied ? "Copied" : "Copy"}
                </Button>
              </div>
              <p className="text-xs text-gray-600 mt-2">
                Share this link with anyone to collect responses.
              </p>
            </div>
          </div>
        )}

        <div className="mt-6 flex justify-end gap-3">
          {!externalUrl ? (
            <>
              <Button
                variant="outline"
                onClick={() => handleClose(false)}
                disabled={publishMutation.isPending}
              >
                Cancel
              </Button>
              <Button
                onClick={handlePublish}
                disabled={publishMutation.isPending}
                className="bg-blue-600 hover:bg-blue-700 text-white"
              >
                {publishMutation.isPending ? "Publishing..." : "Publish Form"}
              </Button>
            </>
          ) : (
            <Button
              onClick={() => handleClose(true)}
              className="bg-blue-600 text-white"
            >
              Done
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
