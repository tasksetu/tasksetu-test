import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Key, AlertCircle, CheckCircle } from "lucide-react";
import { useShowToast } from "../utils/ToastMessage";

export function PasswordResetModal({ isOpen, onClose, user }) {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [generating, setGenerating] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [errors, setErrors] = useState({});
  const { showSuccessToast, showErrorToast } = useShowToast();

  const generateRandomPassword = () => {
    const chars =
      "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*";
    let newPassword = "";
    for (let i = 0; i < 12; i++) {
      newPassword += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setPassword(newPassword);
    setConfirmPassword(newPassword);
  };

  const handleReset = async () => {
    if (!password || !confirmPassword) {
      showErrorToast("Please enter a password");
      return;
    }

    if (password !== confirmPassword) {
      showErrorToast("Passwords do not match");
      return;
    }

    if (password.length < 8) {
      showErrorToast("Password must be at least 8 characters long");
      return;
    }

    setResetting(true);
    try {
      const token = localStorage.getItem("token");
      const response = await fetch(
        `/api/organization/users/${user._id}/reset-password`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ newPassword: password }),
        },
      );

      const data = await response.json();

      if (response.ok) {
        showSuccessToast(
          data.message ||
            "Password reset successfully. User has been notified.",
        );
        setPassword("");
        setConfirmPassword("");
        onClose();
      } else {
        showErrorToast(data.message || "Unable to reset password");
      }
    } catch (error) {
      console.error("Password reset error:", error);
      showErrorToast("Failed to reset password");
    } finally {
      setResetting(false);
    }
  };

  // Real-time validation for password changes
  const handlePasswordChange = (field, value) => {
    if (field === "password") {
      setPassword(value);
    } else {
      setConfirmPassword(value);
    }

    // Real-time validation for password mismatch
    const newErrors = { ...errors };

    if (field === "password" && confirmPassword) {
      if (value !== confirmPassword) {
        newErrors.confirmPassword = "Passwords do not match";
      } else {
        delete newErrors.confirmPassword;
      }
    } else if (field === "confirmPassword") {
      if (value && value !== password) {
        newErrors.confirmPassword = "Passwords do not match";
      } else {
        delete newErrors.confirmPassword;
      }
    }

    setErrors(newErrors);
  };

  const handleClose = () => {
    setPassword("");
    setConfirmPassword("");
    setErrors({});
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="bg-white max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Key className="h-5 w-5 text-blue-600" />
            Reset Password
          </DialogTitle>
          <DialogDescription>
            Reset password for{" "}
            <strong>
              {user?.firstName} {user?.lastName}
            </strong>{" "}
            ({user?.email})
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          {/* Info Alert */}
          <div className="p-3 bg-blue-50 border border-blue-200 rounded-sm">
            <div className="flex items-start gap-2">
              <AlertCircle className="h-4 w-4 text-blue-600 mt-0.5" />
              <p className="text-sm text-blue-700">
                The user will receive an email notification with their new
                password and instructions to change it on first login.
              </p>
            </div>
          </div>

          {/* Generate Password Button */}
          <Button
            type="button"
            variant="outline"
            onClick={generateRandomPassword}
            disabled={generating}
            className="w-full"
          >
            <Key className="h-4 w-4 mr-2" />
            Generate Strong Password
          </Button>

          {/* New Password */}
          <div className="space-y-2">
            <Label htmlFor="newPassword">New Password</Label>
            <Input
              id="newPassword"
              type="text"
              placeholder="Enter new password"
              value={password}
              onChange={(e) => handlePasswordChange("password", e.target.value)}
              className={`h-9 font-mono ${errors.password ? "border-red-500" : ""}`}
            />
            {errors.password && (
              <p className="text-red-500 text-xs">{errors.password}</p>
            )}
            <p className="text-xs text-gray-500">
              Minimum 8 characters, include letters, numbers, and special
              characters
            </p>
          </div>

          {/* Confirm Password */}
          <div className="space-y-2">
            <Label htmlFor="confirmPassword">Confirm Password</Label>
            <Input
              id="confirmPassword"
              type="text"
              placeholder="Confirm new password"
              value={confirmPassword}
              onChange={(e) =>
                handlePasswordChange("confirmPassword", e.target.value)
              }
              className={`h-9 font-mono ${errors.confirmPassword ? "border-red-500" : ""}`}
            />
            {errors.confirmPassword && (
              <p className="text-red-500 text-xs">{errors.confirmPassword}</p>
            )}
            {password && confirmPassword && !errors.confirmPassword && (
              <div className="flex items-center gap-2 text-sm">
                <CheckCircle className="h-4 w-4 text-green-600" />
                <span className="text-green-600">Passwords match</span>
              </div>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            className="h-9"
            onClick={handleClose}
            disabled={resetting}
          >
            Cancel
          </Button>
          <Button
            onClick={handleReset}
            disabled={
              !password ||
              !confirmPassword ||
              password !== confirmPassword ||
              resetting
            }
            className="h-9 bg-blue-600 hover:bg-blue-700"
          >
            {resetting ? (
              <>
                <span className="animate-spin mr-2">⏳</span>
                Resetting...
              </>
            ) : (
              <>
                <Key className="h-4 w-4 mr-2" />
                Reset Password
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
