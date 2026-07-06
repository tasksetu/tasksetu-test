import { FileText, RotateCcw, Target, CheckCircle } from 'lucide-react';

export const getTaskTypeInfo = (taskType) => {
  const taskTypes = {
    regular: {
      iconName: "FileText",
      label: "Regular Task",
      color: "#3B82F6",
      bgColor: "bg-blue-50",
      borderColor: "border-blue-200",
      textColor: "text-blue-700",
    },
    recurring: {
      iconName: "RotateCcw",
      label: "Recurring Task",
      color: "#8B5CF6",
      bgColor: "bg-purple-50",
      borderColor: "border-purple-200",
      textColor: "text-purple-700",
    },
    milestone: {
      iconName: "Target",
      label: "Milestone",
      color: "#10B981",
      bgColor: "bg-green-50",
      borderColor: "border-green-200",
      textColor: "text-green-700",
    },
    approval: {
      iconName: "CheckCircle",
      label: "Approval Task",
      color: "#F59E0B",
      bgColor: "bg-amber-50",
      borderColor: "border-amber-200",
      textColor: "text-amber-700",
    },
  };

  return taskTypes[taskType] || taskTypes.regular;
};

export const getTaskTypeIcon = (taskType, size = 16, className = "") => {
  const taskInfo = getTaskTypeInfo(taskType);
  
  switch(taskInfo.iconName) {
    case "FileText":
      return <FileText size={size} className={className || "text-blue-600"} />;
    case "RotateCcw":
      return <RotateCcw size={size} className={className || "text-purple-600"} />;
    case "Target":
      return <Target size={size} className={className || "text-green-600"} />;
    case "CheckCircle":
      return <CheckCircle size={size} className={className || "text-amber-600"} />;
    default:
      return <FileText size={size} className={className || "text-blue-600"} />;
  }
};

export const getTaskPriorityColor = (priority) => {
  switch (priority?.toLowerCase()) {
    case "low":
    return "#10B981"; // Green
      // return "rgb(220 38 38 / 40%)"; // Light Green
    case "medium":
      return "#F59E0B"; // Yellow
    case "high":
      return "#EF4444"; // Red
    case "critical":
    case "urgent":
      return "#DC2626"; // Dark Red
    default:
      return "#6B7280"; // Gray
  }
};

export const getStatusColor = (status) => {
  switch (status) {
    case "OPEN":
      return "#6B7280"; // Gray
    case "INPROGRESS":
      return "#3B82F6"; // Blue
    case "ONHOLD":
      return "#F59E0B"; // Yellow
    case "DONE":
      return "#10B981"; // Green
    case "CANCELLED":
      return "#EF4444"; // Red
    default:
      return "#6B7280"; // Gray
  }
};
