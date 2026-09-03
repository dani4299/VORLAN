import api, { authHeaders, getDeviceId } from './api';

export const listDevices = () => api.get('/devices', { headers: authHeaders() }).then((r) => r.data.devices);
export const renameDevice = (id, label) => api.patch(`/devices/${id}`, { label }, { headers: authHeaders() });

export const isThisDevice = (id) => id === getDeviceId();
