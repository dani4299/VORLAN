import React from 'react';
import { Modal } from '../../../components/ui/Modal';
import { AccountSettingsForm } from './AccountSettingsForm';

export const AccountSettingsModal = ({ onClose }) => (
  <Modal title="Profile settings" onClose={onClose}>
    <AccountSettingsForm onSaved={onClose} />
  </Modal>
);
