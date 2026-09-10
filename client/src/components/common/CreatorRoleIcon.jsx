import React from "react";
import {
  ShieldCheck,
  Crown,
  Briefcase,
  UserCheck,
  User,
  UserCircle,
} from "lucide-react";
import { getCreatorRoleInfo } from "../../utils/taskHelpers";

const ROLE_CONFIG = {
  super_admin: {
    icon: Crown,
    bgClass: "bg-rose-100/80 text-rose-700 border-rose-200/90 hover:bg-rose-200",
    iconColor: "text-rose-600",
    gradientClass: "from-rose-500 to-pink-600",
  },
  org_admin: {
    icon: ShieldCheck,
    bgClass: "bg-purple-100/90 text-purple-700 border-purple-200/90 hover:bg-purple-200 shadow-[0_1px_2px_rgba(147,51,234,0.08)]",
    iconColor: "text-purple-700",
    gradientClass: "from-purple-600 to-indigo-600",
  },
  manager: {
    icon: Briefcase,
    bgClass: "bg-blue-100/90 text-blue-700 border-blue-200/90 hover:bg-blue-200 shadow-[0_1px_2px_rgba(37,99,235,0.08)]",
    iconColor: "text-blue-700",
    gradientClass: "from-blue-600 to-sky-600",
  },
  employee: {
    icon: User,
    bgClass: "bg-emerald-100/90 text-emerald-700 border-emerald-200/90 hover:bg-emerald-200 shadow-[0_1px_2px_rgba(16,185,129,0.08)]",
    iconColor: "text-emerald-700",
    gradientClass: "from-emerald-600 to-teal-600",
  },
  individual: {
    icon: UserCircle,
    bgClass: "bg-amber-100/90 text-amber-700 border-amber-200/90 hover:bg-amber-200 shadow-[0_1px_2px_rgba(245,158,11,0.08)]",
    iconColor: "text-amber-700",
    gradientClass: "from-amber-600 to-orange-600",
  },
};

/**
 * CreatorRoleIcon Component
 *
 * Displays a unique, styled identifier icon for who created the task (Org Admin, Manager, Employee, etc.).
 *
 * @param {Object} props
 * @param {Object} props.task - The task or subtask object
 * @param {string} [props.size="md"] - "sm" | "md" | "lg"
 * @param {boolean} [props.showLabel=false] - If true, shows a short pill badge alongside the icon
 * @param {string} [props.className=""] - Additional class names
 */
export default function CreatorRoleIcon({
  task,
  size = "md",
  showLabel = false,
  className = "",
}) {
  if (!task) return null;

  const info = getCreatorRoleInfo(task);
  const config = ROLE_CONFIG[info.role] || ROLE_CONFIG.employee;
  const IconComponent = config.icon;

  const sizeClasses = {
    sm: "w-4 h-4 text-[10px]",
    md: "w-5 h-5 text-[11px]",
    lg: "w-6 h-6 text-xs",
  }[size] || "w-5 h-5 text-[11px]";

  const iconSizes = {
    sm: "w-2.5 h-2.5",
    md: "w-3 h-3",
    lg: "w-3.5 h-3.5",
  }[size] || "w-3 h-3";

  if (showLabel) {
    return (
      <span
        className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded border text-[11px] font-medium transition-all shrink-0 cursor-default ${config.bgClass} ${className}`}
        title={info.tooltip}
      >
        <IconComponent className={`${iconSizes} ${config.iconColor} shrink-0`} />
        <span>{info.shortLabel}</span>
      </span>
    );
  }

  return (
    <span
      className={`inline-flex items-center justify-center rounded-[5px] border shrink-0 cursor-default transition-transform hover:scale-110 select-none ${sizeClasses} ${config.bgClass} ${className}`}
      title={info.tooltip}
      aria-label={info.tooltip}
    >
      <IconComponent className={`${iconSizes} ${config.iconColor} shrink-0`} />
    </span>
  );
}
