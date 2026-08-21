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
