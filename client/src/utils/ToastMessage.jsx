// src/utils/toastHelpers.js
import { CheckCircle, XCircle, Info } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export const useShowToast = () => {
  const { toast } = useToast();

  const showSuccessToast = (message) => {
    toast({
      title: (
        <div className="flex items-center gap-2">
          <CheckCircle className="h-4 w-4 text-green-600" />
          <span>Success</span>
        </div>
      ),
      description: message,
      className: "bg-green-50 border-green-200 text-green-800",
      duration: 5000,
    });
  };

  const showErrorToast = (message) => {
    toast({
      title: (
        <div className="flex items-center gap-2">
          <XCircle className="h-4 w-4 text-red-600" />
          <span>Error</span>
        </div>
      ),
      description: message,
      className: "bg-red-50 border-red-200 text-red-800",
      duration: 5000,
    });
  };

  const showInfoToast = (message) => {
    toast({
      title: (
        <div className="flex items-center gap-2">
          <Info className="h-4 w-4 text-blue-600" />
          <span>Info</span>
        </div>
      ),
      description: message,
      className: "bg-blue-50 border-blue-200 text-blue-800",
      duration: 5000,
    });
  };

  return { showSuccessToast, showErrorToast, showInfoToast };
};
