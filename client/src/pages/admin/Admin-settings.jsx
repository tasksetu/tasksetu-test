import React, { useState, useEffect } from "react";
import {
  Settings,
  Palette,
  Upload,
  RotateCcw,
  Eye,
  Save,
  Trash2,
  Image as ImageIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";

export default function AdminSettings() {
  const { toast } = useToast();
  const [activeSection, setActiveSection] = useState("notifications");
  const [loading, setLoading] = useState(false);
  const [settings, setSettings] = useState(null);
  const [isSaving, setIsSaving] = useState(false);

  // Login customization state
  const [loginSettings, setLoginSettings] = useState({
    backgroundColor: "#f3f4f6",
    gradientFrom: "#e5e7eb",
    gradientTo: "#d1d5db",
    useGradient: true,
    backgroundImage: "",
    overlayOpacity: 0.5,
  });
  const [isLoadingLoginSettings, setIsLoadingLoginSettings] = useState(false);
  const [isSavingLoginSettings, setIsSavingLoginSettings] = useState(false);
  const [previewMode, setPreviewMode] = useState(false);
  const [pendingImageFile, setPendingImageFile] = useState(null);
  const [imagePreviewUrl, setImagePreviewUrl] = useState("");

  // Fetch notification settings on mount
  useEffect(() => {
    fetchSettings();
    fetchLoginSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      setLoading(true);
      const response = await fetch("/api/notification-settings", {
        headers: {
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
      });
      const result = await response.json();
      if (result.success) {
        setSettings(result.data);
      }
    } catch (error) {
      console.error("Error fetching settings:", error);
      toast({
        title: "Error",
        description: "Failed to load notification settings",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchLoginSettings = async () => {
    try {
      setIsLoadingLoginSettings(true);
      const response = await fetch("/api/super-admin/login-settings", {
        headers: {
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setLoginSettings(data);
      }
    } catch (error) {
      console.error("Error fetching login settings:", error);
      toast({
        title: "Error",
        description: "Failed to load login customization settings",
        variant: "destructive",
      });
    } finally {
      setIsLoadingLoginSettings(false);
    }
  };

  const saveLoginSettings = async () => {
    try {
      setIsSavingLoginSettings(true);

      let settingsToSave = { ...loginSettings };

      // If gradient is selected, clear the background image
      if (settingsToSave.useGradient) {
        settingsToSave.backgroundImage = "";
        // Clear pending image if any
        setPendingImageFile(null);
        setImagePreviewUrl("");
      } else if (pendingImageFile) {
        // If image mode and there's a pending image, upload it first
        const formData = new FormData();
        formData.append("backgroundImage", pendingImageFile);

        const uploadResponse = await fetch(
          "/api/super-admin/upload-background",
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${localStorage.getItem("token")}`,
            },
            body: formData,
          },
        );

        if (!uploadResponse.ok) {
          throw new Error("Failed to upload image");
        }

        const uploadResult = await uploadResponse.json();
        settingsToSave.backgroundImage = uploadResult.settings.backgroundImage;

        // Clear pending state
        setPendingImageFile(null);
        setImagePreviewUrl("");
      }

      const response = await fetch("/api/super-admin/login-settings", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
        body: JSON.stringify(settingsToSave),
      });

      if (response.ok) {
        toast({
          title: "Success",
          description: "Login customization settings saved successfully",
        });

        // 🔄 Refresh settings from server to ensure UI is in sync with database
        await fetchLoginSettings();
      } else {
        throw new Error("Failed to save settings");
      }
    } catch (error) {
      console.error("Error saving login settings:", error);
      toast({
        title: "Error",
        description: "Failed to save login customization settings",
        variant: "destructive",
      });
    } finally {
      setIsSavingLoginSettings(false);
    }
  };

  const handleLoginSettingChange = (key, value) => {
    setLoginSettings((prev) => {
      const updated = { ...prev, [key]: value };

      // If switching to gradient mode, clear the background image and pending file
      if (key === "useGradient" && value === true) {
        updated.backgroundImage = "";
        setPendingImageFile(null);
        setImagePreviewUrl("");
      }

      return updated;
    });
  };

  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      // Validate file type
      if (!file.type.startsWith("image/")) {
        toast({
          title: "Invalid File",
          description: "Please select an image file",
          variant: "destructive",
        });
        return;
      }

      // Validate file size (max 5MB)
      if (file.size > 5 * 1024 * 1024) {
        toast({
          title: "File Too Large",
          description: "Please select an image smaller than 5MB",
          variant: "destructive",
        });
        return;
      }

      // Store file for later upload on Save
      setPendingImageFile(file);

      // Create preview URL
      const reader = new FileReader();
      reader.onload = (e) => {
        setImagePreviewUrl(e.target.result);
        setLoginSettings((prev) => ({
          ...prev,
          backgroundImage: e.target.result, // Temporary preview
        }));
      };
      reader.readAsDataURL(file);

      toast({
        title: "Image Selected",
        description: "Click 'Save Changes' to apply this image",
      });
    }
  };

  const handleDeleteImage = async () => {
    try {
      const response = await fetch("/api/super-admin/delete-background", {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
      });

      if (response.ok) {
        const result = await response.json();
        setLoginSettings(result.settings);
        toast({
          title: "Success",
          description: "Background image deleted successfully",
        });
      } else {
        throw new Error("Delete failed");
      }
    } catch (error) {
      console.error("Delete error:", error);
      toast({
        title: "Error",
        description: "Failed to delete image",
        variant: "destructive",
      });
    }
  };

  const resetLoginToDefault = () => {
    setLoginSettings({
      backgroundColor: "#f3f4f6",
      gradientFrom: "#e5e7eb",
      gradientTo: "#d1d5db",
      useGradient: true,
      backgroundImage: "",
      overlayOpacity: 0.5,
    });
    setPendingImageFile(null);
    setImagePreviewUrl("");
  };

  // Helper function to convert "db" marker to actual API endpoint
  const getBackgroundImageUrl = () => {
    // If user just selected a new image, show the preview
    if (imagePreviewUrl) {
      return imagePreviewUrl;
    }
    // If "db" marker is set, use the API endpoint
    if (loginSettings.backgroundImage === "db") {
      return "/api/public/login-image";
    }
    // Otherwise return the actual image path/URL
    return loginSettings.backgroundImage;
  };

  const handleToggle = async (field, subfield = null) => {
    if (!settings) return;

    let updatedSettings;
    if (subfield) {
      updatedSettings = {
        ...settings,
        [field]: {
          ...settings[field],
          [subfield]: !settings[field]?.[subfield],
        },
      };
    } else {
      updatedSettings = {
        ...settings,
        [field]: !settings[field],
      };
    }

    setSettings(updatedSettings);
    await saveSettings(updatedSettings);
  };

  const handleChannelToggle = async (channelType) => {
    if (!settings) return;

    const updatedSettings = {
      ...settings,
      channels: {
        ...settings.channels,
        [channelType]: {
          ...settings.channels[channelType],
          enabled: !settings.channels[channelType]?.enabled,
        },
      },
    };

    setSettings(updatedSettings);
    await saveSettings(updatedSettings);
  };

  const saveSettings = async (updatedSettings) => {
    try {
      setIsSaving(true);
      const response = await fetch("/api/notification-settings", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
        body: JSON.stringify(updatedSettings),
      });

      const result = await response.json();

      if (result.success) {
        toast({
          title: "Settings saved",
          description: "Your notification preferences have been updated",
        });
      } else {
        throw new Error(result.error || "Failed to save settings");
      }
    } catch (error) {
      console.error("Error saving settings:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to save settings",
        variant: "destructive",
      });
      // Revert changes by refetching
      await fetchSettings();
    } finally {
      setIsSaving(false);
    }
  };

  if (loading || !settings) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading settings...</p>
        </div>
      </div>
    );
  }

  const sections = [
    { id: "notifications", label: "Notifications", icon: "🔔", count: 1 },
    { id: "delivery", label: "Delivery", icon: "📨", count: 2 },
    // { id: "reminders", label: "Reminders", icon: "⏰", count: 3 },
    { id: "advanced", label: "Advanced", icon: "⚙️", count: 4 },
    { id: "login-customization", label: "Login Customization", icon: "🎨" },
  ];

  return (
    <div className="min-h-screen bg-gray-50 overflow-scroll">
      {/* Enhanced Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-6xl mx-auto p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-purple-100 rounded-sm flex items-center justify-center border border-purple-200">
              <Settings className="w-6 h-6 text-purple-600" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-gray-900">Settings</h2>
              <p className="text-gray-600 mt-1">
                Manage your notification preferences and settings
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto p-4">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-3">
          {/* Sidebar Navigation */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-sm border border-gray-200 p-4 sticky top-24">
              <h3 className="text-lg font-semibold text-gray-900 mb-3">
                Settings Categories
              </h3>
              <nav className="space-y-2">
                {sections.map((section) => (
                  <Button
                    key={section.id}
                    variant={
                      activeSection === section.id ? "primary" : "outline"
                    }
                    onClick={() => setActiveSection(section.id)}
                    className={`w-full h-9 text-left px-4 py-3 font-medium transition-all duration-300 flex items-center justify-between ${
                      activeSection === section.id
                        ? "bg-blue-600 text-white border border-blue-600"
                        : "text-gray-700 hover:bg-gray-100 border border-gray-200"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-lg">{section.icon}</span>
                      <span>{section.label}</span>
                    </div>
                    {/* <span
                      className={`text-xs px-2 py-1 rounded-md font-medium ${activeSection === section.id
                        ? "bg-blue-700 text-white"
                        : "bg-gray-100 text-gray-600"
                        }`}
                    >
                      {section.count}
                    </span> */}
                  </Button>
                ))}
              </nav>
            </div>
          </div>

          {/* Content Area */}
          <div className="lg:col-span-3">
            <div className="bg-white rounded-sm border border-gray-200 overflow-hidden">
              {/* Notifications Center */}
              {activeSection === "notifications" && (
                <div className="p-7">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-10 h-10 bg-blue-100 rounded-sm flex items-center justify-center border border-blue-200">
                      <span className="text-xl">🔔</span>
                    </div>
                    <div>
                      <h2 className="text-xl font-bold text-gray-900">
                        Notification Center
                      </h2>
                      <p className="text-gray-600">
                        Manage and view all your notifications
                      </p>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <div className="rounded-sm p-4 border border-gray-200 bg-white">
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            <span className="text-lg">📱</span>
                            <h3 className="text-lg font-semibold text-gray-900">
                              Notification Center
                            </h3>
                          </div>
                          <p className="text-gray-600 mb-3">
                            Access your comprehensive notification dashboard
                            with filtering, settings, and management tools
                          </p>
                          <div className="text-sm text-gray-500 mb-3">
                            ✓ View all notifications in one place
                            <br />
                            ✓ Filter by type, status, and priority
                            <br />
                            ✓ Manage notification preferences
                            <br />✓ Mark as read/unread and delete options
                          </div>
                          <a
                            href="/notifications"
                            className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-all duration-200"
                            data-testid="link-notification-center"
                          >
                            <span className="mr-2">🔔</span>
                            Open Notification Center
                            <svg
                              className="ml-2 w-4 h-4"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                              />
                            </svg>
                          </a>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Delivery Preferences */}
              {activeSection === "delivery" && (
                <div className="p-7">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-10 h-10 bg-emerald-100 rounded-sm flex items-center justify-center border border-emerald-200">
                      <span className="text-xl">📨</span>
                    </div>
                    <div>
                      <h2 className="text-xl font-bold text-gray-900">
                        Delivery Preferences
                      </h2>
                      <p className="text-gray-600">
                        Choose how you want to receive notifications
                      </p>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <div className="rounded-sm p-4 border border-gray-200 bg-white">
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            <span className="text-lg">📧</span>
                            <h3 className="text-lg font-semibold text-gray-900">
                              Email notifications
                            </h3>
                          </div>
                          <p className="text-gray-600">
                            Receive notifications via email
                          </p>
                          <div className="mt-3 text-sm text-gray-500">
                            {settings.event_preferences
                              ?.new_organization_registration !== undefined ? (
                              <>
                                ✓ New organization registrations
                                <br />
                                ✓ New user registrations
                                <br />✓ Package/plan purchases
                              </>
                            ) : (
                              <>✓ Task assignments, updates, and deadlines</>
                            )}
                          </div>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input
                            type="checkbox"
                            checked={settings.channels?.email?.enabled || false}
                            onChange={() => handleChannelToggle("email")}
                            disabled={isSaving}
                            className="sr-only peer"
                          />
                          <div className="w-14 h-8 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-6 peer-checked:after:border-white after:content-[''] after:absolute after:top-1 after:left-1 after:bg-white after:rounded-full after:h-6 after:w-6 after:transition-all peer-checked:bg-blue-600"></div>
                        </label>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Due Date Reminders */}
              {/* {activeSection === "reminders" && (
                <div className="p-7">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-10 h-10 bg-orange-100 rounded-sm flex items-center justify-center border border-orange-200">
                      <span className="text-xl">⏰</span>
                    </div>
                    <div>
                      <h2 className="text-xl font-bold text-gray-900">
                        Due Date Reminders
                      </h2>
                      <p className="text-gray-600">
                        Get reminded before tasks are due
                      </p>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <div className="rounded-sm p-4 border border-gray-200 bg-white">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            <span className="text-lg">📅</span>
                            <h3 className="text-lg font-semibold text-gray-900">
                              Enable due date reminders
                            </h3>
                          </div>
                          <p className="text-gray-600">
                            Receive reminders before tasks are due
                          </p>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input
                            type="checkbox"
                            checked={settings.dueDateReminders}
                            onChange={() => handleToggle("dueDateReminders")}
                            className="sr-only peer"
                          />
                          <div className="w-14 h-8 bg-gray-300 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-6 peer-checked:after:border-white after:content-[''] after:absolute after:top-1 after:left-1 after:bg-white after:rounded-full after:h-6 after:w-6 after:transition-all peer-checked:bg-blue-600"></div>
                        </label>
                      </div>

                      {settings.dueDateReminders && (
                        <div className="space-y-3 pt-6 border-t border-orange-200">
                          <div>
                            <h4 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
                              <span>⏱️</span>
                              Remind me:
                            </h4>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                              {[
                                {
                                  days: 7,
                                  label: "7 days before",
                                  desc: "Week ahead",
                                },
                                {
                                  days: 3,
                                  label: "3 days before",
                                  desc: "Few days",
                                },
                                {
                                  days: 1,
                                  label: "1 day before",
                                  desc: "Last minute",
                                },
                              ].map(({ days, label, desc }) => (
                                <label key={days} className="relative">
                                  <input
                                    type="checkbox"
                                    checked={settings.dueDateReminders.daysBeforeDue.includes(
                                      days,
                                    )}
                                    onChange={(e) => {
                                      if (e.target.checked) {
                                        const newDays = [
                                          ...settings.dueDateReminders
                                            .daysBeforeDue,
                                          days,
                                        ].sort((a, b) => b - a);
                                        onSettingsChange({
                                          ...settings,
                                          dueDateReminders: {
                                            ...settings.dueDateReminders,
                                            daysBeforeDue: newDays,
                                          },
                                        });
                                      } else {
                                        const newDays =
                                          settings.dueDateReminders.daysBeforeDue.filter(
                                            (d) => d !== days,
                                          );
                                        onSettingsChange({
                                          ...settings,
                                          dueDateReminders: {
                                            ...settings.dueDateReminders,
                                            daysBeforeDue: newDays,
                                          },
                                        });
                                      }
                                    }}
                                    className="sr-only peer"
                                  />
                                  <div className="bg-white border-2 border-gray-200 rounded-md p-4 cursor-pointer transition-all duration-300 peer-checked:border-orange-500 peer-checked:bg-orange-50 hover:border-orange-300">
                                    <div className="flex items-center justify-between">
                                      <div>
                                        <div className="font-medium text-gray-900">
                                          {label}
                                        </div>
                                        <div className="text-sm text-gray-600">
                                          {desc}
                                        </div>
                                      </div>
                                      <div className="w-5 h-5 border-2 border-gray-300 rounded peer-checked:border-orange-500 peer-checked:bg-orange-500 flex items-center justify-center">
                                        {settings.dueDateReminders.daysBeforeDue.includes(
                                          days,
                                        ) && (
                                            <svg
                                              className="w-3 h-3 text-white"
                                              fill="currentColor"
                                              viewBox="0 0 20 20"
                                            >
                                              <path
                                                fillRule="evenodd"
                                                d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                                                clipRule="evenodd"
                                              />
                                            </svg>
                                          )}
                                      </div>
                                    </div>
                                  </div>
                                </label>
                              ))}
                            </div>
                          </div>

                          <div>
                            <h4 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
                              <span>🕘</span>
                              Reminder time:
                            </h4>
                            <div className="bg-white rounded-md border-2 border-gray-200 p-4 max-w-xs">
                              <input
                                type="time"
                                value={settings.dueDateReminders.time}
                                onChange={(e) =>
                                  onSettingsChange({
                                    ...settings,
                                    dueDateReminders: {
                                      ...settings.dueDateReminders,
                                      time: e.target.value,
                                    },
                                  })
                                }
                                className="w-full text-lg font-medium text-gray-900 bg-transparent border-none outline-none"
                              />
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )} */}

              {/* Advanced Settings */}
              {activeSection === "advanced" && (
                <div className="p-7">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-10 h-10 bg-purple-100 rounded-sm flex items-center justify-center border border-purple-200">
                      <span className="text-xl">⚙️</span>
                    </div>
                    <div>
                      <h2 className="text-xl font-bold text-gray-900">
                        Advanced Settings
                      </h2>
                      <p className="text-gray-600">
                        Fine-tune your notification preferences
                      </p>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <div className="rounded-sm p-4 border border-gray-200 bg-white">
                      <h3 className="text-lg font-semibold text-gray-900 mb-3 flex items-center gap-2">
                        <span>🔕</span>
                        Quiet Hours
                      </h3>
                      <p className="text-gray-600 mb-3">
                        Set times when you don't want to receive notifications
                      </p>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Start time
                          </label>
                          <input
                            type="time"
                            defaultValue="22:00"
                            className="form-input w-full h-9"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            End time
                          </label>
                          <input
                            type="time"
                            defaultValue="08:00"
                            className="form-input w-full h-9"
                          />
                        </div>
                      </div>
                    </div>

                    <div className="rounded-sm p-4 border border-gray-200 bg-white">
                      <h3 className="text-lg font-semibold text-gray-900 mb-3 flex items-center gap-2">
                        <span>📊</span>
                        Digest Settings
                      </h3>
                      <p className="text-gray-600 mb-3">
                        Receive summary notifications instead of individual ones
                      </p>
                      <div className="space-y-3">
                        <label className="flex items-center gap-3 cursor-pointer">
                          <input
                            type="radio"
                            name="digest"
                            value="none"
                            defaultChecked
                            className="w-4 h-4 text-green-600"
                          />
                          <span className="text-gray-700">
                            Send notifications immediately
                          </span>
                        </label>
                        <label className="flex items-center gap-3 cursor-pointer">
                          <input
                            type="radio"
                            name="digest"
                            value="hourly"
                            className="w-4 h-4 text-green-600"
                          />
                          <span className="text-gray-700">Hourly digest</span>
                        </label>
                        <label className="flex items-center gap-3 cursor-pointer">
                          <input
                            type="radio"
                            name="digest"
                            value="daily"
                            className="w-4 h-4 text-green-600"
                          />
                          <span className="text-gray-700">Daily digest</span>
                        </label>
                      </div>
                    </div>

                    <div className="rounded-sm p-4 border border-gray-200 bg-white">
                      <h3 className="text-lg font-semibold text-gray-900 mb-3 flex items-center gap-2">
                        <span>🚨</span>
                        Priority Filter
                      </h3>
                      <p className="text-gray-600 mb-3">
                        Only receive notifications for specific priority levels
                      </p>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        {[
                          { level: "low", color: "green", label: "Low" },
                          { level: "medium", color: "yellow", label: "Medium" },
                          { level: "high", color: "orange", label: "High" },
                          {
                            level: "critical",
                            color: "red",
                            label: "Critical",
                          },
                        ].map(({ level, color, label }) => (
                          <label
                            key={level}
                            className="flex items-center gap-2 cursor-pointer"
                          >
                            <input
                              type="checkbox"
                              defaultChecked
                              className={`w-4 h-4 text-${color}-600`}
                            />
                            <span
                              className={`px-2 py-1 rounded-full text-xs font-medium bg-${color}-100 text-${color}-800`}
                            >
                              {label}
                            </span>
                          </label>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Login Customization */}
              {activeSection === "login-customization" && (
                <div className="p-7">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-10 h-10 bg-indigo-100 rounded-sm flex items-center justify-center border border-indigo-200">
                      <Palette className="w-6 h-6 text-indigo-600" />
                    </div>
                    <div>
                      <h2 className="text-xl font-bold text-gray-900">
                        Login Page Customization
                      </h2>
                      <p className="text-gray-600">
                        Customize the login page background with colors or
                        images
                      </p>
                    </div>
                  </div>

                  {isLoadingLoginSettings ? (
                    <div className="text-center py-8">
                      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto"></div>
                      <p className="mt-4 text-gray-600">Loading settings...</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {/* Background Type Selection */}
                      <div className="rounded-sm p-4 border border-gray-200 bg-white">
                        <h3 className="text-lg font-semibold text-gray-900 mb-3 flex items-center gap-2">
                          <Palette className="w-5 h-5" />
                          Background Type
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          <button
                            onClick={() =>
                              handleLoginSettingChange("useGradient", true)
                            }
                            className={`p-4 border-2 rounded-sm transition-all ${
                              loginSettings.useGradient
                                ? "border-indigo-500 bg-indigo-50"
                                : "border-gray-200 hover:border-gray-300"
                            }`}
                          >
                            <div className="flex items-center gap-3">
                              <div className="w-12 h-12 rounded bg-gradient-to-br from-blue-400 to-purple-500"></div>
                              <div className="text-left">
                                <h4 className="font-semibold text-gray-900">
                                  Gradient/Color
                                </h4>
                                <p className="text-sm text-gray-600">
                                  Use solid color or gradient
                                </p>
                              </div>
                            </div>
                          </button>
                          <button
                            onClick={() =>
                              handleLoginSettingChange("useGradient", false)
                            }
                            className={`p-4 border-2 rounded-sm transition-all ${
                              !loginSettings.useGradient
                                ? "border-indigo-500 bg-indigo-50"
                                : "border-gray-200 hover:border-gray-300"
                            }`}
                          >
                            <div className="flex items-center gap-3">
                              <div className="w-12 h-12 rounded bg-gray-200 flex items-center justify-center">
                                <ImageIcon className="w-6 h-6 text-gray-500" />
                              </div>
                              <div className="text-left">
                                <h4 className="font-semibold text-gray-900">
                                  Background Image
                                </h4>
                                <p className="text-sm text-gray-600">
                                  Upload custom image
                                </p>
                              </div>
                            </div>
                          </button>
                        </div>
                      </div>

                      {/* Gradient/Color Settings */}
                      {loginSettings.useGradient && (
                        <div className="rounded-sm p-4 border border-gray-200 bg-white">
                          <h3 className="text-lg font-semibold text-gray-900 mb-3">
                            Gradient Colors
                          </h3>
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-3">
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-2">
                                From Color
                              </label>
                              <div className="flex gap-2">
                                <input
                                  type="color"
                                  value={loginSettings.gradientFrom}
                                  onChange={(e) =>
                                    handleLoginSettingChange(
                                      "gradientFrom",
                                      e.target.value,
                                    )
                                  }
                                  className="w-16 h-10 rounded border border-gray-300 cursor-pointer"
                                />
                                <input
                                  type="text"
                                  value={loginSettings.gradientFrom}
                                  onChange={(e) =>
                                    handleLoginSettingChange(
                                      "gradientFrom",
                                      e.target.value,
                                    )
                                  }
                                  className="flex-1 h-9 px-3 border border-gray-300 rounded-md text-sm"
                                  placeholder="#e5e7eb"
                                />
                              </div>
                            </div>
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-2">
                                To Color
                              </label>
                              <div className="flex gap-2">
                                <input
                                  type="color"
                                  value={loginSettings.gradientTo}
                                  onChange={(e) =>
                                    handleLoginSettingChange(
                                      "gradientTo",
                                      e.target.value,
                                    )
                                  }
                                  className="w-16 h-10 rounded border border-gray-300 cursor-pointer"
                                />
                                <input
                                  type="text"
                                  value={loginSettings.gradientTo}
                                  onChange={(e) =>
                                    handleLoginSettingChange(
                                      "gradientTo",
                                      e.target.value,
                                    )
                                  }
                                  className="flex-1 h-9 px-3 border border-gray-300 rounded-md text-sm"
                                  placeholder="#d1d5db"
                                />
                              </div>
                            </div>
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-2">
                                Background Color
                              </label>
                              <div className="flex gap-2">
                                <input
                                  type="color"
                                  value={loginSettings.backgroundColor}
                                  onChange={(e) =>
                                    handleLoginSettingChange(
                                      "backgroundColor",
                                      e.target.value,
                                    )
                                  }
                                  className="w-16 h-10 rounded border border-gray-300 cursor-pointer"
                                />
                                <input
                                  type="text"
                                  value={loginSettings.backgroundColor}
                                  onChange={(e) =>
                                    handleLoginSettingChange(
                                      "backgroundColor",
                                      e.target.value,
                                    )
                                  }
                                  className="flex-1 h-9 px-3 border border-gray-300 rounded-md text-sm"
                                  placeholder="#f3f4f6"
                                />
                              </div>
                            </div>
                          </div>

                          {/* Gradient Presets */}
                          <div className="mt-4">
                            <label className="block text-sm font-medium text-gray-700 mb-3">
                              Preset Gradients
                            </label>
                            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
                              {[
                                {
                                  name: "Default Gray",
                                  from: "#e5e7eb",
                                  to: "#d1d5db",
                                },
                                {
                                  name: "Ocean Blue",
                                  from: "#0ea5e9",
                                  to: "#0284c7",
                                },
                                {
                                  name: "Sunset Orange",
                                  from: "#f97316",
                                  to: "#ea580c",
                                },
                                {
                                  name: "Forest Green",
                                  from: "#16a34a",
                                  to: "#15803d",
                                },
                                {
                                  name: "Purple Night",
                                  from: "#7c3aed",
                                  to: "#5b21b6",
                                },
                                {
                                  name: "Rose Gold",
                                  from: "#f43f5e",
                                  to: "#e11d48",
                                },
                                {
                                  name: "Dark Slate",
                                  from: "#334155",
                                  to: "#1e293b",
                                },
                              ].map((preset) => (
                                <button
                                  key={preset.name}
                                  onClick={() => {
                                    handleLoginSettingChange(
                                      "gradientFrom",
                                      preset.from,
                                    );
                                    handleLoginSettingChange(
                                      "gradientTo",
                                      preset.to,
                                    );
                                  }}
                                  className="group relative"
                                  title={preset.name}
                                >
                                  <div
                                    className="w-full h-16 rounded-sm border-2 border-gray-200 group-hover:border-indigo-400 transition-all cursor-pointer"
                                    style={{
                                      background: `linear-gradient(135deg, ${preset.from} 0%, ${preset.to} 100%)`,
                                    }}
                                  />
                                  <p className="text-xs text-gray-600 mt-1 text-center truncate">
                                    {preset.name}
                                  </p>
                                </button>
                              ))}
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Image Upload Settings */}
                      {!loginSettings.useGradient && (
                        <div className="rounded-sm p-4 border border-gray-200 bg-white">
                          <h3 className="text-lg font-semibold text-gray-900 mb-3 flex items-center gap-2">
                            <Upload className="w-5 h-5" />
                            Background Image
                          </h3>

                          {loginSettings.backgroundImage ? (
                            <div className="space-y-3">
                              <div className="relative rounded-sm overflow-hidden border-2 border-gray-200">
                                <img
                                  src={getBackgroundImageUrl()}
                                  alt="Login background preview"
                                  className="w-full h-48 object-cover"
                                />
                                <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity">
                                  <p className="text-white text-sm">
                                    Current Background
                                  </p>
                                </div>
                              </div>
                              <div className="flex gap-3">
                                <label className="flex-1">
                                  <input
                                    type="file"
                                    accept="image/*"
                                    onChange={handleImageUpload}
                                    className="hidden"
                                  />
                                  <div className="w-full px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 transition-all cursor-pointer text-center">
                                    <Upload className="w-4 h-4 inline mr-2" />
                                    Change Image
                                  </div>
                                </label>
                                <Button
                                  onClick={handleDeleteImage}
                                  variant="outline"
                                  className="px-4 py-2 border-red-300 text-red-600 hover:bg-red-50"
                                >
                                  <Trash2 className="w-4 h-4 mr-2" />
                                  Delete
                                </Button>
                              </div>

                              {/* Overlay Opacity */}
                              <div className="mt-4">
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                  Overlay Opacity:{" "}
                                  {Math.round(
                                    loginSettings.overlayOpacity * 100,
                                  )}
                                  %
                                </label>
                                <input
                                  type="range"
                                  min="0"
                                  max="1"
                                  step="0.1"
                                  value={loginSettings.overlayOpacity}
                                  onChange={(e) =>
                                    handleLoginSettingChange(
                                      "overlayOpacity",
                                      parseFloat(e.target.value),
                                    )
                                  }
                                  className="w-full"
                                />
                                <div className="flex justify-between text-xs text-gray-500 mt-1">
                                  <span>Transparent</span>
                                  <span>Opaque</span>
                                </div>
                              </div>
                            </div>
                          ) : (
                            <label className="block">
                              <input
                                type="file"
                                accept="image/*"
                                onChange={handleImageUpload}
                                className="hidden"
                              />
                              <div className="border-2 border-dashed border-gray-300 rounded-sm p-7 text-center hover:border-indigo-400 transition-all cursor-pointer">
                                <Upload className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                                <p className="text-gray-700 font-medium mb-1">
                                  Upload Background Image
                                </p>
                                <p className="text-sm text-gray-500">
                                  Click to select or drag and drop
                                </p>
                                <p className="text-xs text-gray-400 mt-2">
                                  PNG, JPG, GIF or WebP (Max 5MB)
                                </p>
                              </div>
                            </label>
                          )}
                        </div>
                      )}

                      {/* Preview */}
                      <div className="rounded-sm p-4 border border-gray-200 bg-white">
                        <div className="flex items-center justify-between mb-3">
                          <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                            <Eye className="w-5 h-5" />
                            Preview
                          </h3>
                          <Button
                            onClick={() => setPreviewMode(!previewMode)}
                            variant="outline"
                            size="sm"
                          >
                            {previewMode ? "Hide" : "Show"} Full Preview
                          </Button>
                        </div>

                        <div
                          className="rounded-sm overflow-hidden border-2 border-gray-300"
                          style={{
                            height: previewMode ? "400px" : "200px",
                            backgroundSize: "cover",
                            backgroundPosition: "center",
                            backgroundRepeat: "no-repeat",
                            transition: "height 0.3s ease",
                            ...(loginSettings.useGradient
                              ? {
                                  background: `linear-gradient(135deg, ${loginSettings.gradientFrom} 0%, ${loginSettings.gradientTo} 100%)`,
                                }
                              : loginSettings.backgroundImage
                                ? {
                                    backgroundImage: `url(${getBackgroundImageUrl()})`,
                                  }
                                : {
                                    backgroundColor:
                                      loginSettings.backgroundColor,
                                  }),
                          }}
                        >
                          {loginSettings.backgroundImage &&
                            !loginSettings.useGradient && (
                              <div
                                className="w-full h-full flex items-center justify-center"
                                style={{
                                  backgroundColor: `rgba(0, 0, 0, ${loginSettings.overlayOpacity})`,
                                }}
                              >
                                <div className="text-white text-center">
                                  <p className="text-2xl font-bold">
                                    Login Preview
                                  </p>
                                  <p className="text-sm mt-2">
                                    This is how your login page will look
                                  </p>
                                </div>
                              </div>
                            )}
                          {loginSettings.useGradient && (
                            <div className="w-full h-full flex items-center justify-center">
                              <div className="text-gray-800 text-center">
                                <p className="text-2xl font-bold">
                                  Login Preview
                                </p>
                                <p className="text-sm mt-2">
                                  This is how your login page will look
                                </p>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Action Buttons */}
                      <div className="space-y-3">
                        {pendingImageFile && (
                          <div className="bg-yellow-50 border border-yellow-200 rounded-sm p-3 flex items-center gap-2">
                            <div className="w-2 h-2 bg-yellow-500 rounded-full animate-pulse"></div>
                            <p className="text-sm text-yellow-800">
                              Image selected. Click "Save Changes" to apply.
                            </p>
                          </div>
                        )}

                        <div className="flex justify-between items-center">
                          <Button
                            onClick={resetLoginToDefault}
                            variant="outline"
                            className="flex items-center gap-2"
                          >
                            <RotateCcw className="w-4 h-4" />
                            Reset to Default
                          </Button>
                          <Button
                            onClick={saveLoginSettings}
                            disabled={isSavingLoginSettings}
                            className="bg-indigo-600 hover:bg-indigo-700 text-white px-6"
                          >
                            {isSavingLoginSettings ? (
                              <>
                                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                                Saving...
                              </>
                            ) : (
                              <>
                                <Save className="w-4 h-4 mr-2" />
                                Save Changes
                              </>
                            )}
                          </Button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
