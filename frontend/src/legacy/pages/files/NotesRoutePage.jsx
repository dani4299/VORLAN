import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useWindow } from '../../../desktop/WindowContext';
import { getUsername } from '../../../lib/api';
import { NotesPage } from './NotesPage';

export const NotesRoutePage = () => {
  const navigate = useNavigate();
  const inWindow = useWindow();
  return (
    <div className="p-4 md:p-10 max-w-6xl mx-auto h-full overflow-y-auto">
      <NotesPage isPersonal={false} activeUser={getUsername()} onBack={() => (inWindow ? inWindow.close() : navigate('/dashboard'))} />
    </div>
  );
};
