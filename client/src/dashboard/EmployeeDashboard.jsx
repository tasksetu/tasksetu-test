import React from "react";
import IndividualDashboard from "./IndividualDashboard";

/**
 * Employee Dashboard Component.
 * Tailored for team members / employees working in an Organization Workspace,
 * focusing on personal daily execution, assigned tasks, and workflow steps.
 */
const EmployeeDashboard = (props) => {
  return <IndividualDashboard {...props} forcedRole="employee" />;
};

export default EmployeeDashboard;
