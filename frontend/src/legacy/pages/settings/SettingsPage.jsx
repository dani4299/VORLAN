import React, { useState } from 'react';
import { User, Palette, Smartphone } from 'lucide-react';
import { BackButton } from '../../components/ui/BackButton';
import { AccountSettingsForm } from '../../components/dashboard/AccountSettingsForm';
import { AppearanceSettings } from './AppearanceSettings';
import { ConnectedDevicesSettings } from './ConnectedDevicesSettings';

const TABS = [
  { id: 'profile', label: 'Profile', icon: User },
  { id: 'appearance', label: 'Appearance', icon: Palette },
  { id: 'devices', label: 'Connected Devices', icon: Smartphone },
];

const TAB_COPY = {
  profile: { title: 'Profile', description: 'Your account details and sign-in' },
  appearance: { title: 'Appearance', description: 'Choose how VORLAN looks across every screen' },
  devices: { title: 'Connected Devices', description: 'Devices signed in to your account, and how much data each has used' },
};

export const SettingsPage = () => {
  const [tab, setTab] = useState('profile');

  return (
    <div className="flex h-full w-full">
      {/* Persistent sidebar nav - a settings app's own section list, not a page tab bar. */}
      <div className="hidden md:flex w-60 flex-shrink-0 flex-col gap-1 p-4 border-r border-[var(--surface-border)]">
        <div className="flex items-center gap-2 px-2 pb-4 pt-1">
          <BackButton />
          <span className="text-sm font-semibold text-[var(--ink)]">Settings</span>
        </div>
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex items-center gap-2.5 px-3 py-2.5 rounded-2xl text-sm font-medium transition-all duration-150 ${tab === t.id ? 'text-[var(--ink)]' : 'text-[var(--ink-muted)] hover:text-[var(--ink)] hover:bg-[var(--overlay-2)]'}`}
            style={tab === t.id ? { background: 'var(--accent-wash)' } : undefined}
          >
            <t.icon size={16} /> {t.label}
          </button>
        ))}
      </div>

      {/* Mobile: pill tabs since there's no room for a persistent sidebar column. */}
      <div className="md:hidden fixed top-0 left-0 right-0 z-20 flex items-center gap-2 p-4 border-b border-[var(--surface-border)]" style={{ background: 'var(--canvas)' }}>
        <BackButton />
        <div className="flex gap-1 p-1 rounded-full chip flex-1">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-full text-xs font-medium transition-all duration-150 ${tab === t.id ? 'bg-[var(--accent-solid)] text-[var(--on-accent)]' : 'text-[var(--ink-muted)]'}`}
            >
              <t.icon size={13} /> {t.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto flex justify-center pt-20 pb-10 md:py-10">
        <div className="w-[80%] max-w-3xl">
          <h1 className="text-2xl font-semibold tracking-tight text-[var(--ink)] mb-1">{TAB_COPY[tab].title}</h1>
          <p className="text-sm text-[var(--ink-muted)] mb-8">{TAB_COPY[tab].description}</p>
          {tab === 'profile' && (
            <div className="surface rounded-[24px] p-6 md:p-7 max-w-lg">
              <AccountSettingsForm />
            </div>
          )}
          {tab === 'appearance' && <AppearanceSettings />}
          {tab === 'devices' && <ConnectedDevicesSettings />}
        </div>
      </div>
    </div>
  );
};
