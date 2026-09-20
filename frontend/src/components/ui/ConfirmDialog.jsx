import React from 'react';
import { Modal } from './Modal';
import { Button } from './Button';

/**
 * Asks before a destructive or hard-to-undo action. Uses role="alertdialog" so it's announced
 * with urgency, and focus starts on Cancel - pressing Enter by reflex should never delete anything.
 */
export const ConfirmDialog = ({
  title, message, confirmLabel = 'Confirm', cancelLabel = 'Cancel', tone = 'danger', loading = false, onConfirm, onCancel,
}) => (
  <Modal title={title} description={message} onClose={onCancel} role="alertdialog">
    <div className="flex justify-end gap-2 pt-2">
      <Button variant="ghost" onClick={onCancel} disabled={loading} data-autofocus>{cancelLabel}</Button>
      <Button variant={tone === 'danger' ? 'danger' : 'primary'} onClick={onConfirm} loading={loading}>{confirmLabel}</Button>
    </div>
  </Modal>
);
