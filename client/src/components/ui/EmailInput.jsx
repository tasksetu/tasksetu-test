// Email Input Component with validation
import React, { useState, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { CheckCircle, XCircle, Loader2, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';
import useEmailValidation from '@/hooks/useEmailValidation';

export default function EmailInput({ 
  value, 
  onChange, 
  onValidationChange,
  label = "Email", 
  placeholder = "Enter your email",
  required = true,
  showSuggestions = true,
  className,
  ...props 
}) {
  const [email, setEmail] = useState(value || '');
  const [showValidation, setShowValidation] = useState(false);
  const [suggestions, setSuggestions] = useState([]);
  
  const { 
    isChecking, 
    emailStatus, 
    checkEmailExists, 
    validateEmailFormat,
    getEmailSuggestions,
    resetStatus
  } = useEmailValidation();

  // Reset component when value prop changes (for form switching)
  useEffect(() => {
    setEmail(value || '');
    setShowValidation(false);
    setSuggestions([]);
    resetStatus();
  }, [value, resetStatus]);

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (email && validateEmailFormat(email)) {
        checkEmailExists(email);
        setShowValidation(true);
      } else {
        setShowValidation(false);
        onValidationChange?.(false);
      }
    }, 500); // Debounce

    return () => clearTimeout(timeoutId);
  }, [email, checkEmailExists, validateEmailFormat, onValidationChange]);

  // Notify parent about validation status
  useEffect(() => {
    const isValid = email && 
                   validateEmailFormat(email) && 
                   emailStatus?.success && 
                   !emailStatus?.exists && 
                   !isChecking;
    onValidationChange?.(isValid);
  }, [email, emailStatus, isChecking, validateEmailFormat, onValidationChange]);

  const handleEmailChange = (e) => {
    const newEmail = e.target.value;
    setEmail(newEmail);
    onChange?.(newEmail);
    
    if (newEmail.length === 0) {
      setShowValidation(false);
    }
  };

  const handleSuggestionClick = async (suggestedEmail) => {
    setEmail(suggestedEmail);
    onChange?.(suggestedEmail);
    setSuggestions([]);
  };

  const loadSuggestions = async () => {
    if (emailStatus?.exists && showSuggestions) {
      const result = await getEmailSuggestions(email);
      if (result.success && result.suggestions) {
        setSuggestions(result.suggestions);
      }
    }
  };

  useEffect(() => {
    if (emailStatus?.exists) {
      loadSuggestions();
    } else {
      setSuggestions([]);
    }
  }, [emailStatus]);

  const getValidationIcon = () => {
    if (isChecking) {
      return <Loader2 className="h-4 w-4 animate-spin text-gray-400" />;
    }
    
    if (emailStatus?.exists) {
      return <XCircle className="h-4 w-4 text-red-500" />;
    }
    
    if (emailStatus?.success && !emailStatus?.exists) {
      return <CheckCircle className="h-4 w-4 text-green-500" />;
    }
    
    if (email && !validateEmailFormat(email)) {
      return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
    }
    
    return null;
  };

  const getValidationMessage = () => {
    if (!email) return null;
    
    if (!validateEmailFormat(email)) {
      return { type: 'error', message: 'Please enter a valid email address' };
    }
    
    if (isChecking) {
      return { type: 'info', message: 'Checking email availability...' };
    }
    
    if (emailStatus?.exists) {
      return { type: 'error', message: 'This email is already registered' };
    }
    
    if (emailStatus?.success && !emailStatus?.exists) {
      return { type: 'success', message: 'Email is available' };
    }
    
    return null;
  };

  const validationMessage = getValidationMessage();

  return (
    <div className="space-y-2">
      <Label htmlFor="email" className={cn(required && "after:content-['*'] after:text-red-500 after:ml-1")}>
        {label}
      </Label>
      
      <div className="relative">
        <Input
          id="email"
          type="email"
          value={email}
          onChange={handleEmailChange}
          placeholder={placeholder}
          className={cn(
            className,
            emailStatus?.exists && "border-red-300 focus:border-red-500",
            emailStatus?.success && !emailStatus?.exists && "border-green-300 focus:border-green-500",
            "pr-10"
          )}
          {...props}
        />
        
        <div className="absolute inset-y-0 right-0 flex items-center pr-3">
          {getValidationIcon()}
        </div>
      </div>

      {/* Validation Message */}
      {showValidation && validationMessage && (
        <div className={cn(
          "text-sm flex items-center space-x-1",
          validationMessage.type === 'error' && "text-red-600",
          validationMessage.type === 'success' && "text-green-600",
          validationMessage.type === 'info' && "text-blue-600"
        )}>
          <span>{validationMessage.message}</span>
        </div>
      )}

      {/* Email Suggestions */}
      {suggestions.length > 0 && (
        <div className="space-y-2">
          <p className="text-sm text-gray-600">Try these alternatives:</p>
          <div className="flex flex-wrap gap-2">
            {suggestions.map((suggestion, index) => (
              <Badge
                key={index}
                variant="outline"
                className="cursor-pointer hover:bg-blue-50 hover:border-blue-300"
                onClick={() => handleSuggestionClick(suggestion)}
              >
                {suggestion}
              </Badge>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}