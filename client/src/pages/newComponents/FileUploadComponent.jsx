import React from 'react';

const FileUploadComponent = ({ onFileSelect, maxFiles = 5, acceptedTypes = [] }) => {
  const handleFileChange = (event) => {
    const files = Array.from(event.target.files);
    if (onFileSelect) {
      onFileSelect(files);
    }
  };

  return (
    <div className="file-upload-component">
      <input
        type="file"
        onChange={handleFileChange}
        multiple={maxFiles > 1}
        accept={acceptedTypes.join(',')}
        className="w-full p-2 border border-gray-300 rounded"
      />
    </div>
  );
};

export default FileUploadComponent;