const API_BASE_URL = '/backend/api';


export async function apiSendOtp(email, name = 'User', type = 'registration') {
  try {
    const res = await fetch(`${API_BASE_URL}/send_otp.php`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, name, type })
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to send OTP email.');
    }
    return await res.json();
  } catch (error) {
    throw error;
  }
}


export async function apiVerifyOtp(email, otp, type = 'registration') {
  try {
    const res = await fetch(`${API_BASE_URL}/verify_email.php`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, otp, type })
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Invalid verification code.');
    }
    return await res.json();
  } catch (error) {
    throw error;
  }
}


export async function apiSendNotification(email, name, title, message) {
  try {
    const res = await fetch(`${API_BASE_URL}/send_notification.php`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, name, title, message })
    });
    if (!res.ok) {
      throw new Error('Failed to send notification email.');
    }
    return await res.json();
  } catch (error) {
    throw error;
  }
}

export async function apiFetchUsers() {
  try {
    const res = await fetch(`${API_BASE_URL}/users.php`);
    if (!res.ok) return null;
    const data = await res.json();
    return data.users || [];
  } catch (e) {
    console.warn('Failed to fetch users from server database:', e);
    return null;
  }
}

export async function apiSaveUser(userData) {
  try {
    const res = await fetch(`${API_BASE_URL}/users.php`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'create', ...userData })
    });
    return await res.json();
  } catch (e) {
    console.warn('Failed to sync user to database:', e);
    return null;
  }
}

export async function apiUpdateUserStatus(email, action) {
  try {
    const res = await fetch(`${API_BASE_URL}/users.php`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, email })
    });
    return await res.json();
  } catch (e) {
    console.warn('Failed to update user status on server:', e);
    return null;
  }
}
