import React from 'react';
import { QrCode } from 'lucide-react';
import { IconButton } from '../ui/Button';

export const ConnectDeviceButton = ({ onClick, overlayTone }) => (
  <IconButton onClick={onClick} overlay overlayTone={overlayTone} title="Connect a device">
    <QrCode size={18} />
  </IconButton>
);
