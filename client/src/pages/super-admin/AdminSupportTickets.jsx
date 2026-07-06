import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supportAPI } from "@/api/supportAPI";
import {
  Headphones,
  MessageSquare,
  Search,
  Filter,
  Calendar,
  Mail,
  Building2,
  Clock,
  AlertCircle,
  User,
  ChevronRight,
  Send,
  Download,
  ImageIcon,
  File as FileIcon,
  Paperclip,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";

export default function AdminSupportTickets() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [replyMessage, setReplyMessage] = useState("");

  // Fetch admin tickets
  const {
    data: ticketsData,
    isLoading: ticketsLoading,
    refetch,
  } = useQuery({
    queryKey: ["adminTickets", statusFilter, priorityFilter, page],
    queryFn: () =>
      supportAPI.getAdminTickets({
        status: statusFilter === "all" ? undefined : statusFilter,
        priority: priorityFilter === "all" ? undefined : priorityFilter,
        page,
        limit: 10,
      }),
  });

  // Fetch all users to list potential assignees
  const { data: usersList = [] } = useQuery({
    queryKey: ["/api/super-admin/users"],
    queryFn: async () => {
      const response = await fetch("/api/super-admin/users", {
        headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
      });
      if (!response.ok) throw new Error("Failed to fetch users");
      return response.json();
    },
  });

  // Filter users to find admins/super_admins
  const adminUsers = React.useMemo(() => {
    return usersList.filter((user) => {
      const roleStr = Array.isArray(user.role) ? user.role[0] : user.role;
      return (
        roleStr === "super_admin" ||
        roleStr === "org_admin" ||
        roleStr === "admin"
      );
    });
  }, [usersList]);

  // Mutations
  const updateStatusMutation = useMutation({
    mutationFn: ({ ticketId, status }) =>
      supportAPI.updateTicketStatus(ticketId, status),
    onSuccess: (data) => {
      toast({
        title: "Status Updated",
        description: "Ticket status has been updated successfully.",
      });
      queryClient.invalidateQueries(["adminTickets"]);
      if (selectedTicket && selectedTicket._id === data.data._id) {
        setSelectedTicket(data.data);
      }
    },
    onError: (err) => {
      toast({
        title: "Error",
        description: err.response?.data?.error || "Failed to update status",
        variant: "destructive",
      });
    },
  });

  const assignTicketMutation = useMutation({
    mutationFn: ({ ticketId, assignData }) =>
      supportAPI.assignTicket(ticketId, assignData),
    onSuccess: (data) => {
      toast({
        title: "Ticket Assigned",
        description: "Ticket has been successfully assigned.",
      });
      queryClient.invalidateQueries(["adminTickets"]);
      if (selectedTicket && selectedTicket._id === data.data._id) {
        setSelectedTicket(data.data);
      }
    },
    onError: (err) => {
      toast({
        title: "Error",
        description: err.response?.data?.error || "Failed to assign ticket",
        variant: "destructive",
      });
    },
  });

  const replyMutation = useMutation({
    mutationFn: ({ ticketId, message }) =>
      supportAPI.addAdminResponse(ticketId, message),
    onSuccess: (data) => {
      toast({
        title: "Reply Sent",
        description: "Your response has been added to the ticket.",
      });
      setReplyMessage("");
      queryClient.invalidateQueries(["adminTickets"]);
      if (selectedTicket && selectedTicket._id === data.data._id) {
        setSelectedTicket(data.data);
      }
    },
    onError: (err) => {
      toast({
        title: "Error",
        description: err.response?.data?.error || "Failed to send response",
        variant: "destructive",
      });
    },
  });

  const handleReplySubmit = (e) => {
    e.preventDefault();
    if (!replyMessage.trim()) return;
    replyMutation.mutate({
      ticketId: selectedTicket._id,
      message: replyMessage,
    });
  };

  const tickets = ticketsData?.data?.tickets || [];
  const pagination = ticketsData?.data?.pagination || {
    currentPage: 1,
    totalPages: 1,
  };

  // Filter tickets on client side by search term
  const filteredTickets = tickets.filter((ticket) => {
    const term = searchTerm.toLowerCase();
    const orgName = ticket.organizationId?.name || "";
    return (
      ticket.subject?.toLowerCase().includes(term) ||
      ticket.userName?.toLowerCase().includes(term) ||
      ticket.userEmail?.toLowerCase().includes(term) ||
      ticket.category?.toLowerCase().includes(term) ||
      orgName.toLowerCase().includes(term)
    );
  });

  const getPriorityBadge = (priority) => {
    const styles = {
      low: "bg-gray-100 text-gray-800 border-gray-200",
      normal: "bg-blue-100 text-blue-800 border-blue-200",
      high: "bg-amber-100 text-amber-800 border-amber-200",
      urgent: "bg-red-100 text-red-800 border-red-200",
    };
    return (
      <Badge
        variant="outline"
        className={`capitalize font-medium ${styles[priority] || styles.normal}`}
      >
        {priority}
      </Badge>
    );
  };

  const getStatusBadge = (status) => {
    const styles = {
      open: "bg-emerald-100 text-emerald-800 border-emerald-200",
      in_progress: "bg-indigo-100 text-indigo-800 border-indigo-200",
      waiting_response: "bg-amber-100 text-amber-800 border-amber-200",
      resolved: "bg-gray-100 text-gray-800 border-gray-200",
      closed: "bg-gray-100 text-gray-600 border-gray-200",
    };
    return (
      <Badge
        variant="outline"
        className={`capitalize font-medium ${styles[status] || styles.open}`}
      >
        {status.replace(/_/g, " ")}
      </Badge>
    );
  };

  return (
    <div className="space-y-4 p-4 min-h-screen bg-gray-50/50">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 bg-amber-100 rounded-sm flex items-center justify-center border border-amber-200">
          <Headphones className="w-6 h-6 text-amber-600" />
        </div>
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Support Tickets</h2>
          <p className="text-gray-600 mt-1">
            Manage and resolve user-submitted help desk tickets
          </p>
        </div>
      </div>

      {/* Filters & Search */}
      <div className="bg-white rounded-sm border border-gray-200 p-4 shadow-sm">
        <div className="flex flex-col md:flex-row gap-3">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              type="text"
              placeholder="Search by subject, email, organization..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 h-9 text-sm"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <Filter className="w-3.5 h-3.5 text-gray-500" />
              <select
                value={statusFilter}
                onChange={(e) => {
                  setStatusFilter(e.target.value);
                  setPage(1);
                }}
                className="h-9 px-3 border border-gray-300 rounded-md text-sm bg-white"
              >
                <option value="all">All Statuses</option>
                <option value="open">Open</option>
                <option value="in_progress">In Progress</option>
                <option value="waiting_response">Waiting Response</option>
                <option value="resolved">Resolved</option>
                <option value="closed">Closed</option>
              </select>
            </div>
            <select
              value={priorityFilter}
              onChange={(e) => {
                setPriorityFilter(e.target.value);
                setPage(1);
              }}
              className="h-9 px-3 border border-gray-300 rounded-md text-sm bg-white"
            >
              <option value="all">All Priorities</option>
              <option value="low">Low</option>
              <option value="normal">Normal</option>
              <option value="high">High</option>
              <option value="urgent">Urgent</option>
            </select>
          </div>
        </div>
      </div>

      {/* Main Content Table */}
      <div className="bg-white rounded-sm border border-gray-200 overflow-hidden shadow-sm">
        {ticketsLoading ? (
          <div className="p-12 text-center text-gray-500">
            Loading support tickets...
          </div>
        ) : filteredTickets.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    Ticket ID
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    Subject & Category
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    Submitter
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    Priority
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  {/* <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    Assigned Agent
                  </th> */}
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    Created At
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    Action
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {filteredTickets.map((ticket) => (
                  <tr
                    key={ticket._id}
                    className="hover:bg-gray-50 transition-colors"
                  >
                    <td className="px-6 py-4 text-sm font-medium text-blue-600">
                      #{ticket._id.slice(-6).toUpperCase()}
                    </td>
                    <td className="px-6 py-4 text-sm">
                      <div className="font-semibold text-gray-900">
                        {ticket.subject}
                      </div>
                      <div className="text-xs text-gray-500 capitalize">
                        {ticket.category}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm">
                      <div className="font-medium text-gray-900">
                        {ticket.userName}
                      </div>
                      <div className="text-xs text-gray-500 flex items-center gap-1">
                        <Mail className="w-3 h-3 flex-shrink-0" />
                        {ticket.userEmail}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm">
                      {getPriorityBadge(ticket.priority)}
                    </td>
                    <td className="px-6 py-4 text-sm">
                      {getStatusBadge(ticket.status)}
                    </td>
                    {/* <td className="px-6 py-4 text-sm text-gray-600">
                      {ticket.assignedToName ? (
                        <div className="flex items-center gap-1.5">
                          <div className="w-5 h-5 bg-amber-100 rounded-full flex items-center justify-center text-[10px] font-bold text-amber-700">
                            {ticket.assignedToName[0]}
                          </div>
                          <span>{ticket.assignedToName}</span>
                        </div>
                      ) : (
                        <span className="text-gray-400 text-xs italic">
                          Unassigned
                        </span>
                      )}
                    </td> */}
                    <td className="px-6 py-4 text-sm text-gray-500">
                      <div className="flex items-center gap-1">
                        <Calendar className="w-3.5 h-3.5" />
                        {new Date(ticket.createdAt).toLocaleDateString()}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right text-sm">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setSelectedTicket(ticket)}
                        className="h-8"
                      >
                        View & Respond
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-center py-12">
            <AlertCircle className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <h3 className="text-lg font-semibold text-gray-900 mb-1">
              No support tickets found
            </h3>
            <p className="text-gray-500 text-sm">
              Try adjusting your search query or filter options.
            </p>
          </div>
        )}

        {/* Pagination */}
        {pagination.totalPages > 1 && (
          <div className="bg-gray-50 border-t border-gray-200 px-6 py-3 flex items-center justify-between">
            <span className="text-sm text-gray-600">
              Page {pagination.currentPage} of {pagination.totalPages}
            </span>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={page <= 1}
                onClick={() => setPage((prev) => Math.max(1, prev - 1))}
              >
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= pagination.totalPages}
                onClick={() =>
                  setPage((prev) => Math.min(pagination.totalPages, prev + 1))
                }
              >
                Next
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Ticket Details Dialog */}
      {selectedTicket && (
        <Dialog
          open={true}
          onOpenChange={(open) => !open && setSelectedTicket(null)}
        >
          <DialogContent className="max-w-4xl max-h-[85vh] flex flex-col p-0 overflow-hidden [&_*]:!rounded-none">
            <DialogHeader className="p-6 border-b border-gray-100 bg-gray-50/50 flex-shrink-0">
              <div className="flex flex-wrap items-center justify-between gap-3 mr-6">
                <div>
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className="text-xs font-semibold text-blue-600 uppercase tracking-wider">
                      #{selectedTicket._id.slice(-6).toUpperCase()}
                    </span>
                    <span className="text-gray-300">|</span>
                    <span className="text-xs text-gray-500 capitalize">
                      {selectedTicket.category} Support
                    </span>
                  </div>
                  <DialogTitle className="text-xl font-bold text-gray-900 leading-snug">
                    {selectedTicket.subject}
                  </DialogTitle>
                </div>
                <div className="flex gap-2">
                  {getPriorityBadge(selectedTicket.priority)}
                  {getStatusBadge(selectedTicket.status)}
                </div>
              </div>
            </DialogHeader>

            <div className="flex-1 flex overflow-hidden min-h-0">
              {/* Left Column - Conversation Stream */}
              <div className="flex-1 flex flex-col overflow-y-auto p-6 space-y-4 border-r border-gray-100">
                {/* User's Original Message */}
                <div className="flex gap-3 items-start bg-slate-50 border border-slate-200/60 p-4">
                  <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                    {selectedTicket.userName[0].toUpperCase()}
                  </div>
                  <div className="space-y-1 flex-1 min-w-0">
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="text-sm font-semibold text-gray-900">
                        {selectedTicket.userName}
                      </span>
                      <span className="text-xs text-gray-400">
                        {new Date(selectedTicket.createdAt).toLocaleString()}
                      </span>
                    </div>
                    <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed select-text">
                      {selectedTicket.message}
                    </p>

                    {/* Ticket Attachments */}
                    {selectedTicket.attachments && selectedTicket.attachments.length > 0 && (
                      <div className="mt-3 pt-3 border-t border-slate-200">
                        <p className="text-xs font-semibold text-gray-500 mb-2 flex items-center gap-1">
                          <Paperclip className="w-3 h-3" />
                          Attachments ({selectedTicket.attachments.length})
                        </p>
                        <div className="flex flex-wrap gap-2">
                          {selectedTicket.attachments.map((att, i) => {
                            const isImage = att.mimeType?.startsWith('image/');
                            return (
                              <a
                                key={i}
                                href={att.fileUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="group flex items-center gap-2 bg-white border border-gray-200 rounded-sm px-2.5 py-1.5 text-xs hover:border-blue-300 hover:bg-blue-50/50 transition-colors"
                              >
                                {isImage ? (
                                  <img
                                    src={att.fileUrl}
                                    alt={att.fileName}
                                    className="w-8 h-8 rounded-sm object-cover border border-gray-200"
                                  />
                                ) : (
                                  <FileIcon className="w-4 h-4 text-gray-400 flex-shrink-0" />
                                )}
                                <div className="flex flex-col min-w-0">
                                  <span className="text-gray-700 font-medium truncate max-w-[140px]">{att.fileName}</span>
                                  <span className="text-gray-400 text-[10px]">
                                    {att.fileSize < 1024 ? att.fileSize + ' B' : att.fileSize < 1024 * 1024 ? (att.fileSize / 1024).toFixed(1) + ' KB' : (att.fileSize / (1024 * 1024)).toFixed(1) + ' MB'}
                                  </span>
                                </div>
                                <Download className="w-3.5 h-3.5 text-gray-400 group-hover:text-blue-500 transition-colors" />
                              </a>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Responses List */}
                {selectedTicket.responses &&
                selectedTicket.responses.length > 0 ? (
                  selectedTicket.responses.map((response, index) => {
                    const isSystemOrSupport =
                      response.respondedByName
                        ?.toLowerCase()
                        .includes("support") ||
                      response.respondedByName?.toLowerCase().includes("admin");
                    return (
                      <div
                        key={index}
                        className={`flex gap-3 items-start p-4 border select-text ${
                          isSystemOrSupport
                            ? "bg-amber-50/40 border-amber-100 ml-6"
                            : "bg-slate-50/50 border-slate-200/50 mr-6"
                        }`}
                      >
                        <div
                          className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0 ${
                            isSystemOrSupport ? "bg-amber-600" : "bg-blue-600"
                          }`}
                        >
                          {response.respondedByName[0].toUpperCase()}
                        </div>
                        <div className="space-y-1 flex-1 min-w-0">
                          <div className="flex items-baseline justify-between gap-2">
                            <span className="text-sm font-semibold text-gray-900">
                              {response.respondedByName}
                            </span>
                            <span className="text-xs text-gray-400">
                              {new Date(response.respondedAt).toLocaleString()}
                            </span>
                          </div>
                          <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">
                            {response.message}
                          </p>
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className="text-center py-4 text-gray-400 text-xs italic">
                    No responses yet. Add a reply below to contact the
                    submitter.
                  </div>
                )}
              </div>

              {/* Right Column - Controls & Metadata */}
              <div className="w-72 bg-gray-50/60 p-6 flex flex-col space-y-5 overflow-y-auto flex-shrink-0">
                {/* Submitter Profile Info */}
                <div className="space-y-2">
                  <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider">
                    Submitter Details
                  </h4>
                  <div className="bg-white border border-gray-200 p-3.5 space-y-2.5">
                    <div className="flex items-center gap-2">
                      <User className="w-4 h-4 text-gray-400" />
                      <div className="text-sm font-semibold text-gray-900 truncate">
                        {selectedTicket.userName}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-gray-500 truncate">
                      <Mail className="w-3.5 h-3.5 text-gray-400" />
                      <span>{selectedTicket.userEmail}</span>
                    </div>
                  </div>
                </div>

                {/* Attachments Section */}
                {selectedTicket.attachments && selectedTicket.attachments.length > 0 && (
                  <div className="space-y-2">
                    <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider flex items-center gap-1">
                      <Paperclip className="w-3 h-3" />
                      Attachments ({selectedTicket.attachments.length})
                    </h4>
                    <div className="bg-white border border-gray-200 p-3 space-y-2">
                      {selectedTicket.attachments.map((att, i) => {
                        const isImage = att.mimeType?.startsWith('image/');
                        return (
                          <div key={i}>
                            {isImage && (
                              <a href={att.fileUrl} target="_blank" rel="noopener noreferrer">
                                <img
                                  src={att.fileUrl}
                                  alt={att.fileName}
                                  className="w-full rounded-sm border border-gray-200 mb-1.5 cursor-pointer hover:opacity-90 transition-opacity"
                                />
                              </a>
                            )}
                            <a
                              href={att.fileUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center gap-2 text-xs text-blue-600 hover:text-blue-800 hover:underline"
                            >
                              {isImage ? <ImageIcon className="w-3.5 h-3.5" /> : <FileIcon className="w-3.5 h-3.5" />}
                              <span className="truncate">{att.fileName}</span>
                              <Download className="w-3 h-3 ml-auto flex-shrink-0" />
                            </a>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Ticket Controls */}
                <div className="space-y-3">
                  <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider">
                    Ticket Controls
                  </h4>

                  {/* Status update */}
                  <div className="space-y-1.5">
                    <label className="text-xs text-gray-600">
                      Ticket Status
                    </label>
                    <select
                      value={selectedTicket.status}
                      onChange={(e) =>
                        updateStatusMutation.mutate({
                          ticketId: selectedTicket._id,
                          status: e.target.value,
                        })
                      }
                      className="w-full h-8 px-2 border border-gray-300 bg-white text-sm"
                      disabled={updateStatusMutation.isPending}
                    >
                      <option value="open">Open</option>
                      <option value="in_progress">In Progress</option>
                      <option value="waiting_response">Waiting Response</option>
                      <option value="resolved">Resolved</option>
                      <option value="closed">Closed</option>
                    </select>
                  </div>

                  {/* Assignment update */}
                  {/* <div className="space-y-1.5">
                    <label className="text-xs text-gray-600">
                      Assign Ticket
                    </label>
                    <select
                      value={selectedTicket.assignedTo || ""}
                      onChange={(e) => {
                        const selectedUserId = e.target.value;
                        const user = adminUsers.find(
                          (u) => u._id === selectedUserId,
                        );
                        assignTicketMutation.mutate({
                          ticketId: selectedTicket._id,
                          assignData: {
                            assignedTo: selectedUserId || null,
                            assignedToName: user
                              ? `${user.firstName} ${user.lastName || ""}`.trim()
                              : null,
                          },
                        });
                      }}
                      className="w-full h-8 px-2 border border-gray-300 bg-white text-sm"
                      disabled={assignTicketMutation.isPending}
                    >
                      <option value="">Unassigned</option>
                      {adminUsers.map((user) => (
                        <option key={user._id} value={user._id}>
                          {user.firstName} {user.lastName || ""}
                        </option>
                      ))}
                    </select>
                  </div> */}
                </div>
              </div>
            </div>

            {/* Response Section */}
            <div className="p-6 border-t border-gray-100 flex-shrink-0 bg-white">
              <form onSubmit={handleReplySubmit} className="space-y-3">
                <Textarea
                  placeholder="Type a response to send to the submitter..."
                  value={replyMessage}
                  onChange={(e) => setReplyMessage(e.target.value)}
                  rows={3}
                  className="resize-none"
                  disabled={replyMutation.isPending}
                />
                <div className="flex justify-end gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setSelectedTicket(null)}
                    disabled={replyMutation.isPending}
                  >
                    Close
                  </Button>
                  <Button
                    type="submit"
                    disabled={replyMutation.isPending || !replyMessage.trim()}
                    className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white"
                  >
                    {replyMutation.isPending ? "Sending..." : "Send Response"}
                    <Send className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </form>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
