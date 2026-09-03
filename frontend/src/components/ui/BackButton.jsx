import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft } from 'lucide-react';
import { IconButton } from './Button';

/**
 * Consistent back affordance for every non-home page. Pass `onBack` to pop one level within
 * a page (e.g. a folder view back to its parent folder); omitted, it returns to the dashboard.
 */
export const BackButton = ({ onBack, className = '' }) => {
  const navigate = useNavigate();
  return (
    <IconButton onClick={onBack || (() => navigate('/dashboard'))} title="Back" className={className}>
      <ChevronLeft size={18} />
    </IconButton>
  );
};
