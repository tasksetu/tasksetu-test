// Frontend Email Validation Hook
import { useState, useCallback } from 'react';

export const useEmailValidation = () => {
  const [isChecking, setIsChecking] = useState(false);
  const [emailStatus, setEmailStatus] = useState(null);

  const checkEmailExists = useCallback(async (email) => {
    if (!email || email.length < 5) {
      setEmailStatus(null);
      return null;
    }

    setIsChecking(true);
    
    try {
      const response = await fetch(`/api/email/check-email/${encodeURIComponent(email)}`);
      const data = await response.json();
      
      setEmailStatus(data);
      setIsChecking(false);
      
      return data;
    } catch (error) {
      console.error('Email validation error:', error);
      setEmailStatus({
        success: false,
        message: 'Failed to check email availability'
      });
      setIsChecking(false);
      return null;
    }
  }, []);

  const validateEmailFormat = (email) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const getEmailSuggestions = useCallback(async (email) => {
    try {
      const response = await fetch(`/api/email/suggest-email/${encodeURIComponent(email)}`);
      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Email suggestion error:', error);
      return { success: false, suggestions: [] };
    }
  }, []);

  return {
    isChecking,
    emailStatus,
    checkEmailExists,
    validateEmailFormat,
    getEmailSuggestions,
    resetStatus: () => setEmailStatus(null)
  };
};

export default useEmailValidation;