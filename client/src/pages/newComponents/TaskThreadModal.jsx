import React, { useState, useEffect, useRef } from "react";
import {
  X,
  Send,
  Paperclip,
  AtSign,
  Hash,
  MessageCircle,
  Edit3,
  Trash2,
  Heart,
  Reply,
  MoreHorizontal,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import axios from "axios";
import { useShowToast } from "@/utils/ToastMessage";

const TaskThreadModal = ({
  isOpen,
  onClose,
  taskId,
  taskTitle,
  currentUser,
  onTaskUpdate,
}) => {
  const [comments, setComments] = useState([]);
  const [newComment, setNewComment] = useState("");
  const [mentionSuggestions, setMentionSuggestions] = useState([]);
  const [showMentions, setShowMentions] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [editingComment, setEditingComment] = useState(null);
  const [replyingTo, setReplyingTo] = useState(null);
  const textareaRef = useRef(null);
  const mentionRef = useRef(null);
  const { showSuccessToast, showErrorToast } = useShowToast();

  // Fetch comments when modal opens
  useEffect(() => {
    if (isOpen && taskId) {
      fetchComments();
      fetchTeamMembers();
    }
  }, [isOpen, taskId]);

  const fetchComments = async () => {
    try {
      setIsLoading(true);
      const response = await axios.get(
        `${import.meta.env.VITE_API_URL}/api/tasks/${taskId}/comments`,
      );
      setComments(response.data || []);
    } catch (error) {
      console.error("Error fetching comments:", error);
      setComments([]);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchTeamMembers = async () => {
    try {
      const response = await axios.get(
        `${import.meta.env.VITE_API_URL}/api/users/team-members`,
      );
      setMentionSuggestions(response.data || []);
    } catch (error) {
      console.error("Error fetching team members:", error);
    }
  };

  // Smart text parsing for mentions, tags, and links
  const parseCommentText = (text) => {
    const mentionRegex = /@(\w+)/g;
    const tagRegex = /#(\w+)/g;

    let parsed = text
      .replace(mentionRegex, '<span class="mention">@$1</span>')
      .replace(tagRegex, '<span class="tag">#$1</span>');

    // Enhance links: add target, rel, title, and ensure proper protocol
    parsed = parsed.replace(
      /<a\s+((?:[^>]*?)href="([^"]*)"[^>]*)>/gi,
      (match, attrs, href) => {
        let fixedHref = href;
        if (fixedHref && !/^(https?:\/\/|mailto:|tel:|#)/i.test(fixedHref)) {
          fixedHref = "https://" + fixedHref;
        }
        let cleanAttrs = attrs
          .replace(/\s*href="[^"]*"/gi, "")
          .replace(/\s*target="[^"]*"/gi, "")
          .replace(/\s*rel="[^"]*"/gi, "")
          .replace(/\s*title="[^"]*"/gi, "");
        return `<a ${cleanAttrs} href="${fixedHref}" target="_blank" rel="noopener noreferrer" title="${fixedHref}">`;
      },
    );

    return parsed;
  };

  // Handle mention input
  const handleCommentChange = (e) => {
    const value = e.target.value;
    setNewComment(value);

    // Check for @ mentions
    const mentionMatch = value.match(/@(\w*)$/);
    if (mentionMatch) {
      setShowMentions(true);
      const query = mentionMatch[1].toLowerCase();
      const filtered = mentionSuggestions.filter(
        (user) =>
          user.name.toLowerCase().includes(query) ||
          user.email.toLowerCase().includes(query),
      );
      setMentionSuggestions(filtered);
    } else {
      setShowMentions(false);
    }
  };

  // Insert mention
  const insertMention = (user) => {
    const mentionMatch = newComment.match(/@(\w*)$/);
    if (mentionMatch) {
      const beforeMention = newComment.slice(0, mentionMatch.index);
      setNewComment(`${beforeMention}@${user.name} `);
    }
    setShowMentions(false);
    textareaRef.current?.focus();
  };

  // Submit new comment
  const handleSubmitComment = async (e) => {
    e.preventDefault();
    if (!newComment.trim()) return;

    try {
      setIsLoading(true);
      const commentData = {
        taskId,
        content: newComment,
        parentId: replyingTo?.id || null,
        mentions: extractMentions(newComment),
        tags: extractTags(newComment),
      };

      const response = await axios.post(
        `${import.meta.env.VITE_API_URL}/api/tasks/${taskId}/comments`,
        commentData,
      );

      if (response.status === 201) {
        await fetchComments(); // Refresh comments
        setNewComment("");
        setReplyingTo(null);
        showSuccessToast("Comment posted");

        // Send notifications for mentions
        await notifyMentionedUsers(commentData.mentions);
      }
    } catch (error) {
      console.error("Error posting comment:", error);
      showErrorToast("Unable to post comment");
    } finally {
      setIsLoading(false);
    }
  };

  // Extract mentions from text
  const extractMentions = (text) => {
    const mentionRegex = /@(\w+)/g;
    const mentions = [];
    let match;

    while ((match = mentionRegex.exec(text)) !== null) {
      const user = mentionSuggestions.find((u) => u.name === match[1]);
      if (user) mentions.push(user.id);
    }

    return mentions;
  };

  // Extract tags from text
  const extractTags = (text) => {
    const tagRegex = /#(\w+)/g;
    const tags = [];
    let match;

    while ((match = tagRegex.exec(text)) !== null) {
      tags.push(match[1]);
    }

    return tags;
  };

  // Notify mentioned users
  const notifyMentionedUsers = async (mentionedUserIds) => {
    try {
      await axios.post(
        `${import.meta.env.VITE_API_URL}/api/notifications/mentions`,
        {
          taskId,
          mentionedUserIds,
          message: `You were mentioned in a comment on task: ${taskTitle}`,
        },
      );
    } catch (error) {
      console.error("Error sending mention notifications:", error);
    }
  };

  // Delete comment
  const handleDeleteComment = async (commentId) => {
    if (!confirm("Are you sure you want to delete this comment?")) return;

    try {
      await axios.delete(
        `${import.meta.env.VITE_API_URL}/api/tasks/${taskId}/comments/${commentId}`,
      );
      await fetchComments();
      showSuccessToast("Comment deleted");
    } catch (error) {
      console.error("Error deleting comment:", error);
      showErrorToast("Unable to delete comment");
    }
  };

  // Edit comment
  const handleEditComment = async (commentId, newContent) => {
    try {
      await axios.put(
        `${import.meta.env.VITE_API_URL}/api/tasks/${taskId}/comments/${commentId}`,
        {
          content: newContent,
          mentions: extractMentions(newContent),
          tags: extractTags(newContent),
        },
      );
      await fetchComments();
      setEditingComment(null);
      showSuccessToast("Comment updated");
    } catch (error) {
      console.error("Error editing comment:", error);
      showErrorToast("Unable to edit comment");
    }
  };

  // Like comment
  const handleLikeComment = async (commentId) => {
    try {
      await axios.post(
        `${import.meta.env.VITE_API_URL}/api/tasks/${taskId}/comments/${commentId}/like`,
      );
      await fetchComments();
    } catch (error) {
      console.error("Error liking comment:", error);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-sm shadow-xl w-full max-w-4xl max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 bg-gradient-to-r from-blue-50 to-indigo-50">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
                <MessageCircle className="h-5 w-5 text-blue-600" />
                Task Thread
              </h2>
              <p
                className="text-sm text-gray-600 mt-1 truncate max-w-md"
                title={taskTitle}
              >
                {taskTitle}
              </p>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 transition-colors p-2"
            >
              <X className="h-6 w-6" />
            </button>
          </div>
        </div>

        {/* Comments Section */}
        <div className="flex-1 overflow-y-auto max-h-96 p-4">
          {isLoading ? (
            <div className="flex justify-center items-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
          ) : comments.length === 0 ? (
            <div className="text-center py-12">
              <MessageCircle className="h-12 w-12 text-gray-300 mx-auto mb-3" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                No comments yet
              </h3>
              <p className="text-gray-600">
                Start the conversation by adding the first comment.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {comments.map((comment) => (
                <div key={comment.id} className="flex space-x-3">
                  <div className="flex-shrink-0">
                    <img
                      src={
                        comment.author.avatar ||
                        `https://ui-avatars.com/api/?name=${comment.author.name}&background=random`
                      }
                      alt={comment.author.name}
                      className="h-8 w-8 rounded-full"
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="bg-gray-50 rounded-sm p-4">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center space-x-2">
                          <span className="font-medium text-gray-900">
                            {comment.author.name}
                          </span>
                          <span className="text-sm text-gray-500">
                            {formatDistanceToNow(new Date(comment.createdAt), {
                              addSuffix: true,
                            })}
                          </span>
                          {comment.edited && (
                            <span className="text-xs text-gray-400">
                              (edited)
                            </span>
                          )}
                        </div>

                        {comment.author.id === currentUser.id && (
                          <div className="flex items-center space-x-1">
                            <button
                              onClick={() => setEditingComment(comment)}
                              className="text-gray-400 hover:text-gray-600 p-1"
                            >
                              <Edit3 className="h-4 w-4" />
                            </button>
                            <button
                              onClick={() => handleDeleteComment(comment.id)}
                              className="text-gray-400 hover:text-red-600 p-1"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        )}
                      </div>

                      {editingComment?.id === comment.id ? (
                        <EditCommentForm
                          comment={comment}
                          onSave={handleEditComment}
                          onCancel={() => setEditingComment(null)}
                        />
                      ) : (
                        <div
                          className="text-gray-700 whitespace-pre-wrap comment-content"
                          dangerouslySetInnerHTML={{
                            __html: parseCommentText(comment.content),
                          }}
                        />
                      )}

                      <div className="flex items-center justify-between mt-3">
                        <div className="flex items-center space-x-3">
                          <button
                            onClick={() => handleLikeComment(comment.id)}
                            className={`flex items-center space-x-1 text-sm transition-colors ${
                              comment.likes?.includes(currentUser.id)
                                ? "text-red-600 hover:text-red-700"
                                : "text-gray-500 hover:text-gray-700"
                            }`}
                          >
                            <Heart
                              className={`h-4 w-4 ${comment.likes?.includes(currentUser.id) ? "fill-current" : ""}`}
                            />
                            <span>{comment.likes?.length || 0}</span>
                          </button>
                          <button
                            onClick={() => setReplyingTo(comment)}
                            className="text-sm text-gray-500 hover:text-gray-700 flex items-center space-x-1"
                          >
                            <Reply className="h-4 w-4" />
                            <span>Reply</span>
                          </button>
                        </div>

                        {comment.tags?.length > 0 && (
                          <div className="flex flex-wrap gap-1">
                            {comment.tags.map((tag) => (
                              <span
                                key={tag}
                                className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-blue-100 text-blue-800"
                              >
                                #{tag}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Replies */}
                    {comment.replies?.map((reply) => (
                      <div key={reply.id} className="ml-6 mt-4 flex space-x-3">
                        <div className="flex-shrink-0">
                          <img
                            src={
                              reply.author.avatar ||
                              `https://ui-avatars.com/api/?name=${reply.author.name}&background=random`
                            }
                            alt={reply.author.name}
                            className="h-6 w-6 rounded-full"
                          />
                        </div>
                        <div className="flex-1 bg-white rounded-sm p-3 border border-gray-200">
                          <div className="flex items-center space-x-2 mb-1">
                            <span className="font-medium text-sm text-gray-900">
                              {reply.author.name}
                            </span>
                            <span className="text-xs text-gray-500">
                              {formatDistanceToNow(new Date(reply.createdAt), {
                                addSuffix: true,
                              })}
                            </span>
                          </div>
                          <div
                            className="text-sm text-gray-700 whitespace-pre-wrap comment-content"
                            dangerouslySetInnerHTML={{
                              __html: parseCommentText(reply.content),
                            }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Comment Input */}
        <div className="px-6 py-4 border-t border-gray-200 bg-gray-50">
          {replyingTo && (
            <div className="mb-3 p-2 bg-blue-50 rounded-sm border border-blue-200">
              <div className="flex items-center justify-between">
                <span className="text-sm text-blue-800">
                  Replying to <strong>{replyingTo.author.name}</strong>
                </span>
                <button
                  onClick={() => setReplyingTo(null)}
                  className="text-blue-600 hover:text-blue-800"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}

          <form onSubmit={handleSubmitComment} className="relative">
            <div className="relative">
              <textarea
                ref={textareaRef}
                value={newComment}
                onChange={handleCommentChange}
                placeholder="Add a comment... Use @ to mention someone or # to add tags"
                className="w-full px-4 py-3 border border-gray-300 rounded-md resize-none focus:ring-2 focus:ring-blue-500 focus:border-transparent pr-20"
                rows="3"
              />

              {/* Mention Suggestions */}
              {showMentions && mentionSuggestions.length > 0 && (
                <div className="absolute bottom-full left-0 w-full bg-white border border-gray-200 rounded-sm shadow-lg z-10 max-h-40 overflow-y-auto">
                  {mentionSuggestions.slice(0, 5).map((user) => (
                    <button
                      key={user.id}
                      type="button"
                      onClick={() => insertMention(user)}
                      className="w-full px-4 py-2 text-left hover:bg-gray-50 flex items-center space-x-3"
                    >
                      <img
                        src={
                          user.avatar ||
                          `https://ui-avatars.com/api/?name=${user.name}&background=random`
                        }
                        alt={user.name}
                        className="h-6 w-6 rounded-full"
                      />
                      <div>
                        <div className="font-medium text-sm">{user.name}</div>
                        <div className="text-xs text-gray-500">
                          {user.email}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="flex items-center justify-between mt-3">
              <div className="flex items-center space-x-2">
                <button
                  type="button"
                  className="text-gray-400 hover:text-gray-600 p-2"
                  title="Attach file"
                >
                  <Paperclip className="h-5 w-5" />
                </button>
                <button
                  type="button"
                  className="text-gray-400 hover:text-gray-600 p-2"
                  title="Add mention"
                  onClick={() => {
                    setNewComment(newComment + "@");
                    textareaRef.current?.focus();
                  }}
                >
                  <AtSign className="h-5 w-5" />
                </button>
                <button
                  type="button"
                  className="text-gray-400 hover:text-gray-600 p-2"
                  title="Add tag"
                  onClick={() => {
                    setNewComment(newComment + "#");
                    textareaRef.current?.focus();
                  }}
                >
                  <Hash className="h-5 w-5" />
                </button>
              </div>

              <button
                type="submit"
                disabled={!newComment.trim() || isLoading}
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Send className="h-4 w-4 mr-2" />
                {isLoading ? "Posting..." : "Post Comment"}
              </button>
            </div>
          </form>
        </div>
      </div>

      <style jsx>{`
        .mention {
          background: #dbeafe;
          color: #1d4ed8;
          padding: 2px 4px;
          border-radius: 4px;
          font-weight: 500;
        }
        .tag {
          background: #dcfce7;
          color: #166534;
          padding: 2px 4px;
          border-radius: 4px;
          font-weight: 500;
        }
      `}</style>
    </div>
  );
};

// Edit Comment Form Component
const EditCommentForm = ({ comment, onSave, onCancel }) => {
  const [content, setContent] = useState(comment.content);

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave(comment.id, content);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        className="w-full px-3 py-2 border border-gray-300 rounded-md resize-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        rows="3"
      />
      <div className="flex space-x-2">
        <button
          type="submit"
          className="px-3 py-1 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700"
        >
          Save
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="px-3 py-1 text-sm border border-gray-300 rounded-md hover:bg-gray-50"
        >
          Cancel
        </button>
      </div>
    </form>
  );
};

export default TaskThreadModal;
