// Simple Email Input Component for Registration
import React, { useState, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { CheckCircle, XCircle, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function SimpleEmailInput({ 
  value, 
  onChange, 
  placeholder = "Enter email",
  className,
  ...props 
}) {
  const [email, setEmail] = useState(value || '');
  const [isChecking, setIsChecking] = useState(false);
  const [isValid, setIsValid] = useState(null);
  const [error, setError] = useState('');

  // Sync with parent value
  useEffect(() => {
    setEmail(value || '');
    setIsValid(null);
    setError('');
    setIsChecking(false);
  }, [value]);

  const validateEmail = (email) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const checkEmail = async (email) => {
    if (!email || !validateEmail(email)) {
      setIsValid(false);
      setError('Please enter a valid email address');
      setIsChecking(false);
      return;
    }

    setIsChecking(true);
    setError('');

    try {
      // Mock email check - replace with actual API call
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Mock: emails ending with 'test.com' are taken
      if (email.endsWith('test.com')) {
        setIsValid(false);
        setError('Email already exists');
      } else {
        setIsValid(true);
        setError('');
      }
    } catch (error) {
      setIsValid(false);
      setError('Failed to validate email');
    } finally {
      setIsChecking(false);
    }
  };

  const handleChange = (e) => {
    const newEmail = e.target.value;
    setEmail(newEmail);
    onChange?.(newEmail);
    
    // Reset validation state immediately
    setIsValid(null);
    setError('');
    setIsChecking(false);
    
    // Clear any existing timeout
    if (window.emailValidationTimeout) {
      clearTimeout(window.emailValidationTimeout);
    }
    
    // Debounced validation
    if (newEmail && validateEmail(newEmail)) {
      window.emailValidationTimeout = setTimeout(() => {
        checkEmail(newEmail);
      }, 500);
    }
  };

  const getValidationIcon = () => {
    if (isChecking) {
      return <Loader2 className="h-4 w-4 animate-spin text-gray-400" />;
    }
    if (isValid === true) {
      return <CheckCircle className="h-4 w-4 text-green-500" />;
    }
    if (isValid === false) {
      return <XCircle className="h-4 w-4 text-red-500" />;
    }
    return null;
  };

  return (
    <div className="space-y-1">
      <div className="relative">
        <Input
          type="email"
          value={email}
          onChange={handleChange}
          placeholder={placeholder}
          className={cn(
            className,
            isValid === false && "border-red-300 focus:border-red-500",
            isValid === true && "border-green-300 focus:border-green-500",
            "pr-10"
          )}
          {...props}
        />
        <div className="absolute inset-y-0 right-0 flex items-center pr-3">
          {getValidationIcon()}
        </div>
      </div>
      
      {error && (
        <p className="text-sm text-red-600">{error}</p>
      )}
      
      {isValid === true && !error && (
        <p className="text-sm text-green-600">Email is available</p>
      )}
    </div>
  );
}