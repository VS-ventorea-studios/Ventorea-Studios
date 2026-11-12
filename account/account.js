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
    const name = currentUser.display_name || currentUser.email?.split('@')[0] || 'Ventorea member';
    $('profileHeading').textContent = name;
    $('profileEmailHeading').textContent = currentUser.email || '';
    $('profileAvatar').textContent = (name.trim()[0] || 'V').toUpperCase();
    $('displayName').value = name;
    $('emailAddress').value = currentUser.email || '';
    $('phoneNumber').value = currentUser.phone_number || '';
    $('profileBio').value = currentUser.bio || '';
    $('rememberChat').checked = readBool('ventorea-remember-ai-chat-v1', true);
    $('reduceMotion').checked = readBool('ventorea-reduce-motion-v1', false);
  }
  async function loadSession() {
    const response = await fetch('/api/auth/session', { credentials: 'same-origin', cache: 'no-store' });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || 'Could not check your account session.');
    render(data.user || null);
    return currentUser;
  }
  function signIn() {
    if (busy) return;
    busy = true;
    signInButton.disabled = true;
    status(signedOutStatus, 'Connecting to Google…');
    window.location.assign('/api/auth/google/start');
  }
  async function signOut() {
    if (busy) return;
    busy = true;
    signOutButton.disabled = true;
    status(accountStatus, 'Signing out…');
    try {
      const response = await fetch('/api/auth/logout', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' }
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || 'Could not sign out.');
      render(null);
      status(signedOutStatus, 'You have signed out successfully.', 'success');
    } catch (error) {
      status(accountStatus, error.message || 'Could not sign out.', 'error');
    } finally {
      busy = false;
      signOutButton.disabled = false;
    }
  }
  async function saveProfile(event) {
    event.preventDefault();
    if (!currentUser || busy) return;
    const displayName = $('displayName').value.trim();
    if (!displayName) {
      status(profileStatus, 'Enter a display name first.', 'error');
      return;
    }
    busy = true;
    saveButton.disabled = true;
    status(profileStatus, 'Saving your profile…');
    try {
      const response = await fetch('/api/account/profile', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          displayName,
          phone: $('phoneNumber').value.trim(),
          bio: $('profileBio').value.trim()
        })
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || 'Could not save your profile.');
      render(data.user || currentUser);
      status(profileStatus, 'Profile saved successfully.', 'success');
    } catch (error) {
      status(profileStatus, error.message || 'Could not save your profile.', 'error');
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

  const params = new URLSearchParams(window.location.search);
  const authError = params.get('auth_error');
  if (authError) {
    const messages = {
      google_not_configured: 'Google sign-in is not configured yet. Please try again later.',
      state_invalid: 'Your sign-in session expired. Start again in this browser.',
      google_denied: 'Google sign-in was cancelled.',
      missing_code: 'Google did not return an authorization code. Try again.',
      token_exchange_failed: 'Google could not complete sign-in. Try again.',
      google_identity_unverified: 'Google could not verify this email address.',
      server_not_configured: 'The account service is still being configured.',
      sign_in_failed: 'Google sign-in failed. Please try again.'
    };
    status(signedOutStatus, messages[authError] || 'Google sign-in failed. Please try again.', 'error');
    params.delete('auth_error');
    window.history.replaceState(null, document.title, window.location.pathname + (params.toString() ? '?' + params.toString() : ''));
  }
  if (params.get('signed_in') === '1') {
    params.delete('signed_in');
    window.history.replaceState(null, document.title, window.location.pathname + (params.toString() ? '?' + params.toString() : ''));
  }

  if (!authError) status(signedOutStatus, 'Checking your sign-in…');
  loadSession().then(user => {
    if (!user && !authError) status(signedOutStatus, 'Sign in with Google to manage your account.');
    else if (user) status(accountStatus, 'Signed in successfully.', 'success');
  }).catch(error => {
    render(null);
    status(signedOutStatus, error.message || 'Could not check your session. Refresh and try again.', 'error');
  });
})();
