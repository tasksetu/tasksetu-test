import React, { useState, useEffect } from "react";
import {
  Calendar,
  Clock,
  User,
  Tag,
  AlertTriangle,
  Sparkles,
  Send,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  format,
  addDays,
  addWeeks,
  addMonths,
  parseISO,
  isValid,
} from "date-fns";
import axios from "axios";
import { useShowToast } from "@/utils/ToastMessage";

const SmartTaskParser = ({ isOpen, onClose, onTaskCreated, currentUser }) => {
  const [inputText, setInputText] = useState("");
  const [parsedTask, setParsedTask] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [suggestions, setSuggestions] = useState([]);
  const { showSuccessToast, showErrorToast } = useShowToast();

  // Smart parsing patterns
  const patterns = {
    dueDate: {
      tomorrow: /tomorrow|tmr/i,
      today: /today/i,
      thisWeek: /this week/i,
      nextWeek: /next week/i,
      thisMonth: /this month/i,
      nextMonth: /next month/i,
      specificDate: /(\d{1,2}\/\d{1,2}\/\d{4}|\d{4}-\d{2}-\d{2})/,
      dayName: /(monday|tuesday|wednesday|thursday|friday|saturday|sunday)/i,
      relative: /in (\d+) (day|days|week|weeks|month|months)/i,
    },
    priority: {
      urgent: /urgent|asap|critical|emergency/i,
      high: /high priority|important|high/i,
      medium: /medium priority|medium|normal/i,
      low: /low priority|low|minor/i,
    },
    assignee: {
      mention: /@(\w+)/g,
      assignTo: /assign to (\w+)|assigned to (\w+)/i,
    },
    tags: {
      hashtag: /#(\w+)/g,
      category: /category:?\s*(\w+)/i,
    },
    time: {
      specific: /at (\d{1,2}):(\d{2})\s*(am|pm)?/i,
      duration: /for (\d+) (hour|hours|minute|minutes)/i,
    },
    recurrence: {
      daily: /daily|every day/i,
      weekly: /weekly|every week/i,
      monthly: /monthly|every month/i,
      custom: /every (\d+) (day|days|week|weeks|month|months)/i,
    },
  };

  // Example suggestions
  const exampleSuggestions = [
    "Review quarterly reports by Friday @john #finance high priority",
    "Team meeting tomorrow at 2pm for 1 hour #meeting",
    "Call client about project status urgent @sarah",
    "Update website content next week #development",
    "Monthly team retrospective every month #team",
    "Prepare presentation for board meeting by March 15th #presentation urgent",
  ];

  useEffect(() => {
    if (inputText.trim()) {
      const timeoutId = setTimeout(() => {
        parseTaskFromText(inputText);
      }, 500);
      return () => clearTimeout(timeoutId);
    } else {
      setParsedTask(null);
    }
  }, [inputText]);

  const parseTaskFromText = async (text) => {
    setIsProcessing(true);

    try {
      // Extract title (everything before the first modifier)
      let title = text;
      const modifiers = [
        "by ",
        "due ",
        "at ",
        "@",
        "#",
        "assign",
        "priority",
        "urgent",
        "high",
        "medium",
        "low",
      ];

      for (const modifier of modifiers) {
        const index = text.toLowerCase().indexOf(modifier.toLowerCase());
        if (index !== -1) {
          title = text.substring(0, index).trim();
          break;
        }
      }

      if (!title) title = text;

      // Parse due date
      let dueDate = null;
      let dueTime = null;

      if (patterns.dueDate.tomorrow.test(text)) {
        dueDate = addDays(new Date(), 1);
      } else if (patterns.dueDate.today.test(text)) {
        dueDate = new Date();
      } else if (patterns.dueDate.thisWeek.test(text)) {
        dueDate = addDays(new Date(), 7);
      } else if (patterns.dueDate.nextWeek.test(text)) {
        dueDate = addWeeks(new Date(), 1);
      } else if (patterns.dueDate.thisMonth.test(text)) {
        dueDate = addDays(new Date(), 30);
      } else if (patterns.dueDate.nextMonth.test(text)) {
        dueDate = addMonths(new Date(), 1);
      } else if (patterns.dueDate.specificDate.test(text)) {
        const match = text.match(patterns.dueDate.specificDate);
        if (match) {
          const parsed = parseISO(match[0]) || new Date(match[0]);
          if (isValid(parsed)) {
            dueDate = parsed;
          }
        }
      } else if (patterns.dueDate.relative.test(text)) {
        const match = text.match(patterns.dueDate.relative);
        if (match) {
          const amount = parseInt(match[1]);
          const unit = match[2];

          if (unit.includes("day")) {
            dueDate = addDays(new Date(), amount);
          } else if (unit.includes("week")) {
            dueDate = addWeeks(new Date(), amount);
          } else if (unit.includes("month")) {
            dueDate = addMonths(new Date(), amount);
          }
        }
      }

      // Parse time
      if (patterns.time.specific.test(text)) {
        const match = text.match(patterns.time.specific);
        if (match) {
          let hours = parseInt(match[1]);
          const minutes = parseInt(match[2]);
          const ampm = match[3]?.toLowerCase();

          if (ampm === "pm" && hours !== 12) hours += 12;
          if (ampm === "am" && hours === 12) hours = 0;

          dueTime = `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}`;
        }
      }

      // Parse priority
      let priority = "medium";
      if (patterns.priority.urgent.test(text)) {
        priority = "urgent";
      } else if (patterns.priority.high.test(text)) {
        priority = "high";
      } else if (patterns.priority.low.test(text)) {
        priority = "low";
      }

      // Parse assignees
      const assignees = [];
      const mentionMatches = text.matchAll(patterns.assignee.mention);
      for (const match of mentionMatches) {
        assignees.push(match[1]);
      }

      // Parse tags
      const tags = [];
      const tagMatches = text.matchAll(patterns.tags.hashtag);
      for (const match of tagMatches) {
        tags.push(match[1]);
      }

      // Parse category
      let category = null;
      if (patterns.tags.category.test(text)) {
        const match = text.match(patterns.tags.category);
        category = match[1];
      }

      // Parse duration
      let estimatedDuration = null;
      if (patterns.time.duration.test(text)) {
        const match = text.match(patterns.time.duration);
        if (match) {
          const amount = parseInt(match[1]);
          const unit = match[2];
          estimatedDuration = unit.includes("hour") ? amount * 60 : amount;
        }
      }

      // Parse recurrence
      let recurrence = null;
      if (patterns.recurrence.daily.test(text)) {
        recurrence = { type: "daily", interval: 1 };
      } else if (patterns.recurrence.weekly.test(text)) {
        recurrence = { type: "weekly", interval: 1 };
      } else if (patterns.recurrence.monthly.test(text)) {
        recurrence = { type: "monthly", interval: 1 };
      } else if (patterns.recurrence.custom.test(text)) {
        const match = text.match(patterns.recurrence.custom);
        if (match) {
          const interval = parseInt(match[1]);
          const unit = match[2];
          if (unit.includes("day")) {
            recurrence = { type: "daily", interval };
          } else if (unit.includes("week")) {
            recurrence = { type: "weekly", interval };
          } else if (unit.includes("month")) {
            recurrence = { type: "monthly", interval };
          }
        }
      }

      const parsed = {
        title: title || "Untitled Task",
        description: text,
        dueDate: dueDate ? format(dueDate, "yyyy-MM-dd") : null,
        dueTime,
        priority,
        assignees,
        tags,
        category,
        estimatedDuration,
        recurrence,
        confidence: calculateConfidence(
          text,
          title,
          dueDate,
          priority,
          assignees,
          tags,
        ),
      };

      setParsedTask(parsed);
    } catch (error) {
      console.error("Error parsing task:", error);
      setParsedTask(null);
    } finally {
      setIsProcessing(false);
    }
  };

  const calculateConfidence = (
    text,
    title,
    dueDate,
    priority,
    assignees,
    tags,
  ) => {
    let score = 0;
    let maxScore = 7;

    // Title extracted
    if (title && title.length > 3) score += 1;

    // Due date found
    if (dueDate) score += 1.5;

    // Priority detected
    if (priority !== "medium") score += 1;

    // Assignees found
    if (assignees.length > 0) score += 1;

    // Tags found
    if (tags.length > 0) score += 1;

    // Text length reasonable
    if (text.length > 10 && text.length < 200) score += 1;

    // Contains action words
    const actionWords =
      /create|update|review|call|meeting|prepare|finish|complete|send|write|design/i;
    if (actionWords.test(text)) score += 0.5;

    return Math.round((score / maxScore) * 100);
  };

  const handleCreateTask = async () => {
    if (!parsedTask) return;

    setIsCreating(true);
    try {
      const taskData = {
        title: parsedTask.title,
        description: parsedTask.description,
        dueDate: parsedTask.dueDate,
        dueTime: parsedTask.dueTime,
        priority: parsedTask.priority,
        tags: parsedTask.tags,
        category: parsedTask.category,
        estimatedDuration: parsedTask.estimatedDuration,
        assignees: parsedTask.assignees,
        recurrence: parsedTask.recurrence,
        createdBy: currentUser.id,
        status: "todo",
      };

      const response = await axios.post(
        `${import.meta.env.VITE_API_URL}/api/tasks/smart-create`,
        taskData,
      );

      if (response.status === 201) {
        onTaskCreated(response.data);
        setInputText("");
        setParsedTask(null);
        onClose();
        showSuccessToast("Task created");
      }
    } catch (error) {
      console.error("Error creating task:", error);
      showErrorToast("Unable to create task");
    } finally {
      setIsCreating(false);
    }
  };

  const useSuggestion = (suggestion) => {
    setInputText(suggestion);
  };

  const getPriorityColor = (priority) => {
    switch (priority) {
      case "urgent":
        return "text-red-600 bg-red-50";
      case "high":
        return "text-orange-600 bg-orange-50";
      case "medium":
        return "text-blue-600 bg-blue-50";
      case "low":
        return "text-green-600 bg-green-50";
      default:
        return "text-gray-600 bg-gray-50";
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 bg-gradient-to-r from-purple-50 to-blue-50">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-gradient-to-r from-purple-600 to-blue-600 rounded-sm">
                <Sparkles className="h-5 w-5 text-white" />
              </div>
              <div>
                <h2 className="text-xl font-semibold text-gray-900">
                  Smart Task Creator
                </h2>
                <p className="text-sm text-gray-600">
                  Describe your task naturally - AI will parse the details
                </p>
              </div>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 transition-colors"
            >
              <X className="h-6 w-6" />
            </Button>
          </div>
        </div>

        <div className="flex flex-col lg:flex-row max-h-[80vh]">
          {/* Input Section */}
          <div className="flex-1 p-4">
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Describe your task
                </label>
                <div className="relative">
                  <textarea
                    value={inputText}
                    onChange={(e) => setInputText(e.target.value)}
                    placeholder="e.g., Review quarterly reports by Friday @john #finance high priority"
                    className="w-full h-32 px-4 py-3 border border-gray-300 rounded-md resize-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                  />
                  {isProcessing && (
                    <div className="absolute top-2 right-2">
                      <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600"></div>
                    </div>
                  )}
                </div>
              </div>

              {/* Suggestions */}
              {!inputText && (
                <div>
                  <h4 className="text-sm font-medium text-gray-700 mb-3">
                    Try these examples:
                  </h4>
                  <div className="space-y-2">
                    {exampleSuggestions.slice(0, 3).map((suggestion, index) => (
                      <Button
                        key={index}
                        variant="ghost"
                        onClick={() => useSuggestion(suggestion)}
                        className="w-full text-left p-3 bg-gray-50 hover:bg-gray-100 rounded-md transition-colors text-sm h-auto justify-start"
                      >
                        <span className="text-gray-600">{suggestion}</span>
                      </Button>
                    ))}
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              {parsedTask && (
                <div className="flex gap-3">
                  <Button
                    variant="primary"
                    onClick={handleCreateTask}
                    disabled={isCreating || !parsedTask}
                    className="flex-1 h-9 inline-flex items-center justify-center px-4 py-2 text-sm font-medium"
                  >
                    <Send className="h-4 w-4 mr-2" />
                    {isCreating ? "Creating Task..." : "Create Task"}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setInputText("");
                      setParsedTask(null);
                    }}
                    className="h-9 px-4 py-2 text-sm font-medium"
                  >
                    Clear
                  </Button>
                </div>
              )}
            </div>
          </div>

          {/* Parsed Results */}
          {parsedTask && (
            <div className="lg:w-1/2 border-l border-gray-200 bg-gray-50 p-4">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold text-gray-900">
                    Parsed Details
                  </h3>
                  <div
                    className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                      parsedTask.confidence >= 80
                        ? "bg-green-100 text-green-800"
                        : parsedTask.confidence >= 60
                          ? "bg-yellow-100 text-yellow-800"
                          : "bg-red-100 text-red-800"
                    }`}
                  >
                    {parsedTask.confidence}% confidence
                  </div>
                </div>

                <div className="space-y-3">
                  {/* Title */}
                  <div className="bg-white p-3 rounded-sm border">
                    <div className="flex items-center gap-2 mb-1">
                      <Tag className="h-4 w-4 text-gray-500" />
                      <span className="text-xs font-medium text-gray-500 uppercase">
                        Title
                      </span>
                    </div>
                    <p className="text-sm font-medium text-gray-900">
                      {parsedTask.title}
                    </p>
                  </div>

                  {/* Due Date & Time */}
                  {(parsedTask.dueDate || parsedTask.dueTime) && (
                    <div className="bg-white p-3 rounded-sm border">
                      <div className="flex items-center gap-2 mb-1">
                        <Calendar className="h-4 w-4 text-gray-500" />
                        <span className="text-xs font-medium text-gray-500 uppercase">
                          Due Date
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-sm">
                        {parsedTask.dueDate && (
                          <span className="text-gray-900">
                            {format(
                              new Date(parsedTask.dueDate),
                              "MMM dd, yyyy",
                            )}
                          </span>
                        )}
                        {parsedTask.dueTime && (
                          <span className="text-gray-600">
                            at {parsedTask.dueTime}
                          </span>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Priority */}
                  <div className="bg-white p-3 rounded-sm border">
                    <div className="flex items-center gap-2 mb-1">
                      <AlertTriangle className="h-4 w-4 text-gray-500" />
                      <span className="text-xs font-medium text-gray-500 uppercase">
                        Priority
                      </span>
                    </div>
                    <span
                      className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium capitalize ${getPriorityColor(parsedTask.priority)}`}
                    >
                      {parsedTask.priority}
                    </span>
                  </div>

                  {/* Assignees */}
                  {parsedTask.assignees.length > 0 && (
                    <div className="bg-white p-3 rounded-sm border">
                      <div className="flex items-center gap-2 mb-1">
                        <User className="h-4 w-4 text-gray-500" />
                        <span className="text-xs font-medium text-gray-500 uppercase">
                          Assignees
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {parsedTask.assignees.map((assignee, index) => (
                          <span
                            key={index}
                            className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-blue-100 text-blue-800"
                          >
                            @{assignee}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Tags */}
                  {parsedTask.tags.length > 0 && (
                    <div className="bg-white p-3 rounded-sm border">
                      <div className="flex items-center gap-2 mb-1">
                        <Tag className="h-4 w-4 text-gray-500" />
                        <span className="text-xs font-medium text-gray-500 uppercase">
                          Tags
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {parsedTask.tags.map((tag, index) => (
                          <span
                            key={index}
                            className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-green-100 text-green-800"
                          >
                            #{tag}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Duration */}
                  {parsedTask.estimatedDuration && (
                    <div className="bg-white p-3 rounded-sm border">
                      <div className="flex items-center gap-2 mb-1">
                        <Clock className="h-4 w-4 text-gray-500" />
                        <span className="text-xs font-medium text-gray-500 uppercase">
                          Duration
                        </span>
                      </div>
                      <p className="text-sm text-gray-900">
                        {parsedTask.estimatedDuration >= 60
                          ? `${Math.floor(parsedTask.estimatedDuration / 60)}h ${parsedTask.estimatedDuration % 60}m`
                          : `${parsedTask.estimatedDuration}m`}
                      </p>
                    </div>
                  )}

                  {/* Recurrence */}
                  {parsedTask.recurrence && (
                    <div className="bg-white p-3 rounded-sm border">
                      <div className="flex items-center gap-2 mb-1">
                        <Clock className="h-4 w-4 text-gray-500" />
                        <span className="text-xs font-medium text-gray-500 uppercase">
                          Recurrence
                        </span>
                      </div>
                      <p className="text-sm text-gray-900 capitalize">
                        Every{" "}
                        {parsedTask.recurrence.interval > 1
                          ? parsedTask.recurrence.interval + " "
                          : ""}
                        {parsedTask.recurrence.type.replace("ly", "")}
                        {parsedTask.recurrence.interval > 1 &&
                        parsedTask.recurrence.type !== "daily"
                          ? "s"
                          : ""}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default SmartTaskParser;
