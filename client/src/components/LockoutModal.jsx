import React, { useState, useEffect } from "react";
import { AlertTriangle, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
const LockoutModal = ({ isOpen, timeLeft, onClose }) => {
  const [remainingTime, setRemainingTime] = useState(timeLeft);

  useEffect(() => {
    if (!isOpen || remainingTime <= 0) return;

    const timer = setInterval(() => {
      setRemainingTime((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          onClose(); // Auto-close modal when time is up
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [isOpen, remainingTime, onClose]);

  useEffect(() => {
    setRemainingTime(timeLeft);
  }, [timeLeft]);

  if (!isOpen) return null;

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const minutes = Math.floor(remainingTime / 60);
  const seconds = remainingTime % 60;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-sm shadow-xl p-4 max-w-md w-full mx-4 animate-in zoom-in-95 duration-200">
        <div className="flex items-center gap-3 mb-3">
          <div className="flex-shrink-0">
            <AlertTriangle className="h-8 w-8 text-red-500" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-gray-900">
              Account Temporarily Locked
            </h3>
            <p className="text-sm text-gray-600">
              Too many failed login attempts
            </p>
          </div>
        </div>

        <div className="bg-red-50 border border-red-200 rounded-sm p-4 mb-3">
          <div className="flex items-center gap-2 mb-2">
            <Clock className="h-5 w-5 text-red-600" />
            <span className="text-sm font-medium text-red-800">
              Time remaining:
            </span>
          </div>
          <div className="text-2xl font-bold text-red-700 font-mono">
            {formatTime(remainingTime)}
          </div>
          <p className="text-xs text-red-600 mt-1">
            You can try logging in again after this countdown reaches zero
          </p>
        </div>

        <div className="space-y-3 text-sm text-gray-600">
          <p>
            <strong>Why was my account locked?</strong>
            <br />
            Your account was temporarily locked after 3 failed login attempts to
            protect your security.
          </p>
          <p>
            <strong>What should I do?</strong>
            <br />
            Please wait{" "}
            {minutes > 0 && `${minutes} minute${minutes !== 1 ? "s" : ""}`}
            {minutes > 0 && seconds > 0 && " and "}
            {seconds > 0 && `${seconds} second${seconds !== 1 ? "s" : ""}`}
            before trying to log in again. Make sure you're using the correct
            email and password.
          </p>
        </div>
        <div>
          <Button
            variant="primary"
            className="w-full h-9 mt-6"
            onClick={onClose}
          >
            Login Again
          </Button>
        </div>
      </div>
    </div>
  );
};

export default LockoutModal;
