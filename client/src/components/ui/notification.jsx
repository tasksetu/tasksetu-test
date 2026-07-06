import React, { useState, useEffect } from 'react';
import { CheckCircle, AlertCircle, AlertTriangle, Info, X } from 'lucide-react';

const NotificationContainer = ({ notifications, removeNotification }) => {
  return (
    <div className="notification-container">
      {notifications.map((notification) => (
        <NotificationBox
          key={notification.id}
          notification={notification}
          onClose={() => removeNotification(notification.id)}
        />
      ))}
    </div>
  );
};

const NotificationBox = ({ notification, onClose }) => {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    // Show animation
    const showTimer = setTimeout(() => setIsVisible(true), 100);
    
    // Auto-hide after duration
    const hideTimer = setTimeout(() => {
      setIsVisible(false);
      setTimeout(onClose, 300); // Wait for animation to complete
    }, notification.duration || 5000);

    return () => {
      clearTimeout(showTimer);
      clearTimeout(hideTimer);
    };
  }, [notification.duration, onClose]);

  const getIcon = () => {
    switch (notification.type) {
      case 'success':
        return <CheckCircle className="notification-icon" />;
      case 'error':
        return <AlertCircle className="notification-icon" />;
      case 'warning':
        return <AlertTriangle className="notification-icon" />;
      case 'info':
        return <Info className="notification-icon" />;
      default:
        return <Info className="notification-icon" />;
    }
  };

  const getTypeClass = () => {
    switch (notification.type) {
      case 'success':
        return 'notification-success';
      case 'error':
        return 'notification-error';
      case 'warning':
        return 'notification-warning';
      case 'info':
        return 'notification-info';
      default:
        return 'notification-info';
    }
  };

  const handleClose = () => {
    setIsVisible(false);
    setTimeout(onClose, 300);
  };

  return (
    <div className={`notification-box ${getTypeClass()} ${isVisible ? 'show' : ''}`}>
      <div className="notification-content">
        {getIcon()}
        <div className="notification-text">
          {notification.title && (
            <div className="notification-title">{notification.title}</div>
          )}
          <div className="notification-message">{notification.message}</div>
        </div>
        <button
          onClick={handleClose}
          className="notification-close"
          aria-label="Close notification"
        >
          <X size={16} />
        </button>
      </div>
    </div>
  );
};

// Hook for managing notifications
export const useNotifications = () => {
  const [notifications, setNotifications] = useState([]);

  const addNotification = (notification) => {
    const id = Date.now() + Math.random();
    setNotifications(prev => [...prev, { ...notification, id }]);
  };

  const removeNotification = (id) => {
    setNotifications(prev => prev.filter(notification => notification.id !== id));
  };

  const showSuccess = (message, title = 'Success', duration = 5000) => {
    addNotification({ type: 'success', message, title, duration });
  };

  const showError = (message, title = 'Error', duration = 7000) => {
    addNotification({ type: 'error', message, title, duration });
  };

  const showWarning = (message, title = 'Warning', duration = 6000) => {
    addNotification({ type: 'warning', message, title, duration });
  };

  const showInfo = (message, title = 'Info', duration = 5000) => {
    addNotification({ type: 'info', message, title, duration });
  };

  return {
    notifications,
    removeNotification,
    showSuccess,
    showError,
    showWarning,
    showInfo,
    NotificationContainer: () => (
      <NotificationContainer 
        notifications={notifications} 
        removeNotification={removeNotification} 
      />
    )
  };
};

export default NotificationContainer;