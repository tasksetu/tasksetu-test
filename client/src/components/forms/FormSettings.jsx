import { X, ShieldAlert, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";

export function FormSettings({
  settings,
  onUpdate,
  onClose,
  layout,
  setLayout,
  isOwner = true, // Only show governance settings to owner
}) {
  const handleChange = (key, value) => {
    onUpdate({ ...settings, [key]: value });
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-sm p-4 sm:p-4 max-w-lg w-full max-h-[90vh] overflow-y-auto border border-slate-200 shadow-lg">
        <div className="flex items-center justify-between mb-3 sm:mb-3">
          <h2 className="text-lg sm:text-xl font-bold">Form Settings</h2>
          <Button variant="ghost" size="sm" className="rounded-sm" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="space-y-3 sm:space-y-3">
          <div className="flex items-center justify-between">
            <label className="text-sm font-medium">
              Allow Anonymous Submissions
            </label>
            <Switch
              className="rounded-full [&_span]:rounded-full"
              checked={settings.allowAnonymous}
              onCheckedChange={(checked) =>
                handleChange("allowAnonymous", checked)
              }
            />
          </div>

          {/* Publish Governance - Only show to form owner */}
          {isOwner && (
            <div className="border-t pt-4 mt-4">
              <div className="flex items-start justify-between gap-3 mb-2">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <ShieldAlert className="h-4 w-4 text-amber-600" />
                    <label className="text-sm font-medium">
                      Restrict Publishing to Owner Only
                    </label>
                  </div>
                  <p className="text-xs text-slate-500">
                    When enabled, only you (the owner) can publish new versions.
                    Editors will be able to edit but cannot publish.
                  </p>
                </div>
                <Switch
                  className="rounded-full [&_span]:rounded-full"
                  checked={settings.restrictPublishToOwner || false}
                  onCheckedChange={(checked) =>
                    handleChange("restrictPublishToOwner", checked)
                  }
                />
              </div>
              {settings.restrictPublishToOwner && (
                <div className="bg-amber-50 border border-amber-200 rounded-sm p-3 mt-2">
                  <div className="flex gap-2">
                    <Info className="h-4 w-4 text-amber-600 flex-shrink-0 mt-0.5" />
                    <p className="text-xs text-amber-800">
                      <strong>Active:</strong> Only you can publish versions of this form.
                      Users with Editor role can still edit fields and settings.
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* <div className="h-6 border-b border-gray-300 mx-4"></div> */}
          <div className="space-y-3 border-t pt-4">

            <label className="text-sm font-medium">
              Select Layout
            </label>
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:space-x-2">
              <Button
                size="sm"
                className="flex-1 rounded-sm"
                variant={layout === "1-column" ? "default" : "outline"}
                onClick={() => {
                  setLayout("1-column");
                  handleChange("layout", "1-column");
                }}
              >
                1 Column
              </Button>
              <Button
                size="sm"
                className="flex-1 rounded-sm"
                variant={layout === "2-columns" ? "default" : "outline"}
                onClick={() => {
                  setLayout("2-columns");
                  handleChange("layout", "2-columns");
                }}
              >
                2 Columns
              </Button>
              <Button
                size="sm"
                className="flex-1 rounded-sm"
                variant={layout === "3-columns" ? "default" : "outline"}
                onClick={() => {
                  setLayout("3-columns");
                  handleChange("layout", "3-columns");
                }}
              >
                3 Columns
              </Button>
            </div>
          </div>
          {/* <div className="h-6 border-b border-gray-300 mx-4"></div> */}
          <div>
            <label className="block text-sm font-medium mb-1">
              Submit Message
            </label>
            <Textarea
              value={settings.submitMessage}
              onChange={(e) => handleChange("submitMessage", e.target.value)}
              placeholder="Thank you for your submission!"
              rows={3}
              className="rounded-sm"
            />
          </div>
          {/* <div className="h-6 border-b border-gray-300 mx-4"></div> */}
          <div>
            <label className="block text-sm font-medium mb-1">
              Maximum Submissions (optional)
            </label>
            <Input
              type="number"
              min="0"
              value={settings.maxSubmissions || ""}
              onChange={(e) => {
                const val = e.target.value;
                if (val === "") {
                  handleChange("maxSubmissions", null);
                } else {
                  const num = parseInt(val, 10);
                  if (num >= 0) handleChange("maxSubmissions", num);
                }
              }}
              placeholder="No limit"
              className="h-8 min-h-8 max-h-8 rounded-sm py-0 leading-none"
            />
          </div>
          {/* <div className="h-6 border-b border-gray-300 mx-4"></div> */}
          <div>
            <label className="block text-sm font-medium mb-1">
              Redirect URL (optional)
            </label>
            <Input
              type="url"
              value={settings.redirectUrl || ""}
              onChange={(e) => handleChange("redirectUrl", e.target.value)}
              placeholder="https://example.com/thank-you"
              className="h-8 min-h-8 max-h-8 rounded-sm py-0 leading-none"
            />
          </div>

          <div className="flex flex-col sm:flex-row justify-between gap-2 sm:space-x-2 pt-4">
            <Button
              size="sm"
              className="w-full sm:w-auto rounded-sm"
              variant="outline"
              onClick={onClose}
            >
              Cancel
            </Button>
            <Button
              size="sm"
              className="w-full sm:w-auto rounded-sm bg-blue-500 text-white hover:bg-blue-600"
              onClick={onClose}
            >
              Save Settings
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}