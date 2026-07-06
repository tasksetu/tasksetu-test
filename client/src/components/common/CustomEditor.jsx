import React, { useMemo } from 'react';
import ReactQuill from "react-quill";
import "quill/dist/quill.snow.css";  
import './CustomEditor.css';

// Ensure links always have a protocol prefix
const ensureLinkProtocol = (value) => {
  if (!value || typeof value !== 'string') return value;
  return value.replace(
    /<a\s+((?:[^>]*?)href="([^"]*)"[^>]*)>/gi,
    (match, attrs, href) => {
      if (href && !/^(https?:\/\/|mailto:|tel:|#)/i.test(href)) {
        const fixedHref = 'https://' + href;
        return match.replace(`href="${href}"`, `href="${fixedHref}"`);
      }
      return match;
    }
  );
};

const CustomEditor = ({
  value = '',
  onChange,
  placeholder = 'Start typing...',
  className = '',
  height = '200px',
  readOnly = false,
  ...props
}) => {
  const modules = useMemo(() => ({
    toolbar: readOnly
      ? false
      : [
          [{ header: [1, 2, 3, false] }],
          ['bold', 'italic', 'underline', 'strike'],
          [{ list: 'ordered' }, { list: 'bullet' }],
          [{ color: [] }, { background: [] }],
          ['link'],
          ['clean'],
        ],
  }), [readOnly]);

  const formats = [
    'header',
    'bold',
    'italic',
    'underline',
    'strike',
    'list',
    'bullet',
    'color',
    'background',
    'link',
  ];

  const handleChange = (content) => {
    if (onChange) {
      onChange(ensureLinkProtocol(content));
    }
  };

  return (
    <div className={`custom-editor  ${className}`}>
      <ReactQuill
        theme="snow"
        value={value}
        onChange={handleChange}
        placeholder={placeholder}
        modules={modules}
        formats={formats}
        readOnly={readOnly}
  
        {...props}
      />
    </div>
  );
};

export default CustomEditor;
