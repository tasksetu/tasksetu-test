import React from "react";
import { CheckCircle, XCircle, AlertCircle, Info } from "lucide-react";

const SuccessToast = ({
  message,
  type = "success",
  isVisible,
  onClose,
  duration = 4000,
  position = "top-right",
}) => {
  React.useEffect(() => {
    if (isVisible) {
      const timer = setTimeout(() => {
        onClose();
      }, duration);
      return () => clearTimeout(timer);
    }
  }, [isVisible, duration, onClose]);

  if (!isVisible) return null;

  const getTypeConfig = () => {
    switch (type) {
      case "success":
        return {
          icon: <CheckCircle className="w-5 h-5" />,
          bgColor: "bg-green-50",
          borderColor: "border-green-200",
          textColor: "text-green-800",
          iconColor: "text-green-400",
          progressColor: "bg-green-400",
        };
      case "error":
        return {
          icon: <XCircle className="w-5 h-5" />,
          bgColor: "bg-red-50",
          borderColor: "border-red-200",
          textColor: "text-red-800",
          iconColor: "text-red-400",
          progressColor: "bg-red-400",
        };
      case "warning":
        return {
          icon: <AlertCircle className="w-5 h-5" />,
          bgColor: "bg-yellow-50",
          borderColor: "border-yellow-200",
          textColor: "text-yellow-800",
          iconColor: "text-yellow-400",
          progressColor: "bg-yellow-400",
        };
      case "info":
        return {
          icon: <Info className="w-5 h-5" />,
          bgColor: "bg-blue-50",
          borderColor: "border-blue-200",
          textColor: "text-blue-800",
          iconColor: "text-blue-400",
          progressColor: "bg-blue-400",
        };
      default:
        return {
          icon: <CheckCircle className="w-5 h-5" />,
          bgColor: "bg-gray-50",
          borderColor: "border-gray-200",
          textColor: "text-gray-800",
          iconColor: "text-gray-400",
          progressColor: "bg-gray-400",
        };
    }
  };

  const getPositionClasses = () => {
    switch (position) {
      case "top-left":
        return "top-5 left-5";
      case "top-right":
        return "top-5 right-5";
      case "bottom-left":
        return "bottom-5 left-5";
      case "bottom-right":
        return "bottom-5 right-5";
      case "top-center":
        return "top-5 left-1/2 transform -translate-x-1/2";
      case "bottom-center":
        return "bottom-5 left-1/2 transform -translate-x-1/2";
      default:
        return "top-5 right-5";
    }
  };

  const config = getTypeConfig();

  return (
    <div
      className={`fixed z-[70] ${getPositionClasses()}`}
      style={{ animation: "slideIn 0.3s ease-out" }}
    >
      <div
        className={`max-w-sm w-full ${config.bgColor} border ${config.borderColor} rounded-sm shadow-lg overflow-hidden`}
      >
        <div className="p-4">
          <div className="flex items-start">
            <div className="flex-shrink-0">
              <span className={config.iconColor}>{config.icon}</span>
            </div>
            <div className="ml-3 w-0 flex-1 pt-0.5">
              <p className={`text-sm font-medium ${config.textColor}`}>
                {message}
              </p>
            </div>
            <div className="ml-4 flex-shrink-0 flex">
              <button
                className={`rounded-md inline-flex ${config.textColor} hover:opacity-75 focus:outline-none`}
                onClick={onClose}
              >
                <span className="sr-only">Close</span>
                <XCircle className="h-5 w-5" />
              </button>
            </div>
          </div>
        </div>
        {/* Progress bar */}
        <div className="h-1 bg-gray-200">
          <div
            className={`h-1 ${config.progressColor} transition-all ease-linear`}
            style={{
              animation: `shrink ${duration}ms linear`,
              width: "100%",
            }}
          />
        </div>
      </div>

      <style jsx>{`
        @keyframes slideIn {
          from {
            transform: translateX(100%);
            opacity: 0;
          }
          to {
            transform: translateX(0);
            opacity: 1;
          }
        }

        @keyframes shrink {
          from {
            width: 100%;
          }
          to {
            width: 0%;
          }
        }
      `}</style>
    </div>
  );
};

export default SuccessToast;
