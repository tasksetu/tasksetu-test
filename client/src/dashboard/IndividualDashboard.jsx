import React from "react";
import EmployeeDashboard from "./EmployeeDashboard";

/**
 * Individual Dashboard
 * Reuses the modern, responsive, and dynamic dashboard with activeRole="individual".
 */
export default function IndividualDashboard(props) {
  return <EmployeeDashboard {...props} activeRole="individual" />;
}
