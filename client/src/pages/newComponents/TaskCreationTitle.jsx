import React from "react";
import { ClipboardList, RotateCcw, Target, CheckCircle } from "lucide-react";

export default function TaskCreationTile({
  type,
  title,
  description,
  icon,
  color,
  onClick,
}) {
  const colorClasses = {
    blue: "border-blue-500 bg-gradient-to-br from-blue-50 to-indigo-50 hover:from-blue-100 hover:to-indigo-100 cursor-pointer",
    green:
      "border-green-500 bg-gradient-to-br from-green-50 to-emerald-50 hover:from-green-100 hover:to-emerald-100 cursor-pointer",
    purple:
      "border-purple-500 bg-gradient-to-br from-purple-50 to-violet-50 hover:from-purple-100 hover:to-violet-100 cursor-pointer",
    orange:
      "border-orange-500 bg-gradient-to-br from-orange-50 to-amber-50 hover:from-orange-100 hover:to-amber-100 cursor-pointer",
  };

  const iconColorClasses = {
    blue: "bg-blue-500 text-white",
    green: "bg-green-500 text-white",
    purple: "bg-purple-500 text-white",
    orange: "bg-orange-500 text-white",
  };

  return (
    <button
      onClick={onClick}
      className={` text-white px-3 py-1.5 rounded-md ${colorClasses[color]}`}
    >
      <div className="flex items-start space-x-3">
        <div
          className={`w-6 h-6 mt-1 rounded-xl flex items-center justify-center transition-all duration-300 ${iconColorClasses[color]}`}
        >
          {icon}
        </div>
        {/* <div className="flex-1 min-w-0"> */}
        <h4 className="text-lg font-semibold text-gray-900 group-hover:text-gray-700 ">
          {title}
        </h4>
        {/* <p className="text-sm text-gray-600 group-hover:text-gray-700">
              {description}
            </p> */}
        {/* </div> */}
      </div>
    </button>
  );
}
