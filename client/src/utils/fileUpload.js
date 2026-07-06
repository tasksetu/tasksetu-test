// File upload utilities
export const validateFile = (file, maxSize = 10 * 1024 * 1024) => {
  if (!file) return { valid: false, error: "No file selected" };
  
  if (file.size > maxSize) {
    return { valid: false, error: "File size too large" };
  }
  
  return { valid: true };
};

export const handleFileUpload = async (file) => {
  const validation = validateFile(file);
  if (!validation.valid) {
    throw new Error(validation.error);
  }
  
  // Mock upload - in real app would upload to server/cloud
  return {
    id: Date.now(),
    name: file.name,
    size: file.size,
    type: file.type,
    url: URL.createObjectURL(file)
  };
};

export const formatFileSize = (bytes) => {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};