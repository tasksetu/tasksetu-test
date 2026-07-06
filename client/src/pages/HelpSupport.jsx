import React, { useState, useRef } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supportAPI } from "@/api/supportAPI";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import useLicense from "@/hooks/useLicense";
import {
  HelpCircle,
  Video,
  FileText,
  Headphones,
  Mail,
  Clock,
  ArrowRight,
  Play,
  ExternalLink,
  Users,
  CheckCircle2,
  Lock,
  Calendar,
  MessageCircle,
  Send,
  Building,
  Zap,
  CheckCircle,
  BarChart3,
  Settings,
  ChevronDown,
  Paperclip,
  X,
  ImageIcon,
  File,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useLocation } from "wouter";

export default function HelpSupport() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { checkFeature } = useLicense();
  const hasDedicatedSupport = checkFeature("DED_SUPPORT");

  // Refs for scrolling
  const faqRef = useRef(null);
  const ticketRef = useRef(null);

  // States
  const [contactForm, setContactForm] = useState({
    subject: "",
    message: "",
    priority: "normal",
    category: "general",
  });
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [userReply, setUserReply] = useState("");
  const [showAllFAQs, setShowAllFAQs] = useState(false);
  const [attachedFiles, setAttachedFiles] = useState([]);
  const fileInputRef = useRef(null);
  const [isDragging, setIsDragging] = useState(false);

  // Fetch support tickets
  const { data: ticketsData } = useQuery({
    queryKey: ["supportTickets"],
    queryFn: () => supportAPI.getTickets({ limit: 10 }),
  });

  const tickets = ticketsData?.data?.tickets || [];

  // Mutations
  // File attachment helpers
  const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
  const MAX_FILES = 5;
  const ALLOWED_TYPES = [
    "image/jpeg",
    "image/jpg",
    "image/png",
    "image/gif",
    "image/webp",
    "application/pdf",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/vnd.ms-excel",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "text/plain",
    "text/csv",
    "application/zip",
  ];

  const handleFileSelect = (files) => {
    const fileArray = Array.from(files);
    const validFiles = [];
    for (const file of fileArray) {
      if (attachedFiles.length + validFiles.length >= MAX_FILES) {
        toast({
          title: "File limit reached",
          description: `Maximum ${MAX_FILES} files allowed.`,
          variant: "destructive",
        });
        break;
      }
      if (file.size > MAX_FILE_SIZE) {
        toast({
          title: "File too large",
          description: `"${file.name}" exceeds 10MB limit.`,
          variant: "destructive",
        });
        continue;
      }
      if (!ALLOWED_TYPES.includes(file.type)) {
        toast({
          title: "Invalid file type",
          description: `"${file.name}" is not a supported file type.`,
          variant: "destructive",
        });
        continue;
      }
      validFiles.push(file);
    }
    if (validFiles.length > 0) {
      setAttachedFiles((prev) => [...prev, ...validFiles]);
    }
  };

  const removeFile = (index) => {
    setAttachedFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const formatFileSize = (bytes) => {
    if (bytes < 1024) return bytes + " B";
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
    return (bytes / (1024 * 1024)).toFixed(1) + " MB";
  };

  const isImageFile = (file) => file.type.startsWith("image/");

  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };
  const handleDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };
  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    if (e.dataTransfer.files?.length > 0)
      handleFileSelect(e.dataTransfer.files);
  };

  const createTicketMutation = useMutation({
    mutationFn: (ticketData) => supportAPI.createTicket(ticketData),
    onSuccess: (data) => {
      toast({
        title: "Ticket Submitted!",
        description: `Your ticket #${data.data._id.slice(-6).toUpperCase()} is created. We will respond within 24 hours.`,
      });
      setContactForm({
        subject: "",
        message: "",
        priority: "normal",
        category: "general",
      });
      setAttachedFiles([]);
      queryClient.invalidateQueries(["supportTickets"]);
      // Scroll to history table
      window.scrollTo({ top: document.body.scrollHeight, behavior: "smooth" });
    },
    onError: (error) => {
      toast({
        title: "Failed to submit ticket",
        description:
          error.response?.data?.message ||
          error.response?.data?.error ||
          "An error occurred.",
        variant: "destructive",
      });
    },
  });

  const userReplyMutation = useMutation({
    mutationFn: ({ ticketId, message }) =>
      supportAPI.addResponse(ticketId, message),
    onSuccess: (data) => {
      toast({
        title: "Reply Sent",
        description: "Your follow-up response has been submitted.",
      });
      setUserReply("");
      queryClient.invalidateQueries(["supportTickets"]);
      if (selectedTicket && selectedTicket._id === data.data._id) {
        setSelectedTicket(data.data);
      }
    },
    onError: (error) => {
      toast({
        title: "Failed to send reply",
        description:
          error.response?.data?.error || "Failed to submit response.",
        variant: "destructive",
      });
    },
  });

  const handleContactSubmit = (e) => {
    e.preventDefault();
    if (!contactForm.subject.trim() || !contactForm.message.trim()) {
      toast({
        title: "Required Fields Missing",
        description: "Please fill in the subject and description fields.",
        variant: "destructive",
      });
      return;
    }

    createTicketMutation.mutate({
      subject: contactForm.subject,
      message: contactForm.message,
      priority: contactForm.priority,
      category: contactForm.category,
      files: attachedFiles,
    });
  };

  const handleUserReplySubmit = (e) => {
    e.preventDefault();
    if (!userReply.trim()) return;
    userReplyMutation.mutate({
      ticketId: selectedTicket._id,
      message: userReply,
    });
  };

  // Scroll Helpers
  const scrollTo = (ref) => {
    ref.current?.scrollIntoView({ behavior: "smooth" });
  };

  // FAQ Data
  const faqCategories = [
    {
      category: "Getting Started",
      icon: Zap,
      color: "text-blue-600",
      bgColor: "bg-blue-100",
      questions: [
        {
          q: "How do I create my first task?",
          a: "Navigate to 'Create Task' from the sidebar or click the '+' button on your dashboard. Fill in the task details including title, description, due date, and assignees, then click 'Create Task'.",
        },
        {
          q: "How do I invite team members to my organization?",
          a: "Go to Settings > User Management, click 'Invite User', enter their email address and assign a role. They'll receive an invitation email to join your organization.",
        },
        {
          q: "What are the different user roles available?",
          a: "TaskSetu offers several roles: Organization Admin (full access), Manager (team management), Employee (standard access), and Individual (personal use). Each role has specific permissions.",
        },
      ],
    },
    {
      category: "Task Management",
      icon: CheckCircle,
      color: "text-green-600",
      bgColor: "bg-green-100",
      questions: [
        {
          q: "How do I set up recurring tasks?",
          a: "When creating or editing a task, enable the 'Recurring' option and select your preferred frequency (daily, weekly, monthly). The system will automatically create new instances based on your schedule.",
        },
        {
          q: "Can I create subtasks?",
          a: "Yes! Open any task and click 'Add Subtask' to break down your work into smaller, manageable pieces. Subtasks can have their own assignees and due dates.",
        },
        {
          q: "How do task approvals work?",
          a: "When a task requires approval, it goes through an approval workflow. The designated approver receives a notification and can approve, reject, or request changes to the task.",
        },
      ],
    },
    {
      category: "Forms & Processes",
      icon: FileText,
      color: "text-purple-600",
      bgColor: "bg-purple-100",
      questions: [
        {
          q: "How do I create a custom form?",
          a: "Go to Form Library, click 'Create Form', and use our drag-and-drop builder to add fields. You can include text inputs, dropdowns, file uploads, and more.",
        },
        {
          q: "Can I share forms externally?",
          a: "Yes! After creating a form, click 'Share' and enable 'Public Link'. You can share this link with anyone, and they can submit responses without logging in.",
        },
        {
          q: "How do I view form submissions?",
          a: "Open the form from your Form Library and click 'Submissions'. You can view, filter, and export all responses received.",
        },
      ],
    },
    {
      category: "Reports & Analytics",
      icon: BarChart3,
      color: "text-orange-600",
      bgColor: "bg-orange-100",
      questions: [
        {
          q: "What reports are available?",
          a: "TaskSetu offers Productivity Reports, Team Analytics, and Organization Overview. Access them from the Reports section in the sidebar.",
        },
        {
          q: "Can I export reports?",
          a: "Yes! Most reports have an 'Export' button that allows you to download data in CSV or PDF format for further analysis or sharing.",
        },
        {
          q: "How is productivity calculated?",
          a: "Productivity metrics are based on tasks completed, on-time delivery rate, and overall engagement. The system tracks these automatically based on your activity.",
        },
      ],
    },
    {
      category: "Subscription & Billing",
      icon: Settings,
      color: "text-indigo-600",
      bgColor: "bg-indigo-100",
      questions: [
        {
          q: "How do I upgrade my plan?",
          a: "Go to Admin > Subscription to view available plans and their features. Click on 'Purchase Licenses' or visit the upgrade page to change your plan.",
        },
        {
          q: "What happens when I exceed my plan limits?",
          a: "You'll receive notifications as you approach limits. If exceeded, some features may be restricted until you upgrade or the next billing cycle begins.",
        },
        {
          q: "Can I cancel my subscription?",
          a: "Yes, you can cancel anytime from the Subscription page. Your access continues until the end of the current billing period.",
        },
      ],
    },
  ];

  // Video Tutorials from Mockup
  const tutorials = [
    {
      number: "1",
      title: "Getting Started with TaskSetu",
      duration: "3:45",
      desc: "Learn the basics and set up your workspace in minutes.",
      link: "https://youtu.be/ThDdHETxA-g?si=_pCpsGySAC6gGYm5",
      bgColor: "bg-slate-900 text-white",
      titleStyle: "Getting Started\nwith TaskSetu",
    },
    {
      number: "2",
      title: "Managing Tasks Effectively",
      duration: "4:12",
      desc: "Create, assign, prioritize and track tasks efficiently.",
      link: "https://youtu.be/ThDdHETxA-g?si=_pCpsGySAC6gGYm5",
      bgColor: "bg-emerald-950 text-white",
      titleStyle: "Managing Tasks\nLike a Pro",
    },
    {
      number: "3",
      title: "Workflows & Automation",
      duration: "5:18",
      desc: "Build workflows, add forms and automate your processes.",
      link: "https://youtu.be/ThDdHETxA-g?si=_pCpsGySAC6gGYm5",
      bgColor: "bg-purple-950 text-white",
      titleStyle: "Workflows &\nAutomation",
    },
  ];

  // Use cases from Mockup
  const useCases = [
    {
      title: "Project Management",
      desc: "Plan, track and deliver projects seamlessly.",
      icon: Users,
      color: "text-emerald-600",
      bgColor: "bg-emerald-50",
      link: "#",
    },
    {
      title: "Team Collaboration",
      desc: "Improve teamwork and keep everyone aligned.",
      icon: FileText,
      color: "text-blue-600",
      bgColor: "bg-blue-50",
      link: "#",
    },
    {
      title: "Operations & Processes",
      desc: "Standardize operations and improve execution.",
      icon: Building,
      color: "text-amber-600",
      bgColor: "bg-amber-50",
      link: "#",
    },
  ];

  return (
    <div className="bg-gray-50/30 min-h-screen pb-12 [&_.card]:!rounded-sm [&_input:not([type='checkbox']):not([type='radio'])]:!rounded-sm [&_select]:!rounded-sm [&_textarea]:!rounded-sm [&_.form-input]:!rounded-sm [&_.form-select]:!rounded-sm [&_.form-textarea]:!rounded-sm [&_button:not(.rounded-full)]:!rounded-sm [&_table]:!rounded-sm [&_.bg-white.border]:!rounded-sm [&_.rounded-sm]:!rounded-sm [&_.rounded-md]:!rounded-sm [&_.rounded-lg]:!rounded-sm [&_.rounded-xl]:!rounded-sm [&_.rounded-2xl]:!rounded-sm [&_.rounded]:!rounded-sm">
      {/* Header Container */}
      <div className="max-w-7xl mx-auto px-4 pt-3 pb-4 ml-2">
        <h1 className="text-2xl font-normal m-0" style={{ color: "#676a6c" }}>
          Help & Support
        </h1>
        <p className="text-sm text-blue-600">
          Find answers, learn and get quick support for TaskSetu
        </p>
      </div>

      <div className="max-w-7xl mx-auto px-4 space-y-6 ml-2">
        {/* 3-Column Middle Section */}
        <div className="grid grid-cols-1 ">
          {/* Column 1: FAQ (lg:col-span-5) */}
          <div
            ref={faqRef}
            className="lg:col-span-6 bg-white border border-gray-200 p-5 shadow-sm"
          >
            <div className="flex items-center justify-between pb-3 border-b border-gray-100 mb-4">
              <h2 className="font-bold text-gray-900 text-sm">
                Frequently Asked Questions
              </h2>
              <button
                onClick={() => setShowAllFAQs(!showAllFAQs)}
                className="text-xs text-blue-600 hover:underline flex items-center gap-1"
              >
                {showAllFAQs ? "Show Less" : "View all"}{" "}
                <ArrowRight
                  className={`w-3 h-3 transition-transform ${showAllFAQs ? "rotate-90" : ""}`}
                />
              </button>
            </div>
            <div
              className={
                showAllFAQs
                  ? "space-y-4"
                  : "max-h-[220px] overflow-y-auto pr-1.5 space-y-4"
              }
            >
              {faqCategories.map((category, catIdx) => (
                <div key={catIdx} className="space-y-2">
                  <div className="flex items-center gap-2 mb-1.5">
                    <div className={cn("p-1.5 rounded-sm", category.bgColor)}>
                      <category.icon
                        className={cn("h-3.5 w-3.5", category.color)}
                      />
                    </div>
                    <h3 className="font-semibold text-gray-800 text-xs">
                      {category.category}
                    </h3>
                  </div>
                  <Accordion type="single" collapsible className="space-y-1.5">
                    {category.questions.map((faq, faqIdx) => (
                      <AccordionItem
                        key={`${catIdx}-${faqIdx}`}
                        value={`faq-${catIdx}-${faqIdx}`}
                        className="border rounded-sm px-3 bg-gray-50/30 hover:bg-gray-50/60 transition-colors"
                      >
                        <AccordionTrigger className="h-9 py-1 text-left text-[11px] font-semibold text-gray-700 leading-normal hover:no-underline">
                          {faq.q}
                        </AccordionTrigger>
                        <AccordionContent className="text-gray-500 text-[11px] leading-relaxed pb-3 pt-1">
                          {faq.a}
                        </AccordionContent>
                      </AccordionItem>
                    ))}
                  </Accordion>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Bottom Section - Support Ticket Form (Ref'd) */}
        <div ref={ticketRef}>
          {/* Support Ticket Form */}
          <div className="bg-white border border-gray-200 p-6 shadow-sm">
            <div className="border-b border-gray-100 pb-3.5 mb-5">
              <h2 className="text-lg font-bold text-gray-900">
                Raise a Support Ticket
              </h2>
              <p className="text-gray-500 text-xs mt-1">
                Submit your issue and our support team will get back to you.
              </p>
            </div>

            <form onSubmit={handleContactSubmit} className="space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {/* Category select */}
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-gray-700">
                    Category *
                  </label>
                  <div className="relative">
                    <select
                      value={contactForm.category}
                      onChange={(e) =>
                        setContactForm({
                          ...contactForm,
                          category: e.target.value,
                        })
                      }
                      className="w-full h-8 pl-3 pr-8 border border-gray-300 bg-white text-xs rounded-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 appearance-none cursor-pointer text-gray-900"
                    >
                      <option value="general">General Inquiry</option>
                      <option value="technical">Technical Support</option>
                      <option value="billing">Billing & Upgrade</option>
                      <option value="account">Account Access</option>
                      <option value="bug_report">Bug Report</option>
                      <option value="feature_request">Feature Request</option>
                    </select>
                    <ChevronDown className="absolute right-2.5 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none opacity-50" />
                  </div>
                </div>

                {/* Priority select */}
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-gray-700">
                    Priority *
                  </label>
                  <div className="relative">
                    <select
                      value={contactForm.priority}
                      onChange={(e) =>
                        setContactForm({
                          ...contactForm,
                          priority: e.target.value,
                        })
                      }
                      className="w-full h-8 pl-3 pr-8 border border-gray-300 bg-white text-xs rounded-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 appearance-none cursor-pointer text-gray-900"
                    >
                      <option value="low">Low</option>
                      <option value="normal">Normal</option>
                      <option value="high" disabled={!hasDedicatedSupport}>
                        High {!hasDedicatedSupport ? "🔒" : ""}
                      </option>
                      {/* <option value="urgent" disabled={!hasDedicatedSupport}>
                        Urgent {!hasDedicatedSupport ? "🔒" : ""}
                      </option> */}
                    </select>
                    <ChevronDown className="absolute right-2.5 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none opacity-50" />
                  </div>
                  {!hasDedicatedSupport && (
                    <p className="text-[10px] text-amber-600 flex items-center gap-1 mt-0.5">
                      <Lock className="w-2.5 h-2.5" /> High require
                      Dedicated Support license.
                    </p>
                  )}
                </div>

                {/* Subject input */}
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-gray-700">
                    Subject *
                  </label>
                  <Input
                    type="text"
                    placeholder="Briefly describe your issue"
                    value={contactForm.subject}
                    onChange={(e) =>
                      setContactForm({
                        ...contactForm,
                        subject: e.target.value,
                      })
                    }
                    className="h-8 text-xs"
                  />
                </div>
              </div>

              {/* Description textarea */}
              <div className="space-y-1">
                <label className="text-xs font-semibold text-gray-700">
                  Description *
                </label>
                <Textarea
                  placeholder="Please provide more details about your issue..."
                  value={contactForm.message}
                  onChange={(e) =>
                    setContactForm({ ...contactForm, message: e.target.value })
                  }
                  rows={5}
                  className="text-xs resize-none"
                />
              </div>

              {/* File Attachments */}
              <div className="space-y-1">
                <label className="text-xs font-semibold text-gray-700">
                  Attachments{" "}
                  <span className="text-gray-400 font-normal">
                    (optional, max 5 files, 10MB each)
                  </span>
                </label>
                <div
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                  className={cn(
                    "border-2 border-dashed rounded-sm p-3 text-center cursor-pointer transition-all duration-200",
                    isDragging
                      ? "border-blue-400 bg-blue-50"
                      : "border-gray-200 hover:border-blue-300 hover:bg-gray-50/50",
                  )}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    multiple
                    accept=".jpg,.jpeg,.png,.gif,.webp,.pdf,.doc,.docx,.xlsx,.xls,.txt,.csv,.zip"
                    className="hidden"
                    onChange={(e) => {
                      if (e.target.files?.length > 0)
                        handleFileSelect(e.target.files);
                      e.target.value = "";
                    }}
                  />
                  <div className="flex flex-col items-center gap-1">
                    <Paperclip className="w-5 h-5 text-gray-400" />
                    <p className="text-xs text-gray-500">
                      <span className="text-blue-600 font-medium">
                        Click to upload
                      </span>{" "}
                      or drag and drop
                    </p>
                    <p className="text-[10px] text-gray-400">
                      Images, PDF, Word, Excel, ZIP (max 10MB)
                    </p>
                  </div>
                </div>

                {/* File Previews */}
                {attachedFiles.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-2">
                    {attachedFiles.map((file, index) => (
                      <div
                        key={index}
                        className="relative group flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-sm px-2.5 py-1.5 text-xs"
                      >
                        {isImageFile(file) ? (
                          <img
                            src={URL.createObjectURL(file)}
                            alt={file.name}
                            className="w-7 h-7 rounded-sm object-cover border border-gray-200"
                          />
                        ) : (
                          <File className="w-4 h-4 text-gray-400 flex-shrink-0" />
                        )}
                        <div className="flex flex-col min-w-0">
                          <span className="text-gray-700 font-medium truncate max-w-[120px]">
                            {file.name}
                          </span>
                          <span className="text-gray-400 text-[10px]">
                            {formatFileSize(file.size)}
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            removeFile(index);
                          }}
                          className="ml-1 p-0.5 rounded-full hover:bg-red-100 text-gray-400 hover:text-red-500 transition-colors"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex justify-end pt-2">
                <Button
                  type="submit"
                  disabled={createTicketMutation.isPending}
                  className="bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs px-6 h-9"
                >
                  {createTicketMutation.isPending
                    ? "Submitting..."
                    : "Submit Ticket"}
                </Button>
              </div>
            </form>
          </div>
        </div>

        {/* Ticket History Section */}
        {tickets.length > 0 && (
          <div className="bg-white border border-gray-200 p-6 shadow-sm">
            <div className="border-b border-gray-100 pb-3 mb-4">
              <h2 className="text-base font-bold text-gray-900">
                Your Support Tickets
              </h2>
              <p className="text-gray-500 text-xs mt-0.5">
                Track and reply to your submitted tickets
              </p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-gray-50/50 border-b border-gray-150">
                    <th className="px-4 py-2.5 text-xs font-semibold text-gray-600">
                      Ticket ID
                    </th>
                    <th className="px-4 py-2.5 text-xs font-semibold text-gray-600">
                      Subject
                    </th>
                    <th className="px-4 py-2.5 text-xs font-semibold text-gray-600">
                      Category
                    </th>
                    <th className="px-4 py-2.5 text-xs font-semibold text-gray-600">
                      Priority
                    </th>
                    <th className="px-4 py-2.5 text-xs font-semibold text-gray-600">
                      Status
                    </th>
                    <th className="px-4 py-2.5 text-xs font-semibold text-gray-600">
                      Created At
                    </th>
                    <th className="px-4 py-2.5 text-right text-xs font-semibold text-gray-600">
                      Action
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {tickets.map((t) => (
                    <tr key={t._id} className="hover:bg-gray-50/30 text-xs">
                      <td className="px-4 py-3 font-semibold text-blue-600">
                        #{t._id.slice(-6).toUpperCase()}
                      </td>
                      <td
                        className="px-4 py-3 font-medium text-gray-800 max-w-xs"
                        title={t.subject}
                      >
                        <div className="flex items-center gap-1.5">
                          <span className="truncate">{t.subject}</span>
                          {t.attachments && t.attachments.length > 0 && (
                            <span
                              className="flex items-center gap-0.5 text-gray-400 flex-shrink-0"
                              title={`${t.attachments.length} attachment(s)`}
                            >
                              <Paperclip className="w-3 h-3" />
                              <span className="text-[10px]">
                                {t.attachments.length}
                              </span>
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-gray-500 capitalize">
                        {t.category}
                      </td>
                      <td className="px-4 py-3">
                        <Badge
                          variant="outline"
                          className="capitalize text-[10px] scale-95 origin-left font-medium"
                        >
                          {t.priority}
                        </Badge>
                      </td>
                      <td className="px-4 py-3">
                        <Badge
                          variant="outline"
                          className="capitalize text-[10px] scale-95 origin-left font-medium bg-slate-50"
                        >
                          {t.status.replace(/_/g, " ")}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-gray-400">
                        {new Date(t.createdAt).toLocaleDateString()}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setSelectedTicket(t)}
                          className="h-7 text-[11px]"
                        >
                          View & Reply
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Response Policy Section */}
        <div className="bg-blue-50/50 border border-blue-100 p-5 shadow-sm">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-5">
            <div className="flex items-center gap-6">
              <div className="space-y-1">
                <p className="text-xs font-medium text-blue-600 uppercase tracking-wider">
                  Response Policy
                </p>
                <h3 className="text-base font-bold text-gray-900">
                  We usually respond within
                </h3>
                <h2 className="text-4xl font-extrabold text-blue-600 leading-none py-1">
                  24 hours
                </h2>
              </div>
            </div>

            <ul className="flex flex-wrap gap-x-6 gap-y-2 text-xs text-gray-600">
              <li className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-blue-500" />
                Detailed responses
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-blue-500" />
                Step-by-step solutions
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-blue-500" />
                Personalized support
              </li>
            </ul>

            <div className="flex items-center gap-2.5 md:border-l md:border-blue-100 md:pl-6">
              <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                <Mail className="w-4 h-4 text-blue-600" />
              </div>
              <div className="min-w-0">
                <p className="text-[10px] text-gray-400">
                  Direct Email Support
                </p>
                <a
                  href="mailto:support@tasksetu.com"
                  className="text-xs font-semibold text-blue-600 hover:underline"
                >
                  support@tasksetu.com
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Ticket Details Chat Dialog */}
      {selectedTicket && (
        <Dialog
          open={true}
          onOpenChange={(open) => !open && setSelectedTicket(null)}
        >
          <DialogContent className="max-w-3xl max-h-[80vh] flex flex-col p-0 overflow-hidden">
            <DialogHeader className="p-5 border-b border-gray-100 bg-gray-50/50 flex-shrink-0">
              <div className="flex justify-between items-start gap-4 mr-6">
                <div>
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className="text-[10px] font-bold text-blue-600 uppercase tracking-wide">
                      #{selectedTicket._id.slice(-6).toUpperCase()}
                    </span>
                    <span className="text-gray-300">•</span>
                    <span className="text-[10px] text-gray-500 capitalize">
                      {selectedTicket.category} Ticket
                    </span>
                  </div>
                  <DialogTitle className="text-lg font-bold text-gray-900 leading-snug">
                    {selectedTicket.subject}
                  </DialogTitle>
                </div>
                <div className="flex gap-1.5 flex-shrink-0">
                  <Badge variant="outline" className="capitalize text-[10px]">
                    {selectedTicket.priority}
                  </Badge>
                  <Badge
                    variant="outline"
                    className="capitalize text-[10px] bg-slate-50"
                  >
                    {selectedTicket.status.replace(/_/g, " ")}
                  </Badge>
                </div>
              </div>
            </DialogHeader>

            {/* Conversation Flow */}
            <div className="flex-1 overflow-y-auto p-5 space-y-4 bg-slate-50/30">
              {/* Main Issue */}
              <div className="flex gap-3 items-start bg-white border border-gray-150 p-4 shadow-sm">
                <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                  {selectedTicket.userName[0].toUpperCase()}
                </div>
                <div className="space-y-1 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-semibold text-gray-900">
                      {selectedTicket.userName}
                    </span>
                    <span className="text-[10px] text-gray-400">
                      {new Date(selectedTicket.createdAt).toLocaleString()}
                    </span>
                  </div>
                  <p className="text-xs text-gray-600 whitespace-pre-wrap leading-relaxed">
                    {selectedTicket.message}
                  </p>

                  {/* Ticket Attachments */}
                  {selectedTicket.attachments &&
                    selectedTicket.attachments.length > 0 && (
                      <div className="mt-3 pt-3 border-t border-gray-100">
                        <p className="text-[10px] font-semibold text-gray-500 mb-2 flex items-center gap-1">
                          <Paperclip className="w-3 h-3" />
                          Attachments ({selectedTicket.attachments.length})
                        </p>
                        <div className="space-y-2">
                          {/* Image Previews */}
                          {selectedTicket.attachments.filter((att) =>
                            att.mimeType?.startsWith("image/"),
                          ).length > 0 && (
                            <div className="flex flex-wrap gap-2">
                              {selectedTicket.attachments
                                .filter((att) =>
                                  att.mimeType?.startsWith("image/"),
                                )
                                .map((att, i) => (
                                  <a
                                    key={i}
                                    href={att.fileUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="block"
                                  >
                                    <img
                                      src={att.fileUrl}
                                      alt={att.fileName}
                                      className="w-20 h-20 rounded-sm object-cover border border-gray-200 hover:opacity-80 transition-opacity cursor-pointer"
                                    />
                                  </a>
                                ))}
                            </div>
                          )}
                          {/* All File Links */}
                          <div className="flex flex-wrap gap-1.5">
                            {selectedTicket.attachments.map((att, i) => {
                              const isImage =
                                att.mimeType?.startsWith("image/");
                              return (
                                <a
                                  key={i}
                                  href={att.fileUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="group flex items-center gap-1.5 bg-gray-50 border border-gray-200 rounded-sm px-2 py-1 text-[10px] hover:border-blue-300 hover:bg-blue-50/50 transition-colors"
                                >
                                  {isImage ? (
                                    <ImageIcon className="w-3 h-3 text-gray-400" />
                                  ) : (
                                    <File className="w-3 h-3 text-gray-400" />
                                  )}
                                  <span className="text-gray-600 font-medium truncate max-w-[100px]">
                                    {att.fileName}
                                  </span>
                                  <span className="text-gray-400">
                                    {att.fileSize < 1024
                                      ? att.fileSize + " B"
                                      : att.fileSize < 1024 * 1024
                                        ? (att.fileSize / 1024).toFixed(1) +
                                          " KB"
                                        : (
                                            att.fileSize /
                                            (1024 * 1024)
                                          ).toFixed(1) + " MB"}
                                  </span>
                                </a>
                              );
                            })}
                          </div>
                        </div>
                      </div>
                    )}
                </div>
              </div>

              {/* Replies */}
              {selectedTicket.responses &&
              selectedTicket.responses.length > 0 ? (
                selectedTicket.responses.map((response, index) => {
                  const isAgent =
                    response.respondedByName
                      ?.toLowerCase()
                      .includes("support") ||
                    response.respondedByName?.toLowerCase().includes("admin");
                  return (
                    <div
                      key={index}
                      className={`flex gap-3 items-start p-4 border shadow-sm ${
                        isAgent
                          ? "bg-amber-50/30 border-amber-100 ml-6"
                          : "bg-white border-gray-150 mr-6"
                      }`}
                    >
                      <div
                        className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0 ${
                          isAgent ? "bg-amber-600" : "bg-blue-600"
                        }`}
                      >
                        {response.respondedByName[0].toUpperCase()}
                      </div>
                      <div className="space-y-1 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs font-semibold text-gray-900">
                            {response.respondedByName}
                          </span>
                          <span className="text-[10px] text-gray-400">
                            {new Date(response.respondedAt).toLocaleString()}
                          </span>
                        </div>
                        <p className="text-xs text-gray-600 whitespace-pre-wrap leading-relaxed">
                          {response.message}
                        </p>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="text-center py-2 text-gray-400 text-[11px] italic">
                  No responses from support yet.
                </div>
              )}
            </div>

            {/* User Reply Input */}
            {selectedTicket.status !== "closed" && (
              <div className="p-4 border-t border-gray-100 flex-shrink-0 bg-white">
                <form onSubmit={handleUserReplySubmit} className="space-y-3">
                  <Textarea
                    placeholder="Type a follow-up message..."
                    value={userReply}
                    onChange={(e) => setUserReply(e.target.value)}
                    rows={2.5}
                    className="text-xs resize-none"
                    disabled={userReplyMutation.isPending}
                  />
                  <div className="flex justify-end gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setSelectedTicket(null)}
                      disabled={userReplyMutation.isPending}
                      className="h-8 text-xs"
                    >
                      Close
                    </Button>
                    <Button
                      type="submit"
                      disabled={
                        userReplyMutation.isPending || !userReply.trim()
                      }
                      className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold px-4 h-8 flex items-center gap-1"
                    >
                      {userReplyMutation.isPending
                        ? "Sending..."
                        : "Send Message"}
                      <Send className="w-3 h-3" />
                    </Button>
                  </div>
                </form>
              </div>
            )}
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
