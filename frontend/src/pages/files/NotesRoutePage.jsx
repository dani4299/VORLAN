import React from 'react';
import { getUsername } from '../../lib/api';
import { NotesPage } from './NotesPage';

export const NotesRoutePage = () => (
  <div className="p-4 md:p-8 max-w-6xl mx-auto h-full overflow-y-auto">
    <NotesPage isPersonal={false} activeUser={getUsername()} />
  </div>
);
