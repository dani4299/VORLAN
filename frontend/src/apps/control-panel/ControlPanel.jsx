import React, { useState } from 'react';
import { Smartphone, Users } from 'lucide-react';
import { TabPanel, Tabs } from '../../components/ui/Tabs';
import { DevicesPanel } from './DevicesPanel';
import { UsersPanel } from './UsersPanel';

const TABS = [
  { id: 'users', label: 'Accounts', icon: Users },
  { id: 'devices', label: 'Devices', icon: Smartphone },
];

/** Who can use this VORLAN and from what: accounts (create, roles, passwords, delete) and signed-in devices. */
export const ControlPanel = () => {
  const [tab, setTab] = useState('users');
  return (
    <div className="h-full flex flex-col">
      <div className="px-4 pt-3 flex-shrink-0">
        <Tabs idPrefix="cp" label="Control Panel sections" tabs={TABS} value={tab} onChange={setTab} />
      </div>
      <div className="flex-1 min-h-0">
        <TabPanel idPrefix="cp" id="users" value={tab} className="h-full"><UsersPanel /></TabPanel>
        <TabPanel idPrefix="cp" id="devices" value={tab} className="h-full"><DevicesPanel /></TabPanel>
      </div>
    </div>
  );
};
