import React from "react";
import { Button } from "@/components/ui/button";
import { X, BarChart2, FileText, CheckSquare } from "lucide-react";

// Mock usage data for demonstration purposes
const mockUsageData = {
  "FRM-001": {
    submissions: 152,
    usedIn: [
      "Task T-101: Vendor Onboarding",
      "Process P-05: New Supplier Approval",
    ],
  },
  "FRM-002": {
    submissions: 893,
    usedIn: ["Task T-204: Expense Claim", "Task T-210: Travel Reimbursement"],
  },
  "FRM-005": {
    submissions: 431,
    usedIn: ["Process P-02: Employee Leave Management"],
  },
  "FRM-007": {
    submissions: 45,
    usedIn: ["Task T-301: Report Workplace Hazard"],
  },
  "FRM-008": {
    submissions: 78,
    usedIn: ["Process P-01: New Employee Onboarding"],
  },
};

const FormUsageModal = ({ isOpen, onClose, form }) => {
  if (!isOpen || !form) return null;

  const usage = mockUsageData[form.id] || { submissions: 0, usedIn: [] };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-sm p-4 max-w-lg w-full shadow-xl">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-xl font-bold flex items-center gap-2">
            <BarChart2 className="h-5 w-5 text-blue-600" />
            Form Usage & Analytics
          </h2>
          <Button variant="ghost" size="sm" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="space-y-3">
          <div>
            <h3 className="font-semibold text-gray-800">{form.name}</h3>
            <p className="text-sm text-gray-500">ID: {form.id}</p>
          </div>

          <div className="grid grid-cols-2 gap-3 pt-4 border-t">
            <div className="bg-gray-50 p-3 rounded-sm">
              <p className="text-sm text-gray-600">Total Submissions</p>
              <p className="text-md font-ligth">{usage.submissions}</p>
            </div>
            <div className="bg-gray-50 p-3 rounded-sm">
              <p className="text-sm text-gray-600">Last Used Date</p>
              <p className="text-md font-ligth">{form.lastUsed || "N/A"}</p>
            </div>
          </div>

          <div>
            <h4 className="font-semibold text-gray-700 mb-2 flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Used In ({usage.usedIn.length})
            </h4>
            <div className="max-h-40 overflow-y-auto space-y-2 p-3 bg-gray-50 rounded-sm border">
              {usage.usedIn.length > 0 ? (
                usage.usedIn.map((item, index) => (
                  <div key={index} className="flex items-center gap-2 text-sm">
                    <CheckSquare className="h-4 w-4 text-green-500" />
                    <span>{item}</span>
                  </div>
                ))
              ) : (
                <p className="text-sm text-gray-500 text-center py-4">
                  This form is not currently used in any tasks or processes.
                </p>
              )}
            </div>
          </div>
        </div>

        <div className="pt-4 mt-4 border-t text-right">
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
    </div>
  );
};

export default FormUsageModal;
