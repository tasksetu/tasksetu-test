
import { Badge } from "@/components/ui/badge";
export const roleLabels = {
  org_admin: "Organization Admin",
  manager: "Manager",
  employee: "Employee",
};


export function renderRoles(roles) {
  return Array.isArray(roles) && roles.length > 0 ? (
    <div className="flex flex-col gap-1">
      {roles.map((role, index) => (
        <Badge
          key={role + index}
          variant="outline"
          className={`${
            role === "org_admin"
              ? "bg-purple-100 text-purple-800 border-purple-200"
              : role === "manager"
              ? "bg-blue-100 text-blue-800 border-blue-200"
              : "bg-gray-100 text-gray-800 border-gray-200"
          }`}
        >
          {roleLabels[role] || role}
        </Badge>
      ))}
    </div>
  ) : (
    <Badge variant="outline">-</Badge>
  );
}