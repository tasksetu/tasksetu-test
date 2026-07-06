import React from 'react';
import DOMPurify from 'dompurify';

/**
 * SafeHtml - Renders sanitized HTML content safely
 * Used for displaying rich text descriptions from Quill editor
 * 
 * @param {string} html - Raw HTML string to render
 * @param {string} className - Additional CSS classes
 * @param {string} as - HTML element to render as (default: 'div')
 * @param {boolean} truncate - If true, strips HTML and truncates for previews
 * @param {number} maxLength - Max characters when truncated (default: 150)
 */

// Strip HTML tags for plain text previews (tooltips, truncated cards)
export const stripHtmlToText = (html) => {
  if (!html) return '';
  const tmp = document.createElement('DIV');
  tmp.innerHTML = html;
  return tmp.textContent || tmp.innerText || '';
};

// Check if content has actual text (not just empty HTML tags)
export const hasTextContent = (html) => {
  if (!html) return false;
  const text = stripHtmlToText(html).trim();
  return text.length > 0;
};

// Truncate plain text with ellipsis
export const truncateText = (text, maxLength = 150) => {
  if (!text) return '';
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength).trim() + '...';
};

// Get plain text preview from HTML for tooltips / cards
export const getTextPreview = (html, maxLength = 150) => {
  const text = stripHtmlToText(html);
  return truncateText(text, maxLength);
};

const SafeHtml = ({
  html = '',
  className = '',
  as: Tag = 'div',
  truncate = false,
  maxLength = 150,
  style = {},
}) => {
  if (!html) return null;

  // For truncated previews, return plain text
  if (truncate) {
    const text = getTextPreview(html, maxLength);
    return <Tag className={className} style={style}>{text}</Tag>;
  }

  // Sanitize HTML before rendering
  const cleanHtml = DOMPurify.sanitize(html, {
    ALLOWED_TAGS: [
      'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'blockquote', 'p', 'a', 'ul', 'ol',
      'li', 'b', 'i', 'strong', 'em', 'strike', 's', 'del', 'code', 'hr', 'br',
      'div', 'table', 'thead', 'caption', 'tbody', 'tr', 'th', 'td', 'pre', 'span',
      'sub', 'sup', 'u',
    ],
    ALLOWED_ATTR: ['href', 'target', 'rel', 'style', 'class', 'title'],
    ALLOWED_URI_REGEXP: /^(?:(?:https?|mailto):|[^a-z]|[a-z+.-]+(?:[^a-z+.\-:]|$))/i,
    ADD_ATTR: ['target'],
  });

  // Enhance links: add target="_blank", rel, title, and ensure proper protocol
  const enhancedHtml = cleanHtml.replace(
    /<a\s+((?:[^>]*?)href="([^"]*)"[^>]*)>/gi,
    (match, attrs, href) => {
      // Ensure URL has proper protocol
      let fixedHref = href;
      if (fixedHref && !/^(https?:\/\/|mailto:|tel:|#)/i.test(fixedHref)) {
        fixedHref = 'https://' + fixedHref;
      }
      let cleanAttrs = attrs
        .replace(/\s*href="[^"]*"/gi, '')
        .replace(/\s*target="[^"]*"/gi, '')
        .replace(/\s*rel="[^"]*"/gi, '')
        .replace(/\s*title="[^"]*"/gi, '');
      return `<a ${cleanAttrs} href="${fixedHref}" target="_blank" rel="noopener noreferrer" title="${fixedHref}">`;
    }
  );

  return (
    <Tag
      className={`rich-text-content ${className}`}
      style={style}
      dangerouslySetInnerHTML={{ __html: enhancedHtml }}
    />
  );
};

export default SafeHtml;
