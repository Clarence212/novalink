const API_BASE_URL = '/backend/api';

let csrfToken = '';

export class ApiError extends Error {
  constructor(message, status, payload = null) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.payload = payload;
  }
}

async function parseResponse(response) {
  const contentType = response.headers.get('content-type') || '';
  const payload = contentType.includes('application/json')
    ? await response.json().catch(() => ({}))
    : {};
  if (!response.ok) {
    throw new ApiError(payload.error || `Request failed with HTTP ${response.status}.`, response.status, payload);
  }
  return payload;
}

async function request(path, { method = 'GET', body, formData } = {}) {
  const headers = { Accept: 'application/json' };
  if (csrfToken && method !== 'GET') headers['X-CSRF-Token'] = csrfToken;
  if (!formData && body !== undefined) headers['Content-Type'] = 'application/json';

  const response = await fetch(`${API_BASE_URL}/${path}`, {
    method,
    credentials: 'same-origin',
    headers,
    body: formData || (body === undefined ? undefined : JSON.stringify(body)),
  });
  return parseResponse(response);
}

export function setCsrfToken(value) {
  csrfToken = value || '';
}

export async function apiSession() {
  const result = await request('auth.php?action=session');
  setCsrfToken(result.csrfToken);
  return result;
}

export async function apiLogin(email, password, rememberMe = false) {
  const result = await request('auth.php', {
    method: 'POST',
    body: { action: 'login', email, password, rememberMe },
  });
  setCsrfToken(result.csrfToken);
  return result;
}

export async function apiLogout() {
  const result = await request('auth.php', { method: 'POST', body: { action: 'logout' } });
  setCsrfToken(result.csrfToken);
  return result;
}

export async function apiRegister(userData, verificationToken) {
  return request('auth.php', {
    method: 'POST',
    body: { action: 'register', ...userData, verificationToken },
  });
}

export async function apiResetPassword(email, password, verificationToken) {
  return request('auth.php', {
    method: 'POST',
    body: { action: 'reset-password', email, password, verificationToken },
  });
}

export async function apiChangePassword(currentPassword, newPassword) {
  const result = await request('auth.php', {
    method: 'POST',
    body: { action: 'change-password', currentPassword, newPassword },
  });
  setCsrfToken(result.csrfToken);
  return result;
}

export async function apiSendOtp(email, name = 'User', type = 'registration', contactNumber = '', blockLot = '') {
  return request('send_otp.php', {
    method: 'POST',
    body: { email, name, type, contactNumber, blockLot },
  });
}

export async function apiVerifyOtp(email, otp, type = 'registration') {
  const result = await request('verify_email.php', {
    method: 'POST',
    body: { email, otp, type },
  });
  if (result.csrfToken) setCsrfToken(result.csrfToken);
  return result;
}

export async function apiFetchState() {
  const result = await request('state.php');
  return result.state;
}

export async function apiFetchPublicFacilities() {
  const result = await request('state.php?scope=public');
  return result.facilities || [];
}

export async function apiAction(resource, action, payload = {}) {
  return request('records.php', {
    method: 'POST',
    body: { resource, action, ...payload },
  });
}

export async function apiUploadPayment({ amount, reference, proof, paymentId = null }) {
  const data = new FormData();
  data.append('resource', 'payments');
  data.append('action', paymentId ? 'resubmit' : 'submit');
  data.append('amount', String(amount));
  data.append('reference', reference);
  if (paymentId) data.append('paymentId', paymentId);
  data.append('proof', proof);
  return request('records.php', { method: 'POST', formData: data });
}

export async function apiUploadPaymentQr({ provider, accountName, accountNumber, image }) {
  const data = new FormData();
  data.append('resource', 'payment-qr');
  data.append('action', 'update');
  data.append('provider', provider);
  data.append('accountName', accountName);
  data.append('accountNumber', accountNumber);
  if (image) data.append('image', image);
  return request('records.php', { method: 'POST', formData: data });
}

// Kept for the administrator-only manual notification screen and backwards compatibility.
export async function apiSendNotification(email, name, title, message) {
  return request('send_notification.php', {
    method: 'POST',
    body: { email, name, title, message },
  });
}
