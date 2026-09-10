import React from "react";
import { ProcessBuilderList } from "@/components/process-builder/ProcessBuilderList";

export default function ProcessBuilderPage() {
  return (
    <div className="quicktasks-square px-6 py-3 pb-8 bg-gray-50 min-h-full">
      <ProcessBuilderList />
    </div>
  );
}
