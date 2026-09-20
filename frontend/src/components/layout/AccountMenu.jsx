import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { LogOut, QrCode, Settings, User, UserCog } from 'lucide-react';
import { Menu } from '../ui/Menu';
import { AccountSettingsModal } from '../dashboard/AccountSettingsModal';
import { ConnectDeviceModal } from '../dashboard/ConnectDeviceModal';
import { useProfile } from '../../context/ProfileContext';
import { logout } from '../../lib/api';

const TRIGGER = 'inline-flex items-center gap-2 h-9 px-2 rounded-[var(--radius-md)] text-sm font-medium text-[var(--ink)] hover:bg-[var(--overlay-3)] transition-colors';

/**
 * The account menu in the top-right of every screen: profile, connecting a phone, settings, sign out.
 * `onOpenSettings` is supplied by the host, since Settings is a window on the admin desktop and a
 * page for everyone else.
 */
export const AccountMenu = ({ onOpenSettings, showName = true }) => {
  const navigate = useNavigate();
  const { username, fullName, profilePic } = useProfile();
  const [dialog, setDialog] = useState(null); // 'account' | 'connect'
  const displayName = fullName || username;

  const items = [
    { id: 'account', label: 'Account settings', icon: UserCog, onSelect: () => setDialog('account') },
    { id: 'connect', label: 'Connect a phone', icon: QrCode, onSelect: () => setDialog('connect') },
    { id: 'settings', label: 'Settings', icon: Settings, onSelect: onOpenSettings },
    { separator: true },
    { id: 'signout', label: 'Sign out', icon: LogOut, onSelect: () => { logout(); navigate('/login'); } },
  ];

  return (
    <>
      <Menu
        label="Account"
        align="right"
        buttonLabel={`Account: ${displayName}`}
        buttonClassName={TRIGGER}
        buttonContent={(
          <>
            <span className="w-6 h-6 rounded-full overflow-hidden flex items-center justify-center flex-shrink-0 bg-[var(--overlay-3)]">
              {profilePic ? <img src={profilePic} alt="" className="w-full h-full object-cover" /> : <User size={14} aria-hidden="true" className="text-[var(--ink-muted)]" />}
            </span>
            {showName && <span className="hidden sm:inline max-w-[10rem] truncate">{displayName}</span>}
          </>
        )}
        items={items}
      />
      {dialog === 'account' && <AccountSettingsModal onClose={() => setDialog(null)} />}
      {dialog === 'connect' && <ConnectDeviceModal onClose={() => setDialog(null)} />}
    </>
  );
};
