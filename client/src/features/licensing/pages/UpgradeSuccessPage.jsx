import React from "react";
import { Button } from "@/components/ui/button";
import { Crown, CheckSquare } from "lucide-react";
import { Link, useLocation } from "wouter";

export default function UpgradeSuccessPage() {
  const [location] = useLocation();
  // Get plan from URL query param
  const params = new URLSearchParams(window.location.search);
  const plan = params.get("plan") || "Your";

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50">
      <div className="bg-white rounded-sm shadow-lg p-7 max-w-md w-full text-center">
        <div className="flex justify-center mb-3">
          <Crown className="h-10 w-10 text-blue-600" />
        </div>
        <h1 className="text-2xl font-bold text-gray-900 mb-2">
          {plan} Plan Upgraded Successfully!
        </h1>
        <div className="flex justify-center mb-3">
          <CheckSquare className="h-8 w-8 text-green-600" />
        </div>
        <p className="text-gray-700 mb-3">
          Congratulations! Your subscription has been upgraded to the{" "}
          <span className="font-semibold">{plan}</span> plan.
        </p>
        <Button
          asChild
          className="w-full bg-blue-600 hover:bg-blue-700 text-white"
        >
          <Link to="/dashboard">Go to Dashboard</Link>
        </Button>
      </div>
    </div>
  );
}
