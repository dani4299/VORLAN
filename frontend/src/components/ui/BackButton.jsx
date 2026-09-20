import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft } from 'lucide-react';
import { useWindow } from '../../desktop/WindowContext';
import { useInShell } from '../layout/ShellContext';
import { IconButton } from './Button';

/**
 * Pops one level within a page (e.g. a folder view back to its parent folder) when given `onBack`.
 * Without `onBack` it means "back to the dashboard", which a page under the app bar or inside a
 * desktop window already has another way to do, so it renders nothing there.
 */
export const BackButton = ({ onBack, className = '' }) => {
  const navigate = useNavigate();
  const inWindow = useWindow();
  const inShell = useInShell();
  if ((inWindow || inShell) && !onBack) return null;
  return (
    <IconButton label="Back" onClick={onBack || (() => navigate('/dashboard'))} className={className}>
      <ChevronLeft size={18} aria-hidden="true" />
    </IconButton>
  );
};
