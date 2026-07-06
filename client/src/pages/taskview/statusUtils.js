function getStatusLabel(statusCode) {
  const statusMap = {
    OPEN: "Open",
    INPROGRESS: "In Progress",
    ONHOLD: "On Hold",
    DONE: "Completed",
    CANCELLED: "Cancelled",
    // Legacy support
    open: "Open",
    pending: "Open",
    "in-progress": "In Progress",
    completed: "Completed",
  };
  return statusMap[statusCode] || statusCode;
}

export default getStatusLabel;