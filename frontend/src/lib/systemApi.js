import api, { authHeaders } from './api';

export const getConnectQr = () => api.get('/system/connect-qr', { headers: authHeaders() }).then((r) => r.data);
