import React, { useState, useRef, useEffect } from 'react';
import {
  Bold,
  Italic,
  Underline,
  List,
  ListOrdered,
  Link,
  Type
} from 'lucide-react';
import { Button } from '@/components/ui/button';

const RichTextEditor = ({
  value = '',
  onChange,
  placeholder = 'Describe your milestone...',
  className = '',
  minHeight = '120px'
}) => {
  const [isFocused, setIsFocused] = useState(false);
  const editorRef = useRef(null);

  const handleFormat = (command, value = null) => {
    document.execCommand(command, false, value);
  };

  const handleContentChange = (e) => {
    const content = e.target.innerHTML;
    onChange(content);
  };

  // Update editor content when value prop changes
  useEffect(() => {
    if (editorRef.current && editorRef.current.innerHTML !== value) {
      editorRef.current.innerHTML = value;
    }
  }, [value]);

  // Add CSS for placeholder styling and LTR direction
  useEffect(() => {
    const style = document.createElement('style');
    style.id = 'rich-text-editor-styles';
    style.textContent = `
      [contenteditable][data-placeholder]:empty:before {
        content: attr(data-placeholder);
        color: #9CA3AF;
        pointer-events: none;
        position: absolute;
      }
      [contenteditable] {
        direction: ltr !important;
        text-align: left !important;
        unicode-bidi: embed !important;
      }
      [contenteditable] * {
        direction: ltr !important;
        text-align: left !important;
      }
    `;

    // Remove existing style if present
    const existingStyle = document.getElementById('rich-text-editor-styles');
    if (existingStyle) {
      existingStyle.remove();
    }

    document.head.appendChild(style);
    return () => {
      const styleToRemove = document.getElementById('rich-text-editor-styles');
      if (styleToRemove) {
        styleToRemove.remove();
      }
    };
  }, []);

  return (
    <div className={`border border-gray-300 rounded-md ${className}`}>
      {/* Toolbar */}
      <div className="bg-gray-50 border-b border-gray-200 p-2 flex items-center gap-1">
        <Button
          variant="ghost"
          size="icon"
          type="button"
          onClick={() => handleFormat('bold')}
          className="p-1.5 h-8 w-8"
          title="Bold"
        >
          <Bold size={14} />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          type="button"
          onClick={() => handleFormat('italic')}
          className="p-1.5 h-8 w-8"
          title="Italic"
        >
          <Italic size={14} />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          type="button"
          onClick={() => handleFormat('underline')}
          className="p-1.5 h-8 w-8"
          title="Underline"
        >
          <Underline size={14} />
        </Button>

        <div className="w-px h-6 bg-gray-300 mx-1"></div>

        <Button
          variant="ghost"
          size="icon"
          type="button"
          onClick={() => handleFormat('insertUnorderedList')}
          className="p-1.5 h-8 w-8"
          title="Bullet List"
        >
          <List size={14} />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          type="button"
          onClick={() => handleFormat('insertOrderedList')}
          className="p-1.5 h-8 w-8"
          title="Numbered List"
        >
          <ListOrdered size={14} />
        </Button>

        <div className="w-px h-6 bg-gray-300 mx-1"></div>

        <Button
          variant="ghost"
          size="icon"
          type="button"
          onClick={() => {
            const url = prompt('Enter URL:');
            if (url) handleFormat('createLink', url);
          }}
          className="p-1.5 h-8 w-8"
          title="Add Link"
        >
          <Link size={14} />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          type="button"
          onClick={() => handleFormat('removeFormat')}
          className="p-1.5 h-8 w-8"
          title="Clear Formatting"
        >
          <Type size={14} />
        </Button>
      </div>

      {/* Editor Content */}
      <div
        ref={editorRef}
        contentEditable
        onInput={handleContentChange}
        onFocus={() => setIsFocused(true)}
        onBlur={() => setIsFocused(false)}
        dir="ltr"
        className={`p-3 outline-none ${isFocused ? 'ring-2 ring-blue-500 ring-opacity-50' : ''
          }`}
        style={{
          minHeight,
          maxHeight: '300px',
          overflowY: 'auto',
          textAlign: 'left',
          direction: 'ltr',
          unicodeBidi: 'embed',
          whiteSpace: 'pre-wrap',
          wordWrap: 'break-word'
        }}
        suppressContentEditableWarning={true}
        data-placeholder={placeholder}
      />

      {/* Character count indicator */}
      <div className="px-3 pb-2 text-xs text-gray-500 flex justify-end">
        <div className="bg-green-100 text-green-600 px-2 py-1 rounded-full">
          ✓
        </div>
      </div>
    </div>
  );
};

export default RichTextEditor;