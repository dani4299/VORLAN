import React, { useState } from 'react';
import { Palette, Smartphone, User } from 'lucide-react';
import { AccountSettingsForm } from '../../components/dashboard/AccountSettingsForm';
import { TabPanel, Tabs } from '../../components/ui/Tabs';
import { useElementWidth } from '../../lib/useElementWidth';
import { AppearanceSettings } from './AppearanceSettings';
import { ConnectedDevicesSettings } from './ConnectedDevicesSettings';

const TABS = [
  { id: 'profile', label: 'Profile', icon: User },
  { id: 'appearance', label: 'Appearance', icon: Palette },
  { id: 'devices', label: 'Connected devices', icon: Smartphone },
];

const WIDE_FROM = 640; // px of page (or window) width at which the section list becomes a side column

export const SettingsPage = () => {
  const [tab, setTab] = useState('profile');
  const [root, setRoot] = useState(null);
  const wide = useElementWidth(root) >= WIDE_FROM;
  const heading = TABS.find((t) => t.id === tab).label;

  const tabs = <Tabs idPrefix="settings" label="Settings sections" tabs={TABS} value={tab} onChange={setTab} orientation={wide ? 'vertical' : 'horizontal'} />;

  return (
    <div ref={setRoot} className={`h-full flex ${wide ? 'flex-row' : 'flex-col'}`}>
      {wide ? (
        <nav aria-label="Settings" className="w-56 flex-shrink-0 p-4 border-r border-[var(--surface-border)] overflow-y-auto">{tabs}</nav>
      ) : (
        <nav aria-label="Settings" className="px-4 pt-3 flex-shrink-0 overflow-x-auto">{tabs}</nav>
      )}

      <div className="flex-1 min-w-0 overflow-y-auto p-4 md:p-6">
        <div className="max-w-2xl">
          <h1 className="text-lg font-semibold text-[var(--ink)] mb-4">{heading}</h1>
          <TabPanel idPrefix="settings" id="profile" value={tab}><div className="max-w-md"><AccountSettingsForm /></div></TabPanel>
          <TabPanel idPrefix="settings" id="appearance" value={tab}><AppearanceSettings /></TabPanel>
          <TabPanel idPrefix="settings" id="devices" value={tab}><ConnectedDevicesSettings /></TabPanel>
        </div>
      </div>
    </div>
  );
};
