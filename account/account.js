(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const SUPABASE_URL = 'https://ujxcvfgkpqzkpfthahla.supabase.co';
  const SUPABASE_KEY = 'sb_publishable_BeuJ8qa-4oBzWcijNNPGKA_j-wSf3Uq';
  const signedOut = $('signedOutView');
  const accountContent = $('accountContent');
  const signedOutStatus = $('signedOutStatus');
  const accountStatus = $('accountStatus');
  const profileStatus = $('profileStatus');
  const signInButton = $('accountGoogleSignIn');
  const signOutButton = $('accountSignOut');
  const profileForm = $('profileForm');
  const saveButton = $('saveProfile');
  let client = null;
  let currentUser = null;
  let busy = false;
  const avatarInput = $('avatarFile');
  const removeAvatarButton = $('removeAvatar');
  const avatarPreview = $('avatarUploadPreview');
  const profileAvatar = $('profileAvatar');
  const AVATAR_BUCKET = 'ventorea-avatars';
  const MAX_AVATAR_SIZE = 3 * 1024 * 1024;
  const AVATAR_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

  function status(el, message, kind = '') {
    if (!el) return;
    el.textContent = message;
    el.className = 'account-status' + (kind ? ' ' + kind : '');
  }
  function displayName(user) {
    const meta = user?.user_metadata || {};
    return meta.display_name || meta.full_name || meta.name || user?.email?.split('@')[0] || 'Ventorea member';
  }
  function render(user) {
    currentUser = user || null;
    signedOut.hidden = !!currentUser;
    accountContent.hidden = !currentUser;
    if (!currentUser) return;
    const name = displayName(currentUser);
    $('profileHeading').textContent = name;
    $('profileEmailHeading').textContent = currentUser.email || '';
    const avatarUrl = currentUser.user_metadata?.avatar_url || '';
    renderAvatar(profileAvatar, avatarUrl, name);
    renderAvatar(avatarPreview, avatarUrl, name);
    if (removeAvatarButton) removeAvatarButton.hidden = !avatarUrl;
    $('displayName').value = name;
    $('emailAddress').value = currentUser.email || '';
    $('phoneNumber').value = currentUser.user_metadata?.phone_number || '';
    $('profileBio').value = currentUser.user_metadata?.bio || '';
    $('rememberChat').checked = readBool('ventorea-remember-ai-chat-v1', true);
    $('reduceMotion').checked = readBool('ventorea-reduce-motion-v1', false);
  }

  function renderAvatar(target, url, name) {
    if (!target) return;
    target.replaceChildren();
    if (url) {
      const image = document.createElement('img');
      image.src = url;
      image.alt = 'Profile picture';
      image.referrerPolicy = 'no-referrer';
      target.appendChild(image);
    } else {
      target.textContent = (name?.trim()?.[0] || 'V').toUpperCase();
    }
  }
  function setAvatarBusy(value) {
    if (avatarInput) avatarInput.disabled = value;
    if (removeAvatarButton) removeAvatarButton.disabled = value;
  }
  async function saveAvatarUrl(url) {
    const { data, error } = await client.auth.updateUser({
      data: { ...(currentUser.user_metadata || {}), avatar_url: url || null }
    });
    if (error) throw error;
    currentUser = data.user || currentUser;
    const { error: profileError } = await client.from('profiles')
      .update({ avatar_url: url || null, updated_at: new Date().toISOString() })
      .eq('user_id', currentUser.id);
    if (profileError) throw profileError;
    render(currentUser);
  }
  async function uploadAvatar(file) {
    if (!client || !currentUser || busy) return;
    if (!file || !AVATAR_TYPES.has(file.type)) {
      status(profileStatus, 'Choose a JPG, PNG or WEBP image.', 'error');
      return;
    }
    if (file.size > MAX_AVATAR_SIZE) {
      status(profileStatus, 'Your profile picture must be 3 MB or smaller.', 'error');
      return;
    }
    busy = true;
    setAvatarBusy(true);
    status(profileStatus, 'Uploading your profile picture…');
    try {
      const extension = file.type === 'image/jpeg' ? 'jpg' : file.type === 'image/png' ? 'png' : 'webp';
      const path = currentUser.id + '/avatar.' + extension;
      const { error: uploadError } = await client.storage.from(AVATAR_BUCKET).upload(path, file, {
        cacheControl: '3600',
        contentType: file.type,
        upsert: true
      });
      if (uploadError) throw uploadError;
      const { data } = client.storage.from(AVATAR_BUCKET).getPublicUrl(path);
      const url = data?.publicUrl ? data.publicUrl + '?v=' + Date.now() : '';
      if (!url) throw new Error('The uploaded image URL could not be created.');
      await saveAvatarUrl(url);
      status(profileStatus, 'Profile picture updated successfully.', 'success');
    } catch (error) {
      status(profileStatus, error?.message || 'Could not upload your profile picture.', 'error');
    } finally {
      busy = false;
      setAvatarBusy(false);
      if (avatarInput) avatarInput.value = '';
    }
  }
  async function removeAvatar() {
    if (!client || !currentUser || busy) return;
    busy = true;
    setAvatarBusy(true);
    status(profileStatus, 'Removing your profile picture…');
    try {
      const oldUrl = currentUser.user_metadata?.avatar_url || '';
      await saveAvatarUrl('');
      if (oldUrl.includes('/storage/v1/object/public/' + AVATAR_BUCKET + '/')) {
        const path = oldUrl.split('/storage/v1/object/public/' + AVATAR_BUCKET + '/')[1].split('?')[0];
        if (path.startsWith(currentUser.id + '/')) {
          const { error } = await client.storage.from(AVATAR_BUCKET).remove([decodeURIComponent(path)]);
          if (error) console.warn('Old profile picture cleanup failed:', error.message);
        }
      }
      status(profileStatus, 'Profile picture removed.', 'success');
    } catch (error) {
      status(profileStatus, error?.message || 'Could not remove your profile picture.', 'error');
    } finally {
      busy = false;
      setAvatarBusy(false);
    }
  }

  function readBool(key, fallback) {
    try { const v = localStorage.getItem(key); return v === null ? fallback : v === 'true'; }
    catch { return fallback; }
  }
  function writeBool(key, value) {
    try { localStorage.setItem(key, String(!!value)); }
    catch { /* Private browsing can block storage. */ }
  }
  async function signIn(provider) {
    if (provider !== 'google') return;
    window.location.href = '/login/';
    return;
    if (!client || busy) return;
    busy = true;
    const buttons = [signInButton, $('accountAppleSignIn'), $('accountFacebookSignIn')].filter(Boolean);
    buttons.forEach(button => { button.disabled = true; });
    const providerName = provider === 'google' ? 'Google' : provider === 'apple' ? 'Apple' : 'Facebook';
    status(signedOutStatus, 'Connecting to ' + providerName + '…');
    try {
      const { error } = await client.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo: window.location.origin + '/account/',
          ...(provider === 'google' ? { queryParams: { prompt: 'select_account' } } : {})
        }
      });
      if (error) throw error;
      status(signedOutStatus, 'Opening ' + providerName + ' sign-in…');
    } catch (error) {
      const message = error?.message || 'Could not start ' + providerName + ' sign-in.';
      status(signedOutStatus, /provider is not enabled|unsupported provider|provider.*disabled/i.test(message)
        ? providerName + ' sign-in is not enabled in the authentication settings yet. The studio needs to configure this provider first.'
        : message, 'error');
      busy = false;
      buttons.forEach(button => { button.disabled = false; });
    }
  }
  async function signOut() {
    if (!client || busy) return;
    busy = true;
    signOutButton.disabled = true;
    status(accountStatus, 'Signing out…');
    try {
      const { error } = await client.auth.signOut();
      if (error) throw error;
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
    if (!client || !currentUser || busy) return;
    const name = $('displayName').value.trim();
    if (!name) {
      status(profileStatus, 'Enter a display name first.', 'error');
      return;
    }
    busy = true;
    saveButton.disabled = true;
    status(profileStatus, 'Saving your profile…');
    try {
      const { data, error } = await client.auth.updateUser({
        data: {
          display_name: name,
          phone_number: $('phoneNumber').value.trim(),
          bio: $('profileBio').value.trim()
        }
      });
      if (error) throw error;
      currentUser = data.user || currentUser;
      render(currentUser);
      status(profileStatus, 'Profile saved successfully.', 'success');
    } catch (error) {
      status(profileStatus, error?.message || 'Could not save your profile.', 'error');
    } finally {
      busy = false;
      saveButton.disabled = false;
    }
  }
  signInButton.addEventListener('click', () => signIn('google'));
  $('accountAppleSignIn')?.addEventListener('click', () => signIn('apple'));
  $('accountFacebookSignIn')?.addEventListener('click', () => signIn('facebook'));
  signOutButton.addEventListener('click', signOut);
  profileForm.addEventListener('submit', saveProfile);
  avatarInput?.addEventListener('change', event => uploadAvatar(event.target.files?.[0]));
  removeAvatarButton?.addEventListener('click', removeAvatar);
  $('rememberChat').addEventListener('change', event => writeBool('ventorea-remember-ai-chat-v1', event.target.checked));
  $('reduceMotion').addEventListener('change', event => writeBool('ventorea-reduce-motion-v1', event.target.checked));

  signedOut.hidden = false;
  status(signedOutStatus, 'Checking your sign-in…');
  if (!window.supabase || SUPABASE_KEY.startsWith('PASTE_')) {
    status(signedOutStatus, 'Account sign-in is not configured. Please contact the studio.', 'error');
    return;
  }
  client = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY, {
    auth: { flowType: 'pkce', detectSessionInUrl: true, persistSession: true, autoRefreshToken: true }
  });
  client.auth.getSession().then(({ data, error }) => {
    if (error) throw error;
    render(data?.session?.user || null);
    if (!data?.session?.user) status(signedOutStatus, 'Continue with Google to sign in, then return here to manage your profile.');
  }).catch(error => {
    render(null);
    status(signedOutStatus, error?.message || 'Could not check your session. Refresh the page and try again.', 'error');
  });
  client.auth.onAuthStateChange((_event, session) => {
    render(session?.user || null);
    if (session?.user) status(accountStatus, 'Signed in successfully.', 'success');
  });
})();