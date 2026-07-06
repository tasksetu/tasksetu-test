import React, { useState, useRef, useEffect } from "react";
import {
  ThumbsUp,
  Heart,
  Rocket,
  Flame,
  Smile,
  PartyPopper,
} from "lucide-react";
import { Button } from "@/components/ui/button";

export default function TaskComments({ taskId }) {
  const [comments, setComments] = useState([]);

  const [newComment, setNewComment] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showMentionSuggestions, setShowMentionSuggestions] = useState(false);
  const [mentionQuery, setMentionQuery] = useState("");
  const [mentionPosition, setMentionPosition] = useState({ start: 0, end: 0 });
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showEmojiModal, setShowEmojiModal] = useState(false);
  const [editingComment, setEditingComment] = useState(null);
  const [editContent, setEditContent] = useState("");
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [dragActive, setDragActive] = useState(false);
  const [cursorPosition, setCursorPosition] = useState(0);

  // Delete confirmation modal state
  const [deleteConfirmModal, setDeleteConfirmModal] = useState({
    isOpen: false,
    commentId: null,
    isDeleting: false,
  });

  const textareaRef = useRef(null);
  const fileInputRef = useRef(null);
  const emojiPickerRef = useRef(null);
  const emojiModalRef = useRef(null);

  const currentUser = {
    id: "current_user",
    name: "Current User",
    avatar: "CU",
  };

  // Team members for mentions - empty for production - fetch from API
  const teamMembers = [];

  const emojis = [
    "👍",
    "👎",
    "❤️",
    "😂",
    "😮",
    "😢",
    "😡",
    "🚀",
    "💯",
    "🎉",
    "🔥",
    "✅",
  ];

  const modalEmojis = [
    "😀",
    "😃",
    "😄",
    "😁",
    "😆",
    "😅",
    "😂",
    "🤣",
    "😊",
    "😇",
    "🙂",
    "🙃",
    "😉",
    "😌",
    "😍",
    "🥰",
    "😘",
    "😗",
    "😙",
    "😚",
    "😋",
    "😛",
    "😝",
    "😜",
    "🤪",
    "🤨",
    "🧐",
    "🤓",
    "😎",
    "🤩",
    "🥳",
    "😏",
    "😒",
    "😞",
    "😔",
    "😟",
    "😕",
    "🙁",
    "☹️",
    "😣",
    "😖",
    "😫",
    "😩",
    "🥺",
    "😢",
    "😭",
    "😤",
    "😠",
    "😡",
    "🤬",
    "🤯",
    "😳",
    "🥵",
    "🥶",
    "😱",
    "😨",
    "😰",
    "😥",
    "😓",
    "🤗",
    "🤔",
    "🤭",
    "🤫",
    "🤥",
    "😶",
    "😐",
    "😑",
    "😬",
    "🙄",
    "😯",
    "😦",
    "😧",
    "😮",
    "😲",
    "🥱",
    "😴",
    "🤤",
    "😪",
    "😵",
    "🤐",
    "🥴",
    "🤢",
    "🤮",
    "🤧",
    "😷",
    "🤒",
    "🤕",
    "🤑",
    "🤠",
    "😈",
    "👿",
    "👹",
    "👺",
    "🤡",
    "💩",
    "👻",
    "💀",
    "☠️",
    "👽",
    "👾",
    "🤖",
    "🎃",
    "😺",
    "😸",
    "😹",
    "😻",
    "😼",
    "😽",
    "🙀",
    "😿",
    "😾",
    "👋",
    "🤚",
    "🖐️",
    "✋",
    "🖖",
    "👌",
    "🤏",
    "✌️",
    "🤞",
    "🤟",
    "🤘",
    "🤙",
    "👈",
    "👉",
    "👆",
    "🖕",
    "👇",
    "☝️",
    "👍",
    "👎",
    "👊",
    "✊",
    "🤛",
    "🤜",
    "👏",
    "🙌",
    "👐",
    "🤲",
    "🤝",
    "🙏",
    "✍️",
    "💅",
    "🤳",
    "💪",
    "🦾",
    "🦿",
    "🦵",
    "🦶",
    "👂",
    "🦻",
    "👃",
    "🧠",
    "🦷",
    "🦴",
    "👀",
    "👁️",
    "👅",
    "👄",
    "💋",
    "🩸",
    "❤️",
    "🧡",
    "💛",
    "💚",
    "💙",
    "💜",
    "🤎",
    "🖤",
    "🤍",
    "💔",
    "❣️",
    "💕",
    "💞",
    "💓",
    "💗",
    "💖",
    "💘",
    "💝",
    "💟",
    "☮️",
    "✝️",
    "☪️",
    "🕉️",
    "☸️",
    "✡️",
    "🔯",
    "🕎",
    "☯️",
    "☦️",
    "🛐",
    "⛎",
    "♈",
    "♉",
    "♊",
    "♋",
    "♌",
    "♍",
    "♎",
    "♏",
    "♐",
    "♑",
    "♒",
    "♓",
    "🆔",
    "⚛️",
    "🉑",
    "☢️",
    "☣️",
    "📴",
    "📳",
    "🈶",
    "🈚",
    "🈸",
    "🈺",
    "🈷️",
    "✴️",
    "🆚",
    "💮",
    "🉐",
    "㊙️",
    "㊗️",
    "🈴",
    "🈵",
    "🈹",
    "🈲",
    "🅰️",
    "🅱️",
    "🆎",
    "🆑",
    "🅾️",
    "🆘",
    "❌",
    "⭕",
    "🛑",
    "⛔",
    "📛",
    "🚫",
    "💯",
    "💢",
    "♨️",
    "🚷",
    "🚯",
    "🚳",
    "🚱",
    "🔞",
    "📵",
    "🚭",
    "❗",
    "❕",
    "❓",
    "❔",
    "‼️",
    "⁉️",
    "🔅",
    "🔆",
    "〽️",
    "⚠️",
    "🚸",
    "🔱",
    "⚜️",
    "🔰",
    "♻️",
    "✅",
    "🈯",
    "💹",
    "❇️",
    "✳️",
    "❎",
    "🌐",
    "💠",
    "Ⓜ️",
    "🌀",
    "💤",
    "🏧",
    "🚾",
    "♿",
    "🅿️",
    "🈳",
    "🈂️",
    "🛂",
    "🛃",
    "🛄",
    "🛅",
    "🚹",
    "🚺",
    "🚼",
    "🚻",
    "🚮",
    "🎦",
    "📶",
    "🈁",
    "🔣",
    "ℹ️",
    "🔤",
    "🔡",
    "🔠",
    "🆖",
    "🆗",
    "🆙",
    "🆒",
    "🆕",
    "🆓",
    "0️⃣",
    "1️⃣",
    "2️⃣",
    "3️⃣",
    "4️⃣",
    "5️⃣",
    "6️⃣",
    "7️⃣",
    "8️⃣",
    "9️⃣",
    "🔟",
    "#️⃣",
    "*️⃣",
    "⏏️",
    "▶️",
    "⏸️",
    "⏯️",
    "⏹️",
    "⏺️",
    "⏭️",
    "⏮️",
    "⏩",
    "⏪",
    "⏫",
    "⏬",
    "◀️",
    "🔼",
    "🔽",
    "➡️",
    "⬅️",
    "⬆️",
    "⬇️",
    "↗️",
    "↘️",
    "↙️",
    "↖️",
    "↕️",
    "↔️",
    "↪️",
    "↩️",
    "⤴️",
    "⤵️",
    "🔀",
    "<RecurringTaskIcon size={size} className='flex-shrink-0' />",
    "🔂",
    "🔄",
    "🔃",
    "🎵",
    "🎶",
    "➕",
    "➖",
    "➗",
    "✖️",
    "🟰",
    "♾️",
    "💲",
    "💱",
    "™️",
    "©️",
    "®️",
    "👑",
    "🎩",
    "🎓",
    "📿",
    "💄",
    "💍",
    "💎",
  ];

  useEffect(() => {
    function handleClickOutside(event) {
      if (
        emojiPickerRef.current &&
        !emojiPickerRef.current.contains(event.target)
      ) {
        setShowEmojiPicker(false);
      }
      if (
        emojiModalRef.current &&
        !emojiModalRef.current.contains(event.target)
      ) {
        setShowEmojiModal(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleCommentChange = (e) => {
    const value = e.target.value;
    const cursorPos = e.target.selectionStart;

    setNewComment(value);
    setCursorPosition(cursorPos);

    // Handle @ mentions
    const atIndex = value.lastIndexOf("@", cursorPos - 1);
    if (atIndex !== -1) {
      const afterAt = value.substring(atIndex + 1, cursorPos);
      if (!afterAt.includes(" ") && afterAt.length >= 0) {
        setMentionQuery(afterAt);
        setMentionPosition({ start: atIndex, end: cursorPos });
        setShowMentionSuggestions(true);
      } else {
        setShowMentionSuggestions(false);
      }
    } else {
      setShowMentionSuggestions(false);
    }
  };

  const handleTextareaClick = (e) => {
    setCursorPosition(e.target.selectionStart);
  };

  const handleTextareaKeyUp = (e) => {
    setCursorPosition(e.target.selectionStart);
  };

  const insertEmojiAtCursor = (emoji) => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const before = newComment.substring(0, cursorPosition);
    const after = newComment.substring(cursorPosition);
    const newValue = before + emoji + after;

    setNewComment(newValue);
    setShowEmojiModal(false);

    // Set cursor position after emoji
    setTimeout(() => {
      textarea.focus();
      const newCursorPos = cursorPosition + emoji.length;
      textarea.setSelectionRange(newCursorPos, newCursorPos);
      setCursorPosition(newCursorPos);
    }, 0);
  };

  const handleMentionSelect = (member) => {
    const beforeMention = newComment.substring(0, mentionPosition.start);
    const afterMention = newComment.substring(mentionPosition.end);
    const newValue = beforeMention + `@${member.name} ` + afterMention;

    setNewComment(newValue);
    setShowMentionSuggestions(false);
    setMentionQuery("");
  };

  const filteredMembers = teamMembers.filter((member) =>
    member.name.toLowerCase().includes(mentionQuery.toLowerCase()),
  );

  const handleFormatting = (format) => {
    const textarea = textareaRef.current;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selectedText = newComment.substring(start, end);

    let formattedText = "";
    let newCursorPos = start;

    switch (format) {
      case "bold":
        formattedText = `**${selectedText}**`;
        newCursorPos = start + 2;
        break;
      case "italic":
        formattedText = `*${selectedText}*`;
        newCursorPos = start + 1;
        break;
      case "code":
        formattedText = `\`${selectedText}\``;
        newCursorPos = start + 1;
        break;
      case "codeblock":
        formattedText = `\n\`\`\`\n${selectedText}\n\`\`\`\n`;
        newCursorPos = start + 4;
        break;
      case "bullet":
        formattedText = `\n• ${selectedText}`;
        newCursorPos = start + 3;
        break;
    }

    const newValue =
      newComment.substring(0, start) +
      formattedText +
      newComment.substring(end);
    setNewComment(newValue);

    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(
        newCursorPos,
        newCursorPos + selectedText.length,
      );
    }, 0);
  };

  const handleFileUpload = (files) => {
    const fileArray = Array.from(files).map((file) => ({
      id: Date.now() + Math.random(),
      file: file,
      name: file.name,
      size: formatFileSize(file.size),
      type: file.type,
    }));
    setSelectedFiles([...selectedFiles, ...fileArray]);
  };

  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileUpload(e.dataTransfer.files);
    }
  };

  const removeFile = (fileId) => {
    setSelectedFiles(selectedFiles.filter((f) => f.id !== fileId));
  };

  const formatFileSize = (bytes) => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!newComment.trim() || isSubmitting) return;

    setIsSubmitting(true);

    // Extract mentions from comment
    const mentionRegex = /@(\w+(?:\s+\w+)*)/g;
    const mentions = [];
    let match;
    while ((match = mentionRegex.exec(newComment)) !== null) {
      mentions.push(match[1]);
    }

    const comment = {
      id: Date.now(),
      author: currentUser.name,
      authorId: currentUser.id,
      content: newComment.trim(),
      timestamp: new Date().toISOString(),
      avatar: currentUser.avatar,
      mentions,
      attachments: selectedFiles.map((f) => ({
        name: f.name,
        size: f.size,
        type: f.type,
      })),
      reactions: {},
      isEdited: false,
    };

    try {
      // Simulate API call
      await new Promise((resolve) => setTimeout(resolve, 500));

      setComments([...comments, comment]);
      setNewComment("");
      setSelectedFiles([]);

      // Log mention notifications
      if (mentions.length > 0) {
        console.log("Mention notifications sent to:", mentions);
      }
    } catch (error) {
      console.error("Error posting comment:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEditComment = (commentId) => {
    const comment = comments.find((c) => c.id === commentId);
    setEditingComment(commentId);
    setEditContent(comment.content);
  };

  const handleSaveEdit = async (commentId) => {
    if (!editContent.trim()) return;

    try {
      setComments(
        comments.map((comment) =>
          comment.id === commentId
            ? { ...comment, content: editContent.trim(), isEdited: true }
            : comment,
        ),
      );
      setEditingComment(null);
      setEditContent("");
    } catch (error) {
      console.error("Error editing comment:", error);
    }
  };

  const handleDeleteComment = async (commentId) => {
    // Show confirmation modal instead of using window.confirm
    setDeleteConfirmModal({
      isOpen: true,
      commentId,
      isDeleting: false,
    });
  };

  const executeDeleteComment = async () => {
    const { commentId } = deleteConfirmModal;

    setDeleteConfirmModal((prev) => ({ ...prev, isDeleting: true }));

    try {
      setComments(
        comments.map((comment) =>
          comment.id === commentId
            ? {
                ...comment,
                content: "This comment was deleted.",
                isDeleted: true,
              }
            : comment,
        ),
      );
    } catch (error) {
      console.error("Error deleting comment:", error);
    } finally {
      setDeleteConfirmModal({
        isOpen: false,
        commentId: null,
        isDeleting: false,
      });
    }
  };

  const handleReaction = (commentId, emoji) => {
    setComments(
      comments.map((comment) => {
        if (comment.id === commentId) {
          const reactions = { ...comment.reactions };
          if (reactions[emoji]) {
            reactions[emoji] += 1;
          } else {
            reactions[emoji] = 1;
          }
          return { ...comment, reactions };
        }
        return comment;
      }),
    );
  };

  const formatTimestamp = (timestamp) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffInHours = Math.floor((now - date) / (1000 * 60 * 60));

    if (diffInHours < 1) {
      const diffInMinutes = Math.floor((now - date) / (1000 * 60));
      return `${diffInMinutes} minutes ago`;
    } else if (diffInHours < 24) {
      return `${diffInHours} hours ago`;
    } else {
      const diffInDays = Math.floor(diffInHours / 24);
      return `${diffInDays} days ago`;
    }
  };

  const formatContent = (content) => {
    if (!content) return "";

    // Handle deleted comments
    if (content === "This comment was deleted.") {
      return `<span class="deleted-comment">${content}</span>`;
    }

    let formatted = content
      // Bold text **text**
      .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
      // Italic text *text*
      .replace(/\*(.*?)\*/g, "<em>$1</em>")
      // Inline code `code`
      .replace(/`([^`]+)`/g, '<code class="inline-code">$1</code>')
      // Code blocks ```code```
      .replace(
        /```([\s\S]*?)```/g,
        '<pre class="code-block"><code>$1</code></pre>',
      )
      // Mentions @user
      .replace(/@(\w+(?:\s+\w+)*)/g, '<span class="mention">@$1</span>')
      // Line breaks
      .replace(/\n/g, "<br>")
      // Bullets •
      .replace(/^• /gm, '<span class="bullet">• </span>');

    // Enhance links: add target, rel, title, and ensure proper protocol
    formatted = formatted.replace(
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

    return formatted;
  };

  const getExactTimestamp = (timestamp) => {
    return new Date(timestamp).toLocaleString();
  };

  return (
    <div className="task-comments">
      <div className="comments-header">
        <h3>Comments ({comments.length})</h3>
      </div>

      <div className="comments-list">
        {comments.map((comment) => (
          <div
            key={comment.id}
            className={`comment-item ${comment.isDeleted ? "deleted" : ""}`}
          >
            <div className="comment-avatar">{comment.avatar}</div>
            <div className="comment-content">
              <div className="comment-header">
                <span className="comment-author">{comment.author}</span>
                <span
                  className="comment-timestamp"
                  title={getExactTimestamp(comment.timestamp)}
                >
                  {formatTimestamp(comment.timestamp)}
                  {comment.isEdited && (
                    <span className="edited-indicator"> (edited)</span>
                  )}
                </span>
                {comment.authorId === currentUser.id && !comment.isDeleted && (
                  <div className="comment-actions">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="action-btn edit-btn h-9"
                      onClick={() => handleEditComment(comment.id)}
                      title="Edit comment"
                    >
                      ✏️
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="action-btn delete-btn h-9"
                      onClick={() => handleDeleteComment(comment.id)}
                      title="Delete comment"
                    >
                      🗑️
                    </Button>
                  </div>
                )}
              </div>

              {editingComment === comment.id ? (
                <div className="edit-comment-form">
                  <textarea
                    value={editContent}
                    onChange={(e) => setEditContent(e.target.value)}
                    className="edit-textarea"
                    rows="3"
                  />
                  <div className="edit-actions">
                    <Button
                      variant="outline"
                      className="btn-secondary btn-sm h-9"
                      onClick={() => setEditingComment(null)}
                    >
                      Cancel
                    </Button>
                    <Button
                      variant="primary"
                      className="btn-primary btn-sm h-9"
                      onClick={() => handleSaveEdit(comment.id)}
                    >
                      Save
                    </Button>
                  </div>
                </div>
              ) : (
                <div
                  className="comment-text comment-content"
                  dangerouslySetInnerHTML={{
                    __html: formatContent(comment.content),
                  }}
                />
              )}

              {comment.attachments.length > 0 && (
                <div className="comment-attachments">
                  {comment.attachments.map((attachment, index) => (
                    <div key={index} className="attachment-item">
                      <span className="attachment-icon">📎</span>
                      <span className="attachment-name">{attachment.name}</span>
                      <span className="attachment-size">
                        ({attachment.size})
                      </span>
                    </div>
                  ))}
                </div>
              )}

              {Object.keys(comment.reactions).length > 0 && (
                <div className="comment-reactions">
                  {Object.entries(comment.reactions).map(([emoji, count]) => (
                    <Button
                      key={emoji}
                      variant="ghost"
                      className="reaction-btn h-9"
                      onClick={() => handleReaction(comment.id, emoji)}
                    >
                      {emoji} {count}
                    </Button>
                  ))}
                </div>
              )}

              {!comment.isDeleted && (
                <div className="reaction-picker">
                  {emojis.slice(0, 6).map((emoji) => (
                    <Button
                      key={emoji}
                      variant="ghost"
                      size="icon"
                      className="emoji-btn h-9"
                      onClick={() => handleReaction(comment.id, emoji)}
                      title={`React with ${emoji}`}
                    >
                      {emoji}
                    </Button>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      <form onSubmit={handleSubmit} className="comment-form">
        <div className="comment-input-container">
          <div className="comment-avatar">{currentUser.avatar}</div>
          <div className="comment-input-wrapper">
            <div className="formatting-toolbar">
              <Button
                variant="ghost"
                size="icon"
                type="button"
                onClick={() => handleFormatting("bold")}
                title="Bold"
                className="h-9"
              >
                <strong>B</strong>
              </Button>
              <Button
                variant="ghost"
                size="icon"
                type="button"
                onClick={() => handleFormatting("italic")}
                title="Italic"
                className="h-9"
              >
                <em>I</em>
              </Button>
              <Button
                variant="ghost"
                size="icon"
                type="button"
                onClick={() => handleFormatting("code")}
                title="Inline Code"
                className="h-9"
              >
                {"</>"}
              </Button>
              <Button
                variant="ghost"
                size="icon"
                type="button"
                onClick={() => handleFormatting("codeblock")}
                title="Code Block"
                className="h-9"
              >
                📝
              </Button>
              <Button
                variant="ghost"
                size="icon"
                type="button"
                onClick={() => handleFormatting("bullet")}
                title="Bullet Point"
                className="h-9"
              >
                •
              </Button>
              <div className="flex items-center gap-2 mb-2">
                <Button
                  variant="ghost"
                  size="icon"
                  type="button"
                  onClick={() => setShowEmojiModal(true)}
                  title="Add emoji"
                  className="emoji-trigger-btn flex items-center justify-center w-8 h-8 rounded-sm bg-gray-100 hover:bg-gray-200 transition-colors cursor-pointer text-lg"
                >
                  😀
                </Button>
              </div>
              <div className="toolbar-separator"></div>
            </div>

            <div
              className={`textarea-container flex items-center gap-3 justify-between w-full ${dragActive ? "drag-active" : ""}`}
              onDragEnter={handleDrag}
              onDragLeave={handleDrag}
              onDragOver={handleDrag}
              onDrop={handleDrop}
            >
              <textarea
                ref={textareaRef}
                value={newComment}
                onChange={handleCommentChange}
                onClick={handleTextareaClick}
                onKeyUp={handleTextareaKeyUp}
                placeholder="Leave a comment..."
                className="comment-input w-full indent-4 pt-4 !border border-gray-300 rounded-md p-2 focus:outline-none focus:border-gray-300"
                rows="3"
                disabled={isSubmitting}
              />
              {dragActive && (
                <div className="drag-overlay">Drop files here to attach</div>
              )}
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width={20}
                height={20}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                color="green"
                style={{ cursor: "pointer" }}
                strokeLinecap="round"
                strokeLinejoin="round"
                className="feather feather-send"
              >
                <line x1="22" y1="2" x2="11" y2="13"></line>
                <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
              </svg>

              <Button
                variant="ghost"
                size="icon"
                type="button"
                onClick={() => fileInputRef.current?.click()}
                title="Add attachment"
                className="attachment-btn w-12 h-12 rounded-full bg-gray-200 flex items-center justify-center cursor-pointer"
              >
                📎
              </Button>
            </div>

            {selectedFiles.length > 0 && (
              <div className="selected-files">
                <div className="files-header">
                  <span className="files-count">
                    {selectedFiles.length} file
                    {selectedFiles.length > 1 ? "s" : ""} attached
                  </span>
                </div>
                <div className="files-grid relative">
                  {selectedFiles.map((file) => (
                    <div key={file.id} className="selected-file-card">
                      <div className="file-preview">
                        {file.type.startsWith("image/") ? (
                          <div className="image-preview">
                            <img
                              src={URL.createObjectURL(file.file)}
                              alt={file.name}
                              className="preview-image"
                            />
                          </div>
                        ) : (
                          <div className="file-icon">
                            {file.type.includes("pdf")
                              ? "📄"
                              : file.type.includes("word")
                                ? "📝"
                                : file.type.includes("excel")
                                  ? "📊"
                                  : file.type.includes("powerpoint")
                                    ? "📽️"
                                    : "📎"}
                          </div>
                        )}
                      </div>
                      <div className="file-info">
                        <span className="file-name" title={file.name}>
                          {file.name.length > 20
                            ? `${file.name.substring(0, 20)}...`
                            : file.name}
                        </span>
                        <span className="file-size">({file.size})</span>
                      </div>
                      <Button
                        variant="destructive"
                        size="icon"
                        type="button"
                        className="remove-file-btn absolute top-[18px] right-3 w-8 h-8 text-[18px] rounded-full bg-red-500 flex items-center text-white justify-center cursor-pointer"
                        onClick={() => removeFile(file.id)}
                        title="Remove file"
                      >
                        ×
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {showMentionSuggestions && filteredMembers.length > 0 && (
              <div className="mention-suggestions">
                {filteredMembers.map((member) => (
                  <div
                    key={member.id}
                    className="mention-suggestion"
                    onClick={() => handleMentionSelect(member)}
                  >
                    <span className="mention-avatar">{member.avatar}</span>
                    <div className="mention-info">
                      <span className="mention-name">{member.name}</span>
                      <span className="mention-email">{member.email}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="comment-actions">
          <div className="comment-tools">
            <input
              type="file"
              ref={fileInputRef}
              multiple
              style={{ display: "none" }}
              onChange={(e) => handleFileUpload(e.target.files)}
              accept="image/*,.pdf,.doc,.docx,.txt,.xlsx,.ppt,.pptx"
            />
            <div className="emoji-picker-container" ref={emojiPickerRef}>
              <Button
                variant="ghost"
                size="icon"
                type="button"
                className="tool-button h-9"
                onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                title="Add emoji"
              >
                😀
              </Button>
              {showEmojiPicker && (
                <div className="emoji-picker">
                  {emojis.map((emoji) => (
                    <Button
                      key={emoji}
                      variant="ghost"
                      size="icon"
                      type="button"
                      className="emoji-option h-9"
                      onClick={() => {
                        setNewComment(newComment + emoji);
                        setShowEmojiPicker(false);
                      }}
                    >
                      {emoji}
                    </Button>
                  ))}
                </div>
              )}
            </div>
          </div>
          <Button
            variant="primary"
            type="submit"
            className="btn-primary h-9"
            disabled={!newComment.trim() || isSubmitting}
          >
            {isSubmitting ? "Posting..." : "Post Comment"}
          </Button>
        </div>
      </form>

      {comments.length === 0 && (
        <div className="empty-comments">
          <p>No comments yet. Be the first to comment!</p>
        </div>
      )}

      {/* Emoji Modal */}
      {showEmojiModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div
            ref={emojiModalRef}
            className="bg-white rounded-2xl shadow-xl max-w-md w-full max-h-[70vh] overflow-y-auto"
          >
            <div className="p-4 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-gray-900">
                  Choose an Emoji
                </h3>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setShowEmojiModal(false)}
                  className="text-gray-400 hover:text-gray-600 transition-colors h-9"
                >
                  <svg
                    className="w-6 h-6"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                </Button>
              </div>
            </div>
            <div className="p-4">
              <div className="grid grid-cols-8 gap-2">
                {modalEmojis.map((emoji, index) => (
                  <Button
                    key={index}
                    variant="ghost"
                    onClick={() => insertEmojiAtCursor(emoji)}
                    className="w-10 h-10 flex items-center justify-center text-xl hover:bg-gray-100 rounded-sm transition-colors cursor-pointer"
                    title={emoji}
                  >
                    {emoji}
                  </Button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirmModal.isOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-[2000] flex items-center justify-center"
          onClick={(e) => {
            // Close on backdrop click only if not deleting
            if (!deleteConfirmModal.isDeleting) {
              setDeleteConfirmModal({
                isOpen: false,
                commentId: null,
                isDeleting: false,
              });
            }
          }}
        >
          <div
            className="bg-white rounded-sm shadow-xl p-4 w-96 max-w-[90vw]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3 mb-4">
              <div className="flex-shrink-0 w-10 h-10 bg-red-100 rounded-full flex items-center justify-center">
                <svg
                  className="w-5 h-5 text-red-600"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                  />
                </svg>
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900">
                  Delete Comment
                </h3>
                <p className="text-sm text-gray-500">
                  This action cannot be undone
                </p>
              </div>
            </div>

            <p className="text-sm text-gray-700 mb-6">
              Are you sure you want to delete this comment? This will
              permanently remove it.
            </p>

            <div className="flex gap-3 justify-end">
              <Button
                variant="outline"
                className="px-4"
                onClick={() =>
                  setDeleteConfirmModal({
                    isOpen: false,
                    commentId: null,
                    isDeleting: false,
                  })
                }
                disabled={deleteConfirmModal.isDeleting}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                className="px-4"
                onClick={executeDeleteComment}
                disabled={deleteConfirmModal.isDeleting}
              >
                {deleteConfirmModal.isDeleting ? (
                  <span className="flex items-center gap-2">
                    <svg
                      className="animate-spin w-4 h-4"
                      fill="none"
                      viewBox="0 0 24 24"
                    >
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                      />
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                      />
                    </svg>
                    Deleting...
                  </span>
                ) : (
                  "Delete Comment"
                )}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
