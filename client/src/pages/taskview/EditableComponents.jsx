import React, { useState } from 'react';

// Editable field components
function EditableTitle({ title, onSave, canEdit }) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(title);

  const handleSave = () => {
    if (editValue.trim() && editValue !== title) {
      onSave(editValue.trim());
    }
    setIsEditing(false);
  };

  const handleCancel = () => {
    setEditValue(title);
    setIsEditing(false);
  };

  if (!canEdit) {
    return <h1 className="task-title readonly">{title}</h1>;
  }

  if (isEditing) {
    return (
      <div className="editable-title-container">
        <input
          type="text"
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onBlur={handleSave}
          onKeyDown={(e) => {
            if (e.key === "Enter") handleSave();
            if (e.key === "Escape") handleCancel();
          }}
          autoFocus
          className="editable-title-input"
          maxLength={100}
        />
      </div>
    );
  }

  return (
    <h1 className="task-title editable" onClick={() => setIsEditing(true)}>
      {title}
      <span className="edit-icon">✏️</span>
    </h1>
  );
}

function EditableTextArea({ value, onSave, canEdit, placeholder }) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(value);

  const handleSave = () => {
    if (editValue !== value) {
      onSave(editValue);
    }
    setIsEditing(false);
  };

  if (!canEdit) {
    return (
      <p className="readonly-text text-xs text-gray-700">
        {value || placeholder}
      </p>
    );
  }

  if (isEditing) {
    return (
      <div className="editable-textarea-container">
        <textarea
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onBlur={handleSave}
          autoFocus
          className="w-full px-2 py-1 text-xs border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-transparent resize-none"
          rows="2"
          placeholder={placeholder}
        />
      </div>
    );
  }

  return (
    <div
      className="editable-text-display cursor-pointer text-xs p-1 rounded hover:bg-gray-100 group"
      onClick={() => setIsEditing(true)}
    >
      <p className="text-gray-700">{value || placeholder}</p>
      <span className="edit-icon opacity-0 group-hover:opacity-100 text-xs">
        ✏️
      </span>
    </div>
  );
}

function EditableTextField({ value, onSave, canEdit }) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(value);

  const handleSave = () => {
    if (editValue !== value) {
      onSave(editValue);
    }
    setIsEditing(false);
  };

  if (!canEdit) {
    return <span className="readonly-text text-xs">{value}</span>;
  }

  if (isEditing) {
    return (
      <input
        type="text"
        value={editValue}
        onChange={(e) => setEditValue(e.target.value)}
        onBlur={handleSave}
        onKeyDown={(e) => {
          if (e.key === "Enter") handleSave();
          if (e.key === "Escape") {
            setEditValue(value);
            setIsEditing(false);
          }
        }}
        autoFocus
        className="w-full px-1 py-0.5 text-xs border border-gray-300 rounded focus:ring-1 focus:ring-blue-500"
      />
    );
  }

  return (
    <span
      className="editable-field cursor-pointer text-xs hover:bg-gray-100 px-1 py-0.5 rounded group"
      onClick={() => setIsEditing(true)}
    >
      {value}
      <span className="edit-icon opacity-0 group-hover:opacity-100 ml-1 text-xs">
        ✏️
      </span>
    </span>
  );
}

function EditableDateField({ value, onSave, canEdit }) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(value);

  const handleSave = () => {
    if (editValue !== value) {
      onSave(editValue);
    }
    setIsEditing(false);
  };

  if (!canEdit) {
    return <span className="readonly-text text-xs">{value}</span>;
  }

  if (isEditing) {
    return (
      <input
        type="date"
        value={editValue}
        onChange={(e) => setEditValue(e.target.value)}
        onBlur={handleSave}
        autoFocus
        className="w-full px-1 py-0.5 text-xs border border-gray-300 rounded focus:ring-1 focus:ring-blue-500"
      />
    );
  }

  return (
    <span
      className="editable-field cursor-pointer text-xs hover:bg-gray-100 px-1 py-0.5 rounded group"
      onClick={() => setIsEditing(true)}
    >
      {value}
      <span className="edit-icon opacity-0 group-hover:opacity-100 ml-1 text-xs">
        ✏️
      </span>
    </span>
  );
}

export { EditableTitle, EditableTextArea, EditableTextField, EditableDateField };