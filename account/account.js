(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const signedOut = $('signedOutView');
  const accountContent = $('accountContent');
  const signedOutStatus = $('signedOutStatus');
  const accountStatus = $('accountStatus');
  const profileStatus = $('profileStatus');
  const signInButton = $('accountGoogleSignIn');
  const signOutButton = $('accountSignOut');
  const profileForm = $('profileForm');
  const saveButton = $('saveProfile');
  let currentUser = null;
  let busy = false;

  function status(el, message, kind = '') {
    if (!el) return;
    el.textContent = message;
    el.className = 'account-status' + (kind ? ' ' + kind : '');
  }
  function readBool(key, fallback) {
    try { const value = localStorage.getItem(key); return value === null ? fallback : value === 'true'; }
    catch { return fallback; }
  }
  function writeBool(key, value) {
    try { localStorage.setItem(key, String(!!value)); } catch {}
  }
  function render(user) {
    currentUser = user || null;
    signedOut.hidden = !!currentUser;
    accountContent.hidden = !currentUser;
    if (!currentUser) return;
    const name = currentUser.displayName || currentUser.email?.split('@')[0] || 'Ventorea member';
    $('profileHeading').textContent = name;
    $('profileEmailHeading').textContent = currentUser.email || '';
    $('profileAvatar').textContent = (name.trim()[0] || 'V').toUpperCase();
    $('displayName').value = name;
    $('emailAddress').value = currentUser.email || '';
    $('phoneNumber').value = currentUser.phone || '';
    $('profileBio').value = currentUser.bio || '';
    $('rememberChat').checked = readBool('ventorea-remember-ai-chat-v1', true);
    $('reduceMotion').checked = readBool('ventorea-reduce-motion-v1', false);
  }
  async function loadAccount() {
    status(signedOutStatus, 'Checking your sign-in…');
    try {
      const response = await fetch('/api/me', { cache: 'no-store', credentials: 'same-origin' });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        render(null);
        status(signedOutStatus, 'Sign in with Google to access your account.');
        return;
      }
      render(data);
    } catch {
      render(null);
      status(signedOutStatus, 'Account details are temporarily unavailable. Refresh the page to try again.', 'error');
    }
  }
  async function signIn() {
    if (busy) return;
    busy = true;
    signInButton.disabled = true;
    status(signedOutStatus, 'Connecting to Google…');
    window.location.assign('/api/auth/google');
  }
  async function signOut() {
    if (busy) return;
    busy = true;
    signOutButton.disabled = true;
    status(accountStatus, 'Signing out…');
    try {
      const response = await fetch('/api/auth/logout', { method: 'POST', credentials: 'same-origin' });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || 'Could not sign out.');
      render(null);
      status(signedOutStatus, 'You have signed out successfully.', 'success');
    } catch (error) {
      status(accountStatus, error?.message || 'Could not sign out.', 'error');
    } finally {
      busy = false;
      signOutButton.disabled = false;
    }
  }
  async function saveProfile(event) {
    event.preventDefault();
    if (!currentUser || busy) return;
    const displayName = $('displayName').value.trim();
    const phone = $('phoneNumber').value.trim();
    const bio = $('profileBio').value.trim();
    if (!displayName || displayName.length > 80 || bio.length > 280 || phone.length > 40) {
      status(profileStatus, 'Check the display name, phone number and bio lengths.', 'error');
      return;
    }
    busy = true;
    saveButton.disabled = true;
    status(profileStatus, 'Saving your profile…');
    try {
      const response = await fetch('/api/profile', {
        method: 'PUT',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ displayName, phone, bio })
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || 'Could not save your profile.');
      render(data);
      status(profileStatus, 'Profile saved successfully.', 'success');
    } catch (error) {
      status(profileStatus, error?.message || 'Could not save your profile.', 'error');
    } finally {
      busy = false;
      saveButton.disabled = false;
    }
  }

  signInButton.addEventListener('click', signIn);
  signOutButton.addEventListener('click', signOut);
  profileForm.addEventListener('submit', saveProfile);
  $('rememberChat').addEventListener('change', event => writeBool('ventorea-remember-ai-chat-v1', event.target.checked));
  $('reduceMotion').addEventListener('change', event => writeBool('ventorea-reduce-motion-v1', event.target.checked));
  loadAccount();
})();
