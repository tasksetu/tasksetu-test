import { useState, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import { Palette, Upload, RotateCcw, Eye, Save } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function LoginCustomization() {
  const { toast } = useToast();
  const [settings, setSettings] = useState({
    backgroundColor: "#f3f4f6",
    gradientFrom: "#e5e7eb",
    gradientTo: "#d1d5db",
    useGradient: true,
    backgroundImage: "",
    overlayOpacity: 0.5,
  });
  const [isLoading, setIsLoading] = useState(false);
  const [previewMode, setPreviewMode] = useState(false);

  // Load settings on mount
  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      const response = await fetch("/api/super-admin/login-settings", {
        headers: {
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setSettings(data);
      }
    } catch (error) {
      console.error("Error fetching login settings:", error);
    }
  };

  const gradientPresets = [
    { name: "Default Gray", from: "#f3f4f6", to: "#e5e7eb" },
    { name: "Ocean Blue", from: "#0ea5e9", to: "#0284c7" },
    { name: "Sunset Orange", from: "#f97316", to: "#ea580c" },
    { name: "Forest Green", from: "#16a34a", to: "#15803d" },
    { name: "Purple Night", from: "#7c3aed", to: "#5b21b6" },
    { name: "Rose Gold", from: "#f43f5e", to: "#e11d48" },
    { name: "Dark Slate", from: "#334155", to: "#1e293b" },
  ];

  const handleSettingChange = (key, value) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
  };

  const handleImageUpload = async (e) => {
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

      try {
        // Upload the file to the server
        const formData = new FormData();
        formData.append("backgroundImage", file);

        const response = await fetch("/api/super-admin/upload-background", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${localStorage.getItem("token")}`,
          },
          body: formData,
        });

        const result = await response.json();

        if (response.ok) {
          // The image is stored in database with "db" marker
          // Set backgroundImage to "db" to match what was saved to the database
          handleSettingChange("backgroundImage", "db");

          toast({
            title: "✅ Image Uploaded",
            description:
              "Background image uploaded and verified successfully from database",
            variant: "default",
          });
        } else {
          throw new Error(result.message || "Upload failed");
        }
      } catch (error) {
        console.error("Upload error:", error);
        toast({
          title: "Upload Failed",
          description:
            error.message ||
            "Failed to upload image. Please try again or contact administrator.",
          variant: "destructive",
        });
      }
    }
  };

  const resetToDefault = () => {
    setSettings({
      backgroundColor: "#f3f4f6",
      gradientFrom: "#e5e7eb",
      gradientTo: "#d1d5db",
      useGradient: true,
      backgroundImage: "",
      overlayOpacity: 0.5,
    });
    toast({
      title: "Reset to Default",
      description: "Login page styling has been reset to default settings",
    });
  };

  const saveSettings = async () => {
    setIsLoading(true);
    try {
      const response = await fetch("/api/super-admin/login-settings", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
        body: JSON.stringify(settings),
      });

      if (response.ok) {
        toast({
          title: "Settings Saved",
          description: "Login page customization has been applied successfully",
        });

        // 🔄 Refresh settings from server to ensure UI is in sync with database
        await fetchSettings();
      } else {
        throw new Error("Failed to save settings");
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to save settings. Please try again.",
        variant: "destructive",
      });
      console.error("Save error:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const generateBackgroundStyle = () => {
    if (settings.backgroundImage) {
      // Convert "db" marker to actual API endpoint
      const imageUrl =
        settings.backgroundImage === "db"
          ? "/api/public/login-image"
          : settings.backgroundImage;

      return {
        backgroundImage: `linear-gradient(rgba(0,0,0,${settings.overlayOpacity}), rgba(0,0,0,${settings.overlayOpacity})), url(${imageUrl})`,
        backgroundSize: "cover",
        backgroundPosition: "center",
      };
    } else if (settings.useGradient) {
      return {
        background: `linear-gradient(135deg, ${settings.gradientFrom}, ${settings.gradientTo})`,
      };
    } else {
      return {
        backgroundColor: settings.backgroundColor,
      };
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-3">
          <div className="p-3 bg-purple-100 rounded-sm border border-purple-200">
            <Palette className="h-7 w-7 text-purple-700" />
          </div>
          <div>
            <h1 className="text-4xl font-bold text-gray-900">
              Login Page Customization
            </h1>
            <p className="text-base text-gray-600 mt-1 flex items-center gap-2">
              <span className="w-2 h-2 bg-gray-400 rounded-full"></span>
              Customize the appearance of the login pages for both regular users
              and super admin access
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        {/* Settings Panel */}
        <div className="space-y-3">
          {/* Background Type */}
          <div className="bg-white rounded-sm border border-gray-200 p-7">
            <div className="flex items-center gap-3 mb-3 pb-4 border-b border-gray-100">
              <div className="p-2 bg-purple-100 rounded-sm border border-purple-200">
                <Palette className="h-5 w-5 text-purple-700" />
              </div>
              <h3 className="text-xl font-bold text-gray-900">
                Background Settings
              </h3>
            </div>

            <div className="space-y-3">
              <div>
                <label className="flex items-center space-x-3">
                  <input
                    type="radio"
                    checked={!settings.backgroundImage && settings.useGradient}
                    onChange={() => {
                      handleSettingChange("backgroundImage", "");
                      handleSettingChange("useGradient", true);
                    }}
                    className="text-blue-600"
                  />
                  <span className="text-sm font-medium text-gray-700">
                    Gradient Background
                  </span>
                </label>
              </div>

              <div>
                <label className="flex items-center space-x-2">
                  <input
                    type="radio"
                    checked={!settings.backgroundImage && !settings.useGradient}
                    onChange={() => {
                      handleSettingChange("backgroundImage", "");
                      handleSettingChange("useGradient", false);
                    }}
                    className="text-blue-600"
                  />
                  <span className="text-sm font-medium text-gray-700">
                    Solid Color
                  </span>
                </label>
              </div>

              {/* <div>
                  <label className="flex items-center space-x-2">
                    <input
                      type="radio"
                      checked={!!settings.backgroundImage}
                      onChange={() => {
                        // Trigger file input when custom image is selected
                        const fileInput = document.querySelector('input[type="file"]');
                        if (fileInput) {
                          fileInput.click();
                        }
                      }}
                      className="text-blue-600"
                    />
                    <span className="text-sm font-medium text-gray-700">Custom Image</span>
                  </label>
                </div> */}
            </div>
          </div>

          {/* Image Upload */}
          <div className="bg-white rounded-sm border border-gray-200 p-4">
            <h3 className="text-lg font-semibold text-gray-900 mb-3">
              Background Image
            </h3>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Upload Image
                </label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleImageUpload}
                  className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded file:border file:border-gray-300 file:text-sm file:font-semibold file:bg-gray-50 file:text-gray-700 hover:file:bg-gray-100"
                />
              </div>

              {settings.backgroundImage && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Overlay Opacity: {Math.round(settings.overlayOpacity * 100)}
                    %
                  </label>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.1"
                    value={settings.overlayOpacity}
                    onChange={(e) =>
                      handleSettingChange(
                        "overlayOpacity",
                        parseFloat(e.target.value),
                      )
                    }
                    className="w-full"
                  />
                </div>
              )}
            </div>
          </div>
          {/* Gradient Settings */}
          {!settings.backgroundImage && settings.useGradient && (
            <div className="bg-white rounded-sm border border-gray-200 p-4">
              <h3 className="text-lg font-semibold text-gray-900 mb-3">
                Gradient Colors
              </h3>

              <div className="grid grid-cols-2 gap-3 mb-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    From Color
                  </label>
                  <input
                    type="color"
                    value={settings.gradientFrom}
                    onChange={(e) =>
                      handleSettingChange("gradientFrom", e.target.value)
                    }
                    className="w-full h-10 rounded border border-gray-300"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    To Color
                  </label>
                  <input
                    type="color"
                    value={settings.gradientTo}
                    onChange={(e) =>
                      handleSettingChange("gradientTo", e.target.value)
                    }
                    className="w-full h-10 rounded border border-gray-300"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-3">
                  Preset Gradients
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {gradientPresets.map((preset, index) => (
                    <Button
                      key={index}
                      variant="outline"
                      onClick={() => {
                        handleSettingChange("gradientFrom", preset.from);
                        handleSettingChange("gradientTo", preset.to);
                      }}
                      className="p-2 h-auto text-xs font-medium"
                      style={{
                        background: `linear-gradient(135deg, ${preset.from}, ${preset.to})`,
                        color: "white",
                        textShadow: "0 1px 2px rgba(0,0,0,0.5)",
                      }}
                    >
                      {preset.name}
                    </Button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Solid Color Settings */}
          {!settings.backgroundImage && !settings.useGradient && (
            <div className="bg-white rounded-sm border border-gray-200 p-4">
              <h3 className="text-lg font-semibold text-gray-900 mb-3">
                Background Color
              </h3>
              <input
                type="color"
                value={settings.backgroundColor}
                onChange={(e) =>
                  handleSettingChange("backgroundColor", e.target.value)
                }
                className="w-full h-12 rounded border border-gray-300"
              />
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex space-x-3">
            <Button
              variant="primary"
              onClick={saveSettings}
              disabled={isLoading}
              className="flex-1 h-9 flex items-center justify-center space-x-2"
            >
              <Save className="h-4 w-4" />
              <span>{isLoading ? "Saving..." : "Save Settings"}</span>
            </Button>

            <Button
              variant="outline"
              onClick={resetToDefault}
              className="h-9 flex items-center space-x-2"
            >
              <RotateCcw className="h-4 w-4" />
              <span>Reset</span>
            </Button>
          </div>
        </div>

        {/* Preview Panel */}
        <div className="space-y-3">
          <div className="bg-white rounded-sm border border-gray-200 p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-lg font-semibold text-gray-900">
                Live Preview
              </h3>
              <Button
                variant="outline"
                onClick={() => setPreviewMode(!previewMode)}
                className="h-9 flex items-center space-x-2 text-sm"
              >
                <Eye className="h-4 w-4" />
                <span>{previewMode ? "Exit" : "Fullscreen"}</span>
              </Button>
            </div>

            <div
              className="relative h-96 rounded-sm overflow-hidden border border-gray-200"
              style={generateBackgroundStyle()}
            >
              {/* Mock Login Form */}
              <div className="absolute inset-0 flex items-center justify-center p-4">
                <div className="bg-white rounded-sm p-4 w-80 shadow-xl">
                  <div className="text-center mb-3">
                    <div className="w-12 h-12 bg-gray-100 rounded-full mx-auto mb-2"></div>
                    <h2 className="text-xl font-bold">Welcome Back</h2>
                    <p className="text-gray-600 text-sm">
                      Sign in to your account
                    </p>
                  </div>

                  <div className="space-y-3">
                    <div>
                      <div className="w-full h-10 bg-gray-100 rounded border"></div>
                    </div>
                    <div>
                      <div className="w-full h-10 bg-gray-100 rounded border"></div>
                    </div>
                    <div className="w-full h-10 bg-blue-600 rounded text-white flex items-center justify-center text-sm font-medium">
                      Sign In
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Notes */}
          <div className="bg-yellow-50 border border-yellow-200 rounded-sm p-4">
            <h4 className="text-sm font-semibold text-yellow-800 mb-2">
              Important Notes
            </h4>
            <ul className="text-sm text-yellow-700 space-y-1">
              <li>
                • Changes will apply to both /login and /super-admin/login
                routes
              </li>
              <li>
                • Use high contrast backgrounds to ensure login form readability
              </li>
              <li>• Recommended image size: 1920x1080px or larger</li>
              <li>• Changes take effect immediately after saving</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Fullscreen Preview Modal */}
      {previewMode && (
        <div className="fixed inset-0 z-50" style={generateBackgroundStyle()}>
          <div className="flex items-center justify-center min-h-screen p-4">
            <div className="bg-white rounded-sm p-7 w-full max-w-md shadow-2xl">
              <div className="text-center mb-3">
                <div className="w-16 h-16 bg-gray-100 rounded-full mx-auto mb-3"></div>
                <h2 className="text-2xl font-bold">Welcome Back</h2>
                <p className="text-gray-600">Sign in to your account</p>
              </div>

              <div className="space-y-3">
                <input
                  className="w-full p-3 border rounded-md"
                  placeholder="Email address"
                />
                <input
                  className="w-full p-3 border rounded-md"
                  placeholder="Password"
                  type="password"
                />
                <Button variant="primary" className="w-full h-12">
                  Sign In
                </Button>
              </div>

              <Button
                variant="ghost"
                size="icon"
                onClick={() => setPreviewMode(false)}
                className="absolute top-4 right-4 text-white bg-black bg-opacity-50 rounded-full"
              >
                ✕
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
