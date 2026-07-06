import React, { createContext, useContext, useState, useEffect } from 'react';
import { useLocation } from 'wouter';

const CalendarContext = createContext();

export const CalendarProvider = ({ children }) => {
  const [showCalendar, setShowCalendar] = useState(false);
  const [location] = useLocation();

  // ✅ Route change hone par calendar band ho jaye
  useEffect(() => {
    setShowCalendar(false);
  }, [location]);

  const toggleCalendar = () => {
    setShowCalendar(prev => !prev);
  };

  return (
    <CalendarContext.Provider value={{ showCalendar, toggleCalendar, setShowCalendar }}>
      {children}
    </CalendarContext.Provider>
  );
};

export const useCalendar = () => {
  const context = useContext(CalendarContext);
  if (!context) {
    throw new Error('useCalendar must be used within CalendarProvider');
  }
  return context;
};