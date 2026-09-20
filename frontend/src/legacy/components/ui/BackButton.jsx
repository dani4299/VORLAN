import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft } from 'lucide-react';
import { useWindow } from '../../../desktop/WindowContext';
import { IconButton } from './Button';

/**
 * Consistent back affordance for every non-home page. Pass `onBack` to pop one level within
 * a page (e.g. a folder view back to its parent folder); omitted, it returns to the dashboard.
 * Inside a desktop window there is no page to go back to (the window has its own close button),
 * so it renders nothing unless it has a real in-page `onBack`.
 */
export const BackButton = ({ onBack, className = '' }) => {
  const navigate = useNavigate();
  const inWindow = useWindow();
  if (inWindow && !onBack) return null;
  return (
    <IconButton label="Back" onClick={onBack || (() => navigate('/dashboard'))} className={className}>
      <ChevronLeft size={18} aria-hidden="true" />
    </IconButton>
  );
};
