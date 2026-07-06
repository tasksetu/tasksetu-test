import React, { useState } from "react";
import { Link } from "wouter";
import {
  Book,
  ChevronRight,
  Search,
  FileText,
  Shield,
  Zap,
  Users,
  Settings,
  HelpCircle,
  Menu,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

export default function Documentation() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [activeSection, setActiveSection] = useState("introduction");

  const sections = [
    {
      id: "introduction",
      title: "Introduction",
      icon: Book,
      content: (
        <div className="space-y-6">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 mb-4">
              TaskSetu Documentation
            </h1>
            <p className="text-lg text-gray-600 leading-relaxed">
              Welcome to the official TaskSetu documentation. This comprehensive
              guide is designed for everyone—from individual freelancers
              managing personal projects to large organizations coordinating
              multiple teams.
            </p>
            <p className="text-lg text-gray-600 leading-relaxed mt-4">
              Whether you are using TaskSetu for personal productivity or
              enterprise collaboration, you'll find the resources you need here.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-8">
            <div className="p-4 bg-blue-50 rounded-xl border border-blue-100">
              <h3 className="text-lg font-semibold text-blue-900 mb-2">
                For Individuals
              </h3>
              <p className="text-blue-700 mb-4">
                Learn how to boost your personal productivity with task tracking
                and recurring reminders.
              </p>
              <Button
                variant="link"
                className="p-0 h-auto text-blue-600 font-semibold"
                onClick={() => scrollToSection("user-types")}
              >
                Learn More <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            </div>
            <div className="p-4 bg-green-50 rounded-xl border border-green-100">
              <h3 className="text-lg font-semibold text-green-900 mb-2">
                For Organizations
              </h3>
              <p className="text-green-700 mb-4">
                Discover powerful team management, approval workflows, and
                role-based access controls.
              </p>
              <Button
                variant="link"
                className="p-0 h-auto text-green-600 font-semibold"
                onClick={() => scrollToSection("user-types")}
              >
                Explore Roles <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            </div>
          </div>
        </div>
      ),
    },
    {
      id: "user-types",
      title: "User Types & Roles",
      icon: Users,
      content: (
        <div className="space-y-6">
          <h2 className="text-2xl font-bold text-gray-900">
            User Types & Roles
          </h2>
          <p className="text-gray-600">
            TaskSetu is built for both individual professionals and teams.
            Understanding your user type helps you get the most out of the
            platform.
          </p>

          <div className="space-y-6 mt-6">
            <section>
              <h3 className="text-xl font-bold text-blue-800 flex items-center gap-2">
                <Users className="h-5 w-5" />
                Individual Users
              </h3>
              <div className="pl-7 mt-2 text-gray-700">
                <p className="mb-2">
                  <strong>Best for:</strong> Freelancers, Consultants, Solo
                  Entrepreneurs.
                </p>
                <p>
                  As an Individual user, you have complete control over your
                  personal workspace.
                </p>
                <ul className="list-disc pl-5 mt-2 space-y-1">
                  <li>Create and unlimited tasks and quick notes.</li>
                  <li>Set up recurring tasks and personal milestones.</li>
                  <li>Manage your own schedule without needing approval.</li>
                  <li>
                    <strong>Note:</strong> You cannot add other members to your
                    workspace or assign tasks to others.
                  </li>
                </ul>
              </div>
            </section>

            <div className="h-px bg-gray-200 w-full" />

            <section>
              <h3 className="text-xl font-bold text-indigo-800 flex items-center gap-2">
                <Shield className="h-5 w-5" />
                Organization Users
              </h3>
              <div className="pl-7 mt-2 text-gray-700">
                <p className="mb-2">
                  <strong>Best for:</strong> Companies, Startups, Agencies,
                  Departments.
                </p>
                <p>
                  Organization accounts allow for collaboration, hierarchy, and
                  shared resource management.
                </p>

                <div className="grid md:grid-cols-2 gap-4 mt-4">
                  <div className="bg-gray-50 p-4 rounded-sm border border-gray-100">
                    <strong className="block text-gray-900 mb-1">
                      Organization Admin
                    </strong>
                    <p className="text-sm">
                      Full control. Can invite users, manage billing, purchase
                      licenses, and oversee all projects.
                    </p>
                  </div>
                  <div className="bg-gray-50 p-4 rounded-sm border border-gray-100">
                    <strong className="block text-gray-900 mb-1">
                      Manager
                    </strong>
                    <p className="text-sm">
                      Team leader. Can create tasks, assign them to employees,
                      approve work, and view team reports.
                    </p>
                  </div>
                  <div className="bg-gray-50 p-4 rounded-sm border border-gray-100">
                    <strong className="block text-gray-900 mb-1">
                      Employee
                    </strong>
                    <p className="text-sm">
                      Team member. Can receive tasks, submit updates, and create
                      internal tasks.
                    </p>
                  </div>
                </div>
              </div>
            </section>
          </div>
        </div>
      ),
    },
    {
      id: "getting-started",
      title: "Getting Started",
      icon: Zap,
      content: (
        <div className="space-y-6">
          <h2 className="text-2xl font-bold text-gray-900">Getting Started</h2>
          <div className="prose prose-blue max-w-none text-gray-600">
            <p>
              TaskSetu is designed to be intuitive and easy to use. Follow these
              simple steps to get your workspace ready.
            </p>

            <h3 className="text-xl font-semibold text-gray-800 mt-6 mb-3">
              1. Setting up your Profile
            </h3>
            <p>
              After logging in for the first time, navigate to the Settings page
              to update your profile information. Upload a profile picture to
              help your team identify you easily.
            </p>

            <h3 className="text-xl font-semibold text-gray-800 mt-6 mb-3">
              2. Creating your First Task
            </h3>
            <p>
              Click the{" "}
              <span className="font-semibold text-blue-600">+ New Task</span>{" "}
              button in the navigation bar. Fill in the task details such as
              title, description, due date, and priority. Assign it to yourself
              or a team member.
            </p>

            <h3 className="text-xl font-semibold text-gray-800 mt-6 mb-3">
              3. Understanding the Dashboard
            </h3>
            <p>
              Your dashboard gives you a quick overview of your work. You can
              see:
            </p>
            <ul className="list-disc pl-5 space-y-2 mt-2">
              <li>
                <strong>Pending Tasks:</strong> Tasks assigned to you that are
                not yet complete.
              </li>
              <li>
                <strong>Priorities:</strong> Tasks marked as High or Urgent
                priority.
              </li>
              <li>
                <strong>Team Activity:</strong> Recent updates from your team
                members (for managers).
              </li>
            </ul>
          </div>
        </div>
      ),
    },
    {
      id: "task-management",
      title: "Task Management",
      icon: FileText,
      content: (
        <div className="space-y-6">
          <h2 className="text-2xl font-bold text-gray-900">Task Management</h2>
          <div className="prose max-w-none text-gray-600">
            <p>
              Effective task management is the core of TaskSetu. Learn about the
              different types of tasks and statuses available.
            </p>

            <h3 className="text-xl font-semibold text-gray-800 mt-6 mb-3">
              Task Types
            </h3>
            <p className="mb-4">
              Different tasks serve different purposes in your workflow. Note
              that some types are only available to organization users.
            </p>
            <div className="grid gap-4 mt-4">
              <div className="border border-gray-200 rounded-sm p-4">
                <div className="flex items-center gap-2 mb-1">
                  <strong className="text-gray-900">Regular Task</strong>
                  <span className="px-2 py-0.5 bg-blue-100 text-blue-800 text-xs rounded-full">
                    All Users
                  </span>
                </div>
                <p>
                  Standard one-time task with a specific deadline, priority, and
                  assignee.
                </p>
              </div>
              <div className="border border-gray-200 rounded-sm p-4">
                <div className="flex items-center gap-2 mb-1">
                  <strong className="text-gray-900">Recurring Task</strong>
                  <span className="px-2 py-0.5 bg-blue-100 text-blue-800 text-xs rounded-full">
                    All Users
                  </span>
                </div>
                <p>
                  Tasks that automatically repeat on a schedule (Daily, Weekly,
                  Monthly, Yearly). Ideal for regular reports, meetings, or
                  maintenance.
                </p>
              </div>
              <div className="border border-gray-200 rounded-sm p-4">
                <div className="flex items-center gap-2 mb-1">
                  <strong className="text-gray-900">Milestone</strong>
                  <span className="px-2 py-0.5 bg-blue-100 text-blue-800 text-xs rounded-full">
                    All Users
                  </span>
                </div>
                <p>
                  Major project checkpoints or goals. Milestones help track
                  high-level progress and don't typically have recurring
                  patterns.
                </p>
              </div>
              <div className="border border-gray-200 rounded-sm p-4 bg-purple-50 border-purple-100">
                <div className="flex items-center gap-2 mb-1">
                  <strong className="text-purple-900">Approval Task</strong>
                  <span className="px-2 py-0.5 bg-purple-200 text-purple-800 text-xs rounded-full">
                    Org Users Only
                  </span>
                </div>
                <p className="text-purple-800">
                  Special tasks that require a manager or admin to review and
                  sign off before completion. Ideal for document reviews or
                  budget approvals.
                </p>
              </div>
            </div>

            <h3 className="text-xl font-semibold text-gray-800 mt-6 mb-3">
              Task Statuses
            </h3>
            <p>Keep your team informed by keeping task statuses up to date:</p>
            <div className="grid sm:grid-cols-2 gap-3 mt-3">
              <div className="flex items-center gap-3 p-2 bg-gray-50 rounded-sm">
                <span className="px-2 py-1 bg-gray-200 text-gray-700 rounded text-xs font-bold uppercase w-20 text-center">
                  To Do
                </span>
                <span className="text-sm">
                  Task created but work hasn't started.
                </span>
              </div>
              <div className="flex items-center gap-3 p-2 bg-gray-50 rounded-sm">
                <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded text-xs font-bold uppercase w-20 text-center">
                  In Progress
                </span>
                <span className="text-sm">Work is currently underway.</span>
              </div>
              <div className="flex items-center gap-3 p-2 bg-gray-50 rounded-sm">
                <span className="px-2 py-1 bg-yellow-100 text-yellow-700 rounded text-xs font-bold uppercase w-20 text-center">
                  In Review
                </span>
                <span className="text-sm">
                  Waiting for feedback or approval.
                </span>
              </div>
              <div className="flex items-center gap-3 p-2 bg-gray-50 rounded-sm">
                <span className="px-2 py-1 bg-red-100 text-red-700 rounded text-xs font-bold uppercase w-20 text-center">
                  Blocked
                </span>
                <span className="text-sm">
                  Use this when you cannot proceed due to external factors.
                </span>
              </div>
              <div className="flex items-center gap-3 p-2 bg-gray-50 rounded-sm">
                <span className="px-2 py-1 bg-green-100 text-green-700 rounded text-xs font-bold uppercase w-20 text-center">
                  Done
                </span>
                <span className="text-sm">
                  Task has been successfully completed.
                </span>
              </div>
              <div className="flex items-center gap-3 p-2 bg-gray-50 rounded-sm">
                <span className="px-2 py-1 bg-gray-300 text-gray-600 rounded text-xs font-bold uppercase w-20 text-center">
                  Cancelled
                </span>
                <span className="text-sm">
                  Task is no longer needed or relevant.
                </span>
              </div>
            </div>

            <h3 className="text-xl font-semibold text-gray-800 mt-6 mb-3">
              Priorities
            </h3>
            <ul className="list-disc pl-5 space-y-2 mt-2">
              <li>
                <strong className="text-gray-600">Low:</strong> Routine tasks
                with flexible deadlines.
              </li>
              <li>
                <strong className="text-blue-600">Medium:</strong> Standard
                tasks that need to be done soon.
              </li>
              <li>
                <strong className="text-orange-600">High:</strong> Important
                tasks that require immediate attention.
              </li>
              <li>
                <strong className="text-red-600">Critical:</strong> Urgent
                issues or blockers that must be resolved ASAP.
              </li>
            </ul>
          </div>
        </div>
      ),
    },

    {
      id: "team-collaboration",
      title: "Team Collaboration",
      icon: Users,
      content: (
        <div className="space-y-6">
          <h2 className="text-2xl font-bold text-gray-900">
            Team Collaboration
          </h2>
          <div className="prose max-w-none text-gray-600">
            <p>TaskSetu makes it easy to work together.</p>

            <h3 className="text-xl font-semibold text-gray-800 mt-6 mb-3">
              Comments & Mentions
            </h3>
            <p>
              Use the comments section on any task to discuss details, ask
              questions, or provide updates. You can mention team members using{" "}
              <code>@username</code> to notify them specifically.
            </p>

            <h3 className="text-xl font-semibold text-gray-800 mt-6 mb-3">
              File Attachments
            </h3>
            <p>
              Share documents, images, and other files directly within a task.
              All attachments are stored securely and can be accessed by anyone
              with access to the task.
            </p>
          </div>
        </div>
      ),
    },
    {
      id: "admin-guide",
      title: "Admin Guide",
      icon: Shield,
      content: (
        <div className="space-y-6">
          <h2 className="text-2xl font-bold text-gray-900">
            Administrator Guide
          </h2>
          <div className="prose max-w-none text-gray-600">
            <p>
              Organization Admins have full control over the workspace settings
              and user management.
            </p>

            <h3 className="text-xl font-semibold text-gray-800 mt-6 mb-3">
              Managing Users
            </h3>
            <p>
              Go to <span className="font-semibold">Settings &gt; Users</span>{" "}
              to invite new members, deactivate accounts, or change user roles.
            </p>

            <h3 className="text-xl font-semibold text-gray-800 mt-6 mb-3">
              License Management
            </h3>
            <p>
              Monitor your license usage and subscription status in the{" "}
              <span className="font-semibold">Subscription</span> section. You
              can purchase additional seats or upgrade your plan at any time.
            </p>
          </div>
        </div>
      ),
    },
    {
      id: "support",
      title: "Support",
      icon: HelpCircle,
      content: (
        <div className="space-y-6">
          <h2 className="text-2xl font-bold text-gray-900">Need More Help?</h2>
          <div className="prose max-w-none text-gray-600">
            <p>
              If you couldn't find the answer in this documentation, our support
              team is here to help.
            </p>

            <div className="bg-gradient-to-r from-indigo-50 to-blue-50 p-4 rounded-xl border border-indigo-100 mt-4">
              <h3 className="text-lg font-semibold text-indigo-900 mb-2">
                Contact Support
              </h3>
              <p className="text-indigo-700 mb-4">
                You can reach out to us directly through the Help & Support page
                in your dashboard.
              </p>
              <Link href="/help">
                <Button className="bg-indigo-600 hover:bg-indigo-700">
                  Go to Help & Support
                </Button>
              </Link>
            </div>
          </div>
        </div>
      ),
    },
  ];

  const scrollToSection = (id) => {
    setActiveSection(id);
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: "smooth", block: "start" });
    }
    setSidebarOpen(false);
  };

  return (
    <div className="min-h-screen bg-white flex flex-col md:flex-row">
      {/* Mobile Header */}
      <div className="md:hidden bg-white border-b border-gray-200 p-4 flex items-center justify-between sticky top-0 z-20">
        <div className="flex items-center gap-2 font-bold text-lg text-blue-600">
          <Book className="h-5 w-5" />
          <span>Docs</span>
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setSidebarOpen(!sidebarOpen)}
        >
          {sidebarOpen ? (
            <X className="h-5 w-5" />
          ) : (
            <Menu className="h-5 w-5" />
          )}
        </Button>
      </div>

      {/* Sidebar Navigation */}
      <aside
        className={cn(
          "fixed md:sticky top-0 h-[calc(100vh-60px)] md:h-screen w-full md:w-64 bg-gray-50 border-r border-gray-200 z-10 transition-transform duration-300 ease-in-out transform overflow-y-auto",
          sidebarOpen
            ? "translate-x-0 top-[60px]"
            : "-translate-x-full md:translate-x-0 md:top-0",
        )}
      >
        <div className="p-4">
          <div className="hidden md:flex items-center gap-2 font-bold text-xl text-blue-600 mb-8">
            <Book className="h-6 w-6" />
            <span>Documentation</span>
          </div>

          <nav className="space-y-1">
            {sections.map((section) => (
              <button
                key={section.id}
                onClick={() => scrollToSection(section.id)}
                className={cn(
                  "w-full flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-sm transition-colors",
                  activeSection === section.id
                    ? "bg-blue-100 text-blue-700"
                    : "text-gray-600 hover:bg-gray-100 hover:text-gray-900",
                )}
              >
                <section.icon
                  className={cn(
                    "h-4 w-4",
                    activeSection === section.id
                      ? "text-blue-600"
                      : "text-gray-400",
                  )}
                />
                {section.title}
              </button>
            ))}
          </nav>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 min-w-0 bg-white">
        <ScrollArea className="h-screen">
          <div className="max-w-4xl mx-auto p-4">
            {/* Search can go here later */}

            <div className="space-y-3">
              {sections.map((section) => (
                <section
                  key={section.id}
                  id={section.id}
                  className="scroll-mt-14"
                >
                  {section.content}
                  <div className="h-px bg-gray-100 w-full mt-12" />
                </section>
              ))}
            </div>
          </div>
        </ScrollArea>
      </main>
    </div>
  );
}
