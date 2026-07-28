import React from "react";
import { ProcessBuilderList } from "@/components/process-builder/ProcessBuilderList";

export default function ProcessBuilderPage() {
  return (
    <div className="quicktasks-square px-6 py-3 flex flex-1 flex-col h-[calc(100vh-64px)] min-h-0 overflow-hidden bg-gray-50">
      <ProcessBuilderList />
    </div>
  );
}
