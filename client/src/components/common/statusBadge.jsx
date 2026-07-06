import { Badge } from "@/components/ui/badge";
import { CheckCircle, UserX, Clock } from "lucide-react";

export const STATUS_MAP = {
  active: {
    label: "Active",
    variant: "default",
    className: "bg-green-100 text-green-800 border-green-200",
    Icon: CheckCircle,
  },
  inactive: {
    label: "Inactive",
    variant: "secondary",
    className: "bg-red-100 text-red-800 border-red-200",
    Icon: UserX,
  },
  invited: {
    label: "Pending",
    variant: "outline",
    className: "bg-yellow-100 text-yellow-800 border-yellow-200",
    Icon: Clock,
  },
  pending: {
    label: "Pending",
    variant: "outline",
    className: "bg-yellow-100 text-yellow-800 border-yellow-200",
    Icon: Clock,
  },
};

export const getStatusBadge = (status) => {
  const config = STATUS_MAP[status];

  if (!config)
    return <Badge variant="outline">{status}</Badge>;

  const { label, variant, className, Icon } = config;

  return (
    <Badge variant={variant} className={className}>
      <Icon className="h-3 w-3 mr-1" />
      {label}
    </Badge>
  );
};
