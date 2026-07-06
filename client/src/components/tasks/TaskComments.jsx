import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatDistanceToNow } from "date-fns";
import {
  MoreHorizontal,
  Edit,
  Trash2,
  AtSign,
  Reply,
  Send,
  Paperclip,
  X,
  File,
} from "lucide-react";
import CustomEditor from "../common/CustomEditor";
import axios from "axios";
import { useShowToast } from "../../utils/ToastMessage";

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || "http://localhost:5000";
// Configurable max file size (default 2MB)
const MAX_FILE_SIZE =
  import.meta.env.VITE_MAX_COMMENT_ATTACHMENT_SIZE || 2 * 1024 * 1024;
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { apiClient } from "../../utils/apiClient";

export function TaskComments({
  taskId,
  task,
  comments,
  onAddComment,
  onReplyToComment,
  onEditComment,
  onDeleteComment,
  currentUser,
  users = [],
  permissions = {},
}) {
  // Debug logging for permissions
  console.log("📋 [TASKCOMMENTS] Component Mounted with Permissions:", {
    permissionsExists: !!permissions,
    permissionsContent: permissions,
    canAdd: permissions?.canAdd,
    canView: permissions?.canView,
    canMention: permissions?.canMention,
    canAttachFiles: permissions?.canAttachFiles,
    canEdit: permissions?.canEdit,
    canModerate: permissions?.canModerate,
    currentUserId: currentUser?.id,
    taskId: taskId,
  });

  const [newComment, setNewComment] = useState("");
  const [editingId, setEditingId] = useState(null);
  const [editText, setEditText] = useState("");
  const [mentionSuggestions, setMentionSuggestions] = useState([]);
  const [showMentions, setShowMentions] = useState(false);
  const [showEditMentions, setShowEditMentions] = useState(false); // Separate state for edit mentions
  const [showReplyMentions, setShowReplyMentions] = useState(false); // Separate state for reply mentions
  const [replyingTo, setReplyingTo] = useState(null);
  const [replyText, setReplyText] = useState("");
  const [expandedComments, setExpandedComments] = useState({});
  const [mentionPosition, setMentionPosition] = useState({ top: 0, left: 0 });
  const [allCollaborators, setAllCollaborators] = useState([]);
  const [collaboratorsLoaded, setCollaboratorsLoaded] = useState(false);
  const [attachedFiles, setAttachedFiles] = useState([]);
  const [uploadingFiles, setUploadingFiles] = useState(false);
  const { showErrorToast } = useShowToast();

  // Ensure permissions object has all required properties
  const finalPermissions = {
    canAdd: permissions?.canAdd ?? false,
    canView: permissions?.canView ?? true,
    canMention: permissions?.canMention ?? false,
    canAttachFiles: permissions?.canAttachFiles ?? false,
    canEdit: permissions?.canEdit ?? false,
    canModerate: permissions?.canModerate ?? false,
    ...permissions, // Allow overrides
  };

  const taskStatus = task?.status?.toUpperCase?.();
  const approvalStatus = task?.approvalStatus?.toLowerCase?.();

  let disabledReason = null;
  if (taskStatus === "DONE") disabledReason = "completed";
  else if (taskStatus === "CANCELLED") disabledReason = "cancelled";
  else if (approvalStatus === "approved" || taskStatus === "APPROVED")
    disabledReason = "approved";
  else if (approvalStatus === "rejected" || taskStatus === "REJECTED")
    disabledReason = "rejected";

  const isCommentDisabled = !!disabledReason;

  console.log(
    "📋 [TASKCOMMENTS] Final Permissions After Fallback:",
    finalPermissions,
  );
  console.log("📋 [TASKCOMMENTS] Task Data:", {
    taskId: task?.id || task?._id,
    taskCollaborators: task?.collaborators,
    taskContributors: task?.contributors,
    taskCreatedBy: task?.createdBy,
    taskAssignedTo: task?.assignedTo,
    currentUserId: currentUser?.id,
    currentUserRole: currentUser?.role,
  });

  // Track mentions separately since ReactQuill strips custom attributes
  const [commentMentions, setCommentMentions] = useState([]);
  const [replyMentions, setReplyMentions] = useState([]);
  const [editMentions, setEditMentions] = useState([]); // Track mentions when editing

  // Fetch collaborators from API
  const fetchCollaborators = async () => {
    if (collaboratorsLoaded) return; // Only fetch once

    try {
      const response = await apiClient.get(`/api/auth/collaborators`);

      if (response.data.success) {
        setAllCollaborators(response.data.data || []);
        setCollaboratorsLoaded(true);
      }
    } catch (error) {
      console.error("Error fetching collaborators:", error);
      setAllCollaborators([]);
    }
  };

  const handleCommentSubmit = async () => {
    if (!newComment.trim()) return;

    console.log("� [MENTION DEBUG] Submitting comment:", {
      content: newComment,
      mentions: commentMentions,
      mentionCount: commentMentions.length,
      attachments: attachedFiles.length,
    });

    await onAddComment({
      content: newComment,
      mentions: commentMentions, // Use the tracked mentions array
      taskId,
      parentId: null,
      attachments: attachedFiles,
    });

    // Reset both comment, mentions, and attachments
    setNewComment("");
    setCommentMentions([]);
    setAttachedFiles([]);
  };

  const handleFileSelect = (event) => {
    const files = Array.from(event.target.files);

    // Check file size limits
    const validFiles = [];
    const oversizedFiles = [];

    files.forEach((file) => {
      if (file.size > MAX_FILE_SIZE) {
        oversizedFiles.push(file.name);
      } else {
        validFiles.push(file);
      }
    });

    if (oversizedFiles.length > 0) {
      const maxSizeMB = Math.round(MAX_FILE_SIZE / (1024 * 1024));
      showErrorToast(
        `File(s) too large (Max ${maxSizeMB}MB): ${oversizedFiles.join(", ")}`,
      );
    }

    if (validFiles.length > 0) {
      setAttachedFiles((prev) => [...prev, ...validFiles]);
    }

    // Clear the input value so the same file can be selected again
    event.target.value = null;
  };

  const removeAttachedFile = (index) => {
    setAttachedFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const formatFileSize = (bytes) => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + " " + sizes[i];
  };

  const handleReplySubmit = async (parentId) => {
    if (!replyText.trim()) return;

    console.log("� [FRONTEND REPLY] Step 1: Starting Reply Submission");
    console.log("📤 [FRONTEND REPLY] Step 2: Reply Data:", {
      parentId,
      content: replyText,
      contentLength: replyText.length,
      mentions: replyMentions,
      mentionCount: replyMentions.length,
      taskId,
    });

    try {
      console.log("📡 [FRONTEND REPLY] Step 3: Calling API...");
      // Use the new dedicated reply API
      await onReplyToComment(parentId, {
        content: replyText,
        mentions: replyMentions, // Use the tracked mentions array
      });
      console.log("✅ [FRONTEND REPLY] Step 4: API Call Successful");
    } catch (error) {
      console.error("❌ [FRONTEND REPLY] Step 4: API Call Failed:", {
        error: error.message,
        stack: error.stack,
      });
      throw error;
    }

    // Reset both reply and mentions
    console.log("🧹 [FRONTEND REPLY] Step 5: Cleaning Up State");
    setReplyText("");
    setReplyingTo(null);
    setReplyMentions([]);
    console.log("🎉 [FRONTEND REPLY] Step 6: Reply Submission Complete");
  };

  const toggleReplies = (commentId) => {
    setExpandedComments((prev) => ({
      ...prev,
      [commentId]: !prev[commentId],
    }));
  };

  const getReplies = (comment) => {
    // Use the nested replies from backend instead of filtering
    return comment.replies || [];
  };

  const getTopLevelComments = () => {
    // All comments from backend are already top-level with nested replies
    return Array.isArray(comments) ? comments : [];
  };

  const handleEdit = (comment) => {
    const commentId = comment._id || comment.id;
    setEditingId(commentId);
    // Use text or content field (replies may have text, comments may have content)
    const contentToEdit = comment.content || comment.text || "";
    console.log("🔧 [EDIT] Starting edit for comment:", {
      commentId,
      hasContent: !!comment.content,
      hasText: !!comment.text,
      contentToEdit,
    });
    setEditText(contentToEdit);

    // Initialize edit mentions with existing mentions from the comment
    const existingMentions = comment.mentions || [];
    console.log("🔧 [EDIT] Initializing edit mentions:", existingMentions);
    setEditMentions(existingMentions);
  };

  const handleSaveEdit = async () => {
    if (!editText.trim()) return;

    console.log("💾 [EDIT SAVE] Saving with mentions:", editMentions);
    // Check if this is a reply by looking at the comment structure
    const editingComment = comments.find((c) => (c._id || c.id) === editingId);
    const isReply =
      editingComment?.parentId ||
      editingComment?.replies?.some((r) => (r._id || r.id) === editingId);

    // If not found in main comments, search in replies
    let foundInReplies = false;
    for (const comment of comments) {
      if (comment.replies?.some((r) => (r._id || r.id) === editingId)) {
        foundInReplies = true;
        break;
      }
    }

    await onEditComment(
      editingId,
      {
        content: editText,
        mentions: editMentions,
      },
      foundInReplies,
    );
    setEditingId(null);
    setEditText("");
    setEditMentions([]);
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditText("");
    setEditMentions([]);
  };

  const handleMentionInput = (text, type = "comment") => {
    // Strip HTML tags to get plain text for @ detection
    const plainText = text.replace(/<[^>]*>/g, "");
    const lastAtIndex = plainText.lastIndexOf("@");

    // 🔧 SYNC MENTIONS: Extract actual mentions from HTML and sync with state
    syncMentionsWithContent(text, type);

    if (lastAtIndex !== -1) {
      const searchTerm = plainText.slice(lastAtIndex + 1);

      // Fetch collaborators when @ is typed
      if (!collaboratorsLoaded) {
        fetchCollaborators();
      }

      if (searchTerm.length >= 0) {
        const suggestions = allCollaborators
          .filter((user) => {
            const fullName =
              `${user.name || ""} ${user.email || ""}`.toLowerCase();
            return fullName.includes(searchTerm.toLowerCase());
          })
          .slice(0, 5);

        setMentionSuggestions(suggestions);

        // Show the appropriate dropdown based on type
        if (type === "edit") {
          setShowEditMentions(
            suggestions.length > 0 || searchTerm.length === 0,
          );
          setShowMentions(false);
          setShowReplyMentions(false);
        } else if (type === "reply") {
          setShowReplyMentions(
            suggestions.length > 0 || searchTerm.length === 0,
          );
          setShowMentions(false);
          setShowEditMentions(false);
        } else {
          setShowMentions(suggestions.length > 0 || searchTerm.length === 0);
          setShowEditMentions(false);
          setShowReplyMentions(false);
        }
      } else {
        setShowMentions(false);
        setShowEditMentions(false);
        setShowReplyMentions(false);
      }
    } else {
      setShowMentions(false);
      setShowEditMentions(false);
      setShowReplyMentions(false);
    }
  };

  // 🔧 NEW FUNCTION: Sync mentions array with actual content
  const syncMentionsWithContent = (htmlContent, type = "comment") => {
    // Extract all mentioned user names from HTML (looking for @mentions in spans)
    const mentionRegex = /@([^<\s&]+)/g;
    const plainText = htmlContent.replace(/<[^>]*>/g, " "); // Convert HTML to plain text
    const matches = [...plainText.matchAll(mentionRegex)];
    const mentionedNames = matches.map((m) => m[1].trim());

    console.log("🔄 [SYNC MENTIONS] Extracting mentions from content:", {
      htmlContent,
      plainText,
      mentionedNames,
      type,
    });

    const filterMentions = (prev) => {
      const synced = prev.filter((user) => {
        const userName =
          user.name || `${user.firstName || ""} ${user.lastName || ""}`.trim();
        const isStillMentioned = mentionedNames.some(
          (name) =>
            userName.toLowerCase().includes(name.toLowerCase()) ||
            name.toLowerCase().includes(userName.toLowerCase()),
        );
        if (!isStillMentioned) {
          console.log(
            `🗑️ [SYNC MENTIONS] Removing user from ${type} mentions:`,
            userName,
          );
        }
        return isStillMentioned;
      });
      return synced;
    };

    if (type === "reply") {
      setReplyMentions(filterMentions);
    } else if (type === "edit") {
      setEditMentions(filterMentions);
    } else {
      setCommentMentions(filterMentions);
    }
  };

  const insertMention = (user, type = "comment") => {
    const userName =
      user.name || `${user.firstName || ""} ${user.lastName || ""}`.trim();

    console.log("🏷️ [INSERT MENTION] Adding user to mentions array:", {
      userId: user.id,
      userName,
      fullUser: user,
      type,
    });

    if (type === "reply") {
      // For reply text
      const plainText = replyText.replace(/<[^>]*>/g, "");
      const lastAtIndex = plainText.lastIndexOf("@");
      const beforeMention = replyText.substring(0, replyText.lastIndexOf("@"));
      const mentionHtml = `<span style="color: #2563eb; font-weight: 500;">@${userName}</span>&nbsp;`;
      const newReplyText = beforeMention + mentionHtml;

      // Add user to reply mentions array
      setReplyMentions((prev) => {
        // Avoid duplicates
        if (prev.find((u) => u.id === user.id)) {
          console.log(
            "🏷️ [INSERT MENTION] User already in reply mentions, skipping",
          );
          return prev;
        }
        console.log("🏷️ [INSERT MENTION] Added to reply mentions array");
        return [...prev, user];
      });

      setReplyText(newReplyText);
    } else if (type === "edit") {
      // For edit text
      const plainText = editText.replace(/<[^>]*>/g, "");
      const lastAtIndex = plainText.lastIndexOf("@");
      const beforeMention = editText.substring(0, editText.lastIndexOf("@"));
      const mentionHtml = `<span style="color: #2563eb; font-weight: 500;">@${userName}</span>&nbsp;`;
      const newEditText = beforeMention + mentionHtml;

      // Add user to edit mentions array
      setEditMentions((prev) => {
        // Avoid duplicates
        if (prev.find((u) => u.id === user.id)) {
          console.log(
            "🏷️ [INSERT MENTION] User already in edit mentions, skipping",
          );
          return prev;
        }
        console.log("🏷️ [INSERT MENTION] Added to edit mentions array");
        return [...prev, user];
      });

      setEditText(newEditText);
    } else {
      // For new comment
      const plainText = newComment.replace(/<[^>]*>/g, "");
      const lastAtIndex = plainText.lastIndexOf("@");
      const beforeMention = newComment.substring(
        0,
        newComment.lastIndexOf("@"),
      );
      const mentionHtml = `<span style="color: #2563eb; font-weight: 500;">@${userName}</span>&nbsp;`;
      const newCommentText = beforeMention + mentionHtml;

      // Add user to comment mentions array
      setCommentMentions((prev) => {
        // Avoid duplicates
        if (prev.find((u) => u.id === user.id)) {
          console.log(
            "🏷️ [INSERT MENTION] User already in comment mentions, skipping",
          );
          return prev;
        }
        console.log("🏷️ [INSERT MENTION] Added to comment mentions array");
        return [...prev, user];
      });

      setNewComment(newCommentText);
    }

    // Close all mention dropdowns
    setShowMentions(false);
    setShowEditMentions(false);
    setShowReplyMentions(false);
    setMentionSuggestions([]);
  };

  const renderCommentContent = (content) => {
    // Check if content exists and is a string
    if (!content || typeof content !== "string") {
      return '<p class="text-gray-500 italic">Comment content is not available</p>';
    }
    // If content is empty string
    if (content.trim() === "") {
      return '<p class="text-gray-500 italic">Empty comment</p>';
    }
    // Enhance links: add target, rel, title, and ensure proper protocol
    let processed = content.replace(
      /<a\s+((?:[^>]*?)href="([^"]*)"[^>]*)>/gi,
      (match, attrs, href) => {
        // Ensure URL has proper protocol
        let fixedHref = href;
        if (fixedHref && !/^(https?:\/\/|mailto:|tel:|#)/i.test(fixedHref)) {
          fixedHref = "https://" + fixedHref;
        }
        // Remove existing target/rel/title/href to rebuild cleanly
        let cleanAttrs = attrs
          .replace(/\s*href="[^"]*"/gi, "")
          .replace(/\s*target="[^"]*"/gi, "")
          .replace(/\s*rel="[^"]*"/gi, "")
          .replace(/\s*title="[^"]*"/gi, "");
        return `<a ${cleanAttrs} href="${fixedHref}" target="_blank" rel="noopener noreferrer" title="${fixedHref}">`;
      },
    );
    // Highlight mentions in comments
    processed = processed.replace(
      /@(\w+)/g,
      '<span class="text-blue-600 font-medium">@$1</span>',
    );
    return processed;
  };

  return (
    <div className="space-y-3">
      <h3 className="text-lg font-semibold text-gray-900">
        Comments ({comments.length})
      </h3>

      {/* Show message if task is completed/cancelled/rejected/approved */}
      {isCommentDisabled && (
        <Card className="p-4 bg-gray-50">
          <div className="text-center text-sm text-gray-500">
            You can't comment because the task is {disabledReason}.
          </div>
        </Card>
      )}

      {/* Add new comment - only show if user has permission and task is active */}
      {!isCommentDisabled && finalPermissions.canAdd && (
        <Card className="p-4">
          <div className="space-y-3">
            <div className="relative">
              <CustomEditor
                value={newComment}
                onChange={(value) => {
                  setNewComment(value);
                  if (finalPermissions.canMention) {
                    handleMentionInput(value, "comment");
                  }
                }}
                placeholder={
                  finalPermissions.canMention
                    ? "Add a comment... Type @ to mention someone"
                    : "Add a comment..."
                }
                className="border rounded-md"
              />

              {showMentions &&
                finalPermissions.canMention &&
                mentionSuggestions.length > 0 && (
                  <div className="absolute top-full left-0 right-0 z-50 mt-1 bg-white border border-gray-200 rounded-md shadow-lg max-h-60 overflow-y-auto">
                    <div className="p-2 text-xs font-medium border-b">
                      Mention someone
                    </div>
                    {mentionSuggestions.map((user) => (
                      <div
                        key={user.id}
                        className="flex items-center gap-2 p-2 hover:bg-blue-50 cursor-pointer transition-colors"
                        onClick={() => insertMention(user, "comment")}
                      >
                        <Avatar className="h-8 w-8">
                          <AvatarImage src={user.avatar} />
                          <AvatarFallback className="text-xs bg-blue-100 text-blue-700">
                            {user.name?.[0]?.toUpperCase() ||
                              user.email?.[0]?.toUpperCase() ||
                              "?"}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <div
                            className="text-sm font-medium text-gray-900 truncate"
                            title={user.name || "Unknown User"}
                          >
                            {user.name || "Unknown User"}
                          </div>
                          <div
                            className="text-xs text-gray-500 truncate"
                            title={user.email}
                          >
                            {user.email}
                          </div>
                          {user.designation && (
                            <div className="text-xs text-gray-400">
                              {user.designation}
                            </div>
                          )}
                        </div>
                        {user.role && user.role.length > 0 && (
                          <Badge variant="outline" className="text-xs">
                            {user.role[0]}
                          </Badge>
                        )}
                      </div>
                    ))}
                  </div>
                )}
            </div>

            {/* Display attached files */}
            {attachedFiles.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {attachedFiles.map((file, index) => (
                  <div
                    key={index}
                    className="flex items-center gap-2 bg-gray-100 px-3 py-2 rounded-md"
                  >
                    <File className="h-4 w-4 text-gray-600" />
                    <span className="text-sm text-gray-700">{file.name}</span>
                    <span className="text-xs text-gray-500">
                      ({formatFileSize(file.size)})
                    </span>
                    <button
                      onClick={() => removeAttachedFile(index)}
                      className="text-red-500 hover:text-red-700 ml-1"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div className="flex justify-between items-center">
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2 text-sm text-gray-500">
                  {finalPermissions.canMention && (
                    <div className="flex items-center gap-1">
                      <AtSign className="h-4 w-4" />
                      <span>Type @ to mention users</span>
                    </div>
                  )}
                </div>
                {finalPermissions.canAttachFiles && (
                  <label className="cursor-pointer">
                    <input
                      type="file"
                      multiple
                      onChange={handleFileSelect}
                      className="hidden"
                      accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.txt,.csv"
                    />
                    <div className="flex items-center gap-1 text-sm text-blue-600 hover:text-blue-700">
                      <Paperclip className="h-4 w-4" />
                      <span>Attach files</span>
                    </div>
                  </label>
                )}
              </div>
              <Button
                onClick={handleCommentSubmit}
                disabled={!newComment.trim() || newComment === "<p><br></p>"}
              >
                Add Comment
              </Button>
            </div>
          </div>
        </Card>
      )}

      {/* Show message if user cannot add comments (for non-disabled tasks) */}
      {!isCommentDisabled && !finalPermissions.canAdd && (
        <Card className="p-4 bg-gray-50">
          <div className="text-center text-sm text-gray-500">
            {finalPermissions.canView
              ? "You don't have permission to add comments to this task."
              : "You don't have access to view or add comments on this task."}
          </div>
        </Card>
      )}

      {/* Comments list */}
      <div className="space-y-3">
        {getTopLevelComments().map((comment) => {
          const commentId = comment._id || comment.id;
          const replies = getReplies(comment);
          return (
            <div key={commentId} className="space-y-3">
              <Card className="p-4">
                <div className="flex items-start gap-3">
                  <Avatar className="h-8 w-8">
                    <AvatarImage src={comment.author?.avatar} />
                    <AvatarFallback>
                      {comment.author?.firstName?.[0]}
                      {comment.author?.lastName?.[0]}
                    </AvatarFallback>
                  </Avatar>

                  <div className="flex-1 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm text-gray-900 ">
                          {comment.author?.firstName && comment.author?.lastName
                            ? `${comment.author.firstName} ${comment.author.lastName}`
                            : comment.author?.name ||
                              comment.author?.email ||
                              "Unknown User"}
                        </span>
                        <span className="text-xs text-gray-900  ">
                          {comment.createdAt
                            ? formatDistanceToNow(new Date(comment.createdAt), {
                                addSuffix: true,
                              })
                            : "Unknown time"}
                        </span>
                        {comment.isEdited && (
                          <Badge variant="secondary" className="text-xs">
                            edited
                          </Badge>
                        )}
                      </div>

                      {/* Only show dropdown if user has at least one available action */}
                      {(finalPermissions.canAdd ||
                        ((comment.author?.id === currentUser?.id ||
                          comment.author?._id === currentUser?._id) &&
                          finalPermissions.canEdit) ||
                        finalPermissions.canModerate) && (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-6 w-6 p-0"
                            >
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            {finalPermissions.canAdd && !isCommentDisabled && (
                              <DropdownMenuItem
                                onClick={() => {
                                  setReplyingTo(commentId);
                                  setReplyMentions([]);
                                  setReplyText("");
                                }}
                              >
                                <Reply className="h-4 w-4 mr-2" />
                                Reply
                              </DropdownMenuItem>
                            )}
                            {(((comment.author?.id === currentUser?.id ||
                              comment.author?._id === currentUser?._id) &&
                              finalPermissions.canEdit) ||
                              finalPermissions.canModerate) && (
                              <>
                                <DropdownMenuItem
                                  onClick={() => handleEdit(comment)}
                                >
                                  <Edit className="h-4 w-4 mr-2" />
                                  Edit
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={() =>
                                    onDeleteComment(commentId, false)
                                  }
                                  className="text-red-600"
                                >
                                  <Trash2 className="h-4 w-4 mr-2" />
                                  {finalPermissions.canModerate &&
                                  comment.author?.id !== currentUser?.id &&
                                  comment.author?._id !== currentUser?._id
                                    ? "Moderate (Delete)"
                                    : "Delete"}
                                </DropdownMenuItem>
                              </>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      )}
                    </div>

                    {editingId === commentId ? (
                      <div className="space-y-2">
                        <div className="relative">
                          <CustomEditor
                            value={editText}
                            onChange={(value) => {
                              setEditText(value);
                              // Sync edit mentions when text changes
                              syncMentionsWithContent(value, "edit");
                              if (finalPermissions.canMention) {
                                handleMentionInput(value, "edit");
                              }
                            }}
                            placeholder={
                              finalPermissions.canMention
                                ? "Edit comment... Type @ to mention someone"
                                : "Edit comment..."
                            }
                            className="border rounded-md"
                          />

                          {showEditMentions &&
                            finalPermissions.canMention &&
                            mentionSuggestions.length > 0 && (
                              <div className="absolute top-50 left-0 right-0 z-50 mt-1 bg-white border border-gray-200 rounded-md shadow-lg max-h-60 overflow-y-auto">
                                <div className="p-2 text-xs text-gray-500 font-medium border-b">
                                  Mention someone
                                </div>
                                {mentionSuggestions.map((user) => (
                                  <div
                                    key={user.id}
                                    className="flex items-center gap-2 p-2 hover:bg-blue-50 cursor-pointer transition-colors"
                                    onClick={() => insertMention(user, "edit")}
                                  >
                                    <Avatar className="h-8 w-8">
                                      <AvatarImage src={user.avatar} />
                                      <AvatarFallback className="text-xs bg-blue-100 text-blue-700">
                                        {user.name?.[0]?.toUpperCase() || "?"}
                                      </AvatarFallback>
                                    </Avatar>
                                    <div className="flex-1 min-w-0">
                                      <div
                                        className="text-sm font-medium text-gray-900 truncate"
                                        title={user.name || "Unknown User"}
                                      >
                                        {user.name || "Unknown User"}
                                      </div>
                                      <div
                                        className="text-xs text-gray-500 truncate"
                                        title={user.email}
                                      >
                                        {user.email}
                                      </div>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}
                        </div>
                        <div className="flex gap-2">
                          <Button size="sm" onClick={handleSaveEdit}>
                            Save
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={handleCancelEdit}
                          >
                            Cancel
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div
                        className="text-sm text-gray-900 comment-content prose prose-sm max-w-none"
                        dangerouslySetInnerHTML={{
                          __html: renderCommentContent(
                            comment.content || comment.text,
                          ),
                        }}
                      />
                    )}

                    {comment.mentions && comment.mentions.length > 0 && (
                      <div className="flex items-center gap-1 flex-wrap">
                        <span className="text-xs text-gray-900  ">
                          Mentioned:
                        </span>
                        {comment.mentions.map((user, index) => (
                          <Badge
                            key={index}
                            variant="outline"
                            className="text-xs"
                          >
                            {user.firstName} {user.lastName}
                          </Badge>
                        ))}
                      </div>
                    )}

                    {/* Display attachments */}
                    {comment.attachments && comment.attachments.length > 0 && (
                      <div className="mt-2 space-y-1">
                        <div className="text-xs text-gray-500 font-medium">
                          Attachments:
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {comment.attachments.map((file, index) => (
                            <a
                              key={index}
                              href={file.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center gap-2 bg-gray-50 hover:bg-gray-100 px-3 py-2 rounded-md border border-gray-200 transition-colors"
                            >
                              <File className="h-4 w-4 text-blue-600" />
                              <span className="text-sm text-gray-700">
                                {file.name}
                              </span>
                              {file.size && (
                                <span className="text-xs text-gray-500">
                                  ({formatFileSize(file.size)})
                                </span>
                              )}
                            </a>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Reply form */}
                    {replyingTo === commentId && finalPermissions.canAdd && !isCommentDisabled && (
                      <div className="mt-3 pl-4 border-l-2 border-gray-200">
                        <div className="space-y-2">
                          <div className="relative">
                            <CustomEditor
                              value={replyText}
                              onChange={(value) => {
                                setReplyText(value);
                                // Sync reply mentions when text changes
                                syncMentionsWithContent(value, "reply");
                                if (finalPermissions.canMention) {
                                  handleMentionInput(value, "reply");
                                }
                              }}
                              placeholder={
                                finalPermissions.canMention
                                  ? "Write a reply... Type @ to mention someone"
                                  : "Write a reply..."
                              }
                              className="border rounded-md"
                            />

                            {showReplyMentions &&
                              finalPermissions.canMention &&
                              mentionSuggestions.length > 0 && (
                                <div className="absolute top-full left-0 right-0 z-50 mt-1 bg-white border border-gray-200 rounded-md shadow-lg max-h-60 overflow-y-auto">
                                  <div className="p-2 text-xs text-gray-500 font-medium border-b">
                                    Mention someone
                                  </div>
                                  {mentionSuggestions.map((user) => (
                                    <div
                                      key={user.id}
                                      className="flex items-center gap-2 p-2 hover:bg-blue-50 cursor-pointer transition-colors"
                                      onClick={() =>
                                        insertMention(user, "reply")
                                      }
                                    >
                                      <Avatar className="h-8 w-8">
                                        <AvatarImage src={user.avatar} />
                                        <AvatarFallback className="text-xs bg-blue-100 text-blue-700">
                                          {user.name?.[0]?.toUpperCase() || "?"}
                                        </AvatarFallback>
                                      </Avatar>
                                      <div className="flex-1 min-w-0">
                                        <div
                                          className="text-sm font-medium text-gray-900 truncate"
                                          title={user.name || "Unknown User"}
                                        >
                                          {user.name || "Unknown User"}
                                        </div>
                                        <div
                                          className="text-xs text-gray-500 truncate"
                                          title={user.email}
                                        >
                                          {user.email}
                                        </div>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              )}
                          </div>

                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              onClick={() => handleReplySubmit(commentId)}
                            >
                              <Send className="h-4 w-4 mr-1" />
                              Reply
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setReplyingTo(null)}
                            >
                              Cancel
                            </Button>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Show/Hide replies toggle */}
                    {replies.length > 0 && (
                      <div className="mt-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => toggleReplies(commentId)}
                          className="text-blue-600 hover:text-blue-700 p-0 h-auto font-normal"
                        >
                          {expandedComments[commentId] ? "Hide" : "View"}{" "}
                          {replies.length}{" "}
                          {replies.length === 1 ? "reply" : "replies"}
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              </Card>

              {/* Replies */}
              {expandedComments[commentId] && replies.length > 0 && (
                <div className="ml-12 space-y-2 border-l-2 border-blue-200 pl-4">
                  {replies.map((reply) => {
                    const replyId = reply._id || reply.id;
                    return (
                      <Card
                        key={replyId}
                        className="p-3 bg-blue-50 border-l-4 border-blue-300"
                      >
                        <div className="flex items-start gap-3">
                          <Avatar className="h-6 w-6">
                            <AvatarImage src={reply.author?.avatar} />
                            <AvatarFallback className="text-xs bg-blue-200">
                              {reply.author?.firstName?.[0]}
                              {reply.author?.lastName?.[0]}
                            </AvatarFallback>
                          </Avatar>

                          <div className="flex-1 space-y-1">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <Badge
                                  variant="outline"
                                  className="text-xs bg-blue-100 text-blue-700 border-blue-300"
                                >
                                  <Reply className="h-3 w-3 mr-1" />
                                  Reply
                                </Badge>
                                <span className="font-medium text-xs text-gray-900 ">
                                  {reply.author?.firstName &&
                                  reply.author?.lastName
                                    ? `${reply.author.firstName} ${reply.author.lastName}`
                                    : reply.author?.name ||
                                      reply.author?.email ||
                                      "Unknown User"}
                                </span>
                                <span className="text-xs text-gray-900">
                                  {reply.createdAt
                                    ? formatDistanceToNow(
                                        new Date(reply.createdAt),
                                        { addSuffix: true },
                                      )
                                    : "Unknown time"}
                                </span>
                                {reply.isEdited && (
                                  <Badge
                                    variant="secondary"
                                    className="text-xs"
                                  >
                                    edited
                                  </Badge>
                                )}
                              </div>

                              {/* Only show dropdown if user has at least one available action */}
                              {(((reply.author?.id === currentUser?.id ||
                                reply.author?._id === currentUser?._id) &&
                                permissions.canEdit) ||
                                permissions.canModerate) && (
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="h-5 w-5 p-0"
                                    >
                                      <MoreHorizontal className="h-3 w-3" />
                                    </Button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent align="end">
                                    <DropdownMenuItem
                                      onClick={() => handleEdit(reply)}
                                    >
                                      <Edit className="h-3 w-3 mr-2" />
                                      Edit
                                    </DropdownMenuItem>
                                    <DropdownMenuItem
                                      onClick={() =>
                                        onDeleteComment(replyId, true)
                                      }
                                      className="text-red-600"
                                    >
                                      <Trash2 className="h-3 w-3 mr-2" />
                                      {permissions.canModerate &&
                                      reply.author?.id !== currentUser?.id &&
                                      reply.author?._id !== currentUser?._id
                                        ? "Moderate"
                                        : "Delete"}
                                    </DropdownMenuItem>
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              )}
                            </div>

                            {/* Show edit form or static content for reply */}
                            {editingId === replyId ? (
                              <div className="space-y-2 mt-2">
                                <div className="relative">
                                  <CustomEditor
                                    value={editText}
                                    onChange={(value) => {
                                      setEditText(value);
                                      syncMentionsWithContent(value, "edit");
                                      if (permissions.canMention) {
                                        handleMentionInput(value, "edit");
                                      }
                                    }}
                                    placeholder={
                                      permissions.canMention
                                        ? "Edit reply... Type @ to mention someone"
                                        : "Edit reply..."
                                    }
                                    className="border rounded-md"
                                  />

                                  {showEditMentions &&
                                    permissions.canMention &&
                                    mentionSuggestions.length > 0 && (
                                      <div className="absolute top-full left-0 right-0 z-50 mt-1 bg-white border border-gray-200 rounded-md shadow-lg max-h-60 overflow-y-auto">
                                        <div className="p-2 text-xs text-gray-500 font-medium border-b">
                                          Mention someone
                                        </div>
                                        {mentionSuggestions.map((user) => (
                                          <div
                                            key={user.id}
                                            className="flex items-center gap-2 p-2 hover:bg-blue-50 cursor-pointer transition-colors"
                                            onClick={() =>
                                              insertMention(user, "edit")
                                            }
                                          >
                                            <Avatar className="h-6 w-6">
                                              <AvatarImage src={user.avatar} />
                                              <AvatarFallback className="text-xs bg-blue-100 text-blue-700">
                                                {user.name?.[0]?.toUpperCase() ||
                                                  "?"}
                                              </AvatarFallback>
                                            </Avatar>
                                            <div className="flex-1 min-w-0">
                                              <div className="text-xs font-medium text-gray-900 truncate">
                                                {user.name || "Unknown User"}
                                              </div>
                                              <div className="text-xs text-gray-500 truncate">
                                                {user.email}
                                              </div>
                                            </div>
                                          </div>
                                        ))}
                                      </div>
                                    )}
                                </div>
                                <div className="flex gap-2">
                                  <Button size="sm" onClick={handleSaveEdit}>
                                    Save
                                  </Button>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={handleCancelEdit}
                                  >
                                    Cancel
                                  </Button>
                                </div>
                              </div>
                            ) : (
                              <div
                                className="text-xs text-gray-700 comment-content prose prose-xs max-w-none"
                                dangerouslySetInnerHTML={{
                                  __html: renderCommentContent(
                                    reply.content || reply.text,
                                  ),
                                }}
                              />
                            )}

                            {reply.mentions && reply.mentions.length > 0 && (
                              <div className="flex items-center gap-1 flex-wrap">
                                <span className="text-xs text-gray-900">
                                  Mentioned:
                                </span>
                                {reply.mentions.map((user, index) => (
                                  <Badge
                                    key={index}
                                    variant="outline"
                                    className="text-xs"
                                  >
                                    {user.firstName} {user.lastName}
                                  </Badge>
                                ))}
                              </div>
                            )}

                            {/* Display attachments in replies */}
                            {reply.attachments &&
                              reply.attachments.length > 0 && (
                                <div className="mt-2 space-y-1">
                                  <div className="text-xs text-gray-500 font-medium">
                                    Attachments:
                                  </div>
                                  <div className="flex flex-wrap gap-2">
                                    {reply.attachments.map((file, index) => (
                                      <a
                                        key={index}
                                        href={file.url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="flex items-center gap-2 bg-gray-50 hover:bg-gray-100 px-2 py-1 rounded-md border border-gray-200 transition-colors"
                                      >
                                        <File className="h-3 w-3 text-blue-600" />
                                        <span className="text-xs text-gray-700">
                                          {file.name}
                                        </span>
                                        {file.size && (
                                          <span className="text-xs text-gray-500">
                                            ({formatFileSize(file.size)})
                                          </span>
                                        )}
                                      </a>
                                    ))}
                                  </div>
                                </div>
                              )}
                          </div>
                        </div>
                      </Card>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}

        {getTopLevelComments().length === 0 && (
          <div className="text-center py-8 text-gray-900">
            <p>No comments yet. Be the first to comment!</p>
          </div>
        )}
      </div>
    </div>
  );
}
