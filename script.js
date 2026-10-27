const menu=document.getElementById('menu');
const nav=document.getElementById('navLinks');
if(menu&&nav){
  menu.setAttribute('aria-expanded','false');
  const closeMenu=()=>{nav.classList.remove('open');menu.setAttribute('aria-expanded','false');menu.setAttribute('aria-label','Open menu')};
  menu.addEventListener('click',()=>{
    const open=!nav.classList.contains('open');
    nav.classList.toggle('open',open);
    menu.setAttribute('aria-expanded',String(open));
    menu.setAttribute('aria-label',open?'Close menu':'Open menu');
  });
  nav.querySelectorAll('a').forEach(a=>a.addEventListener('click',closeMenu));
  nav.querySelectorAll('button').forEach(button=>button.addEventListener('click',()=>{
    if(button.id==='aiMenuOpen')closeMenu();
  }));
  document.addEventListener('click',event=>{
    if(!nav.classList.contains('open'))return;
    if(!nav.contains(event.target)&&!menu.contains(event.target))closeMenu();
  });
  window.addEventListener('resize',()=>{if(window.innerWidth>680)closeMenu()},{passive:true});
  document.querySelectorAll('#navLinks a').forEach(a=>a.addEventListener('click',()=>{
    nav.classList.remove('open');menu.setAttribute('aria-expanded','false');menu.setAttribute('aria-label','Open menu');
  }));
}

const AI_ENDPOINT='https://ventorea-studios.vercel.app/api/chat';
const $=id=>document.getElementById(id);
const launcher=$('aiMenuOpen'),mobileLauncher=$('aiMobileOpen'),panel=$('aiPanel'),close=$('aiClose'),messages=$('aiMessages'),form=$('aiForm'),input=$('aiInput'),unreadBadge=$('aiUnread'),presenceText=$('aiPresenceText'),presenceDot=$('aiPresenceDot'),menuPresence=$('aiMenuStatus');
const accountOpen=$('accountOpen');
const cookieNotice=$('cookieNotice');
const REMEMBER_EMAIL_COOKIE='ventorea-remembered-email';
function readRememberedEmail(){
  try{
    const prefix=REMEMBER_EMAIL_COOKIE+'=';
    const item=document.cookie.split(';').map(part=>part.trim()).find(part=>part.startsWith(prefix));
    return item?decodeURIComponent(item.slice(prefix.length)):'';
  }catch{return ''}
}
function writeRememberedEmail(email){
  try{
    const value=(email||'').trim();
    const secure=location.protocol==='https:'?'; Secure':'';
    document.cookie=REMEMBER_EMAIL_COOKIE+'='+encodeURIComponent(value)+'; Max-Age='+(value?2592000:0)+'; Path=/; SameSite=Lax'+secure;
  }catch{}
}
function clearRememberedEmail(){writeRememberedEmail('')}
const CHAT_STORAGE_KEY='ventorea-ai-chat-history-v1';
const REMEMBER_CHAT_KEY='ventorea-remember-ai-chat-v1';
const REDUCE_MOTION_KEY='ventorea-reduce-motion-v1';
const MAX_HISTORY=12;const MAX_MESSAGE_LENGTH=2000;
const chat=loadChatHistory();
function readSetting(key,fallback){try{const value=localStorage.getItem(key);return value===null?fallback:value==='true'}catch{return fallback}}
function loadChatHistory(){
  if(!readSetting(REMEMBER_CHAT_KEY,true))return [];
  try{const saved=JSON.parse(localStorage.getItem(CHAT_STORAGE_KEY)||'[]');return Array.isArray(saved)?saved.filter(m=>m&&['user','assistant'].includes(m.role)&&typeof m.content==='string').slice(-MAX_HISTORY):[]}catch{return []}
}
function saveChatHistory(){try{if(readSetting(REMEMBER_CHAT_KEY,true))localStorage.setItem(CHAT_STORAGE_KEY,JSON.stringify(chat.slice(-MAX_HISTORY)));else localStorage.removeItem(CHAT_STORAGE_KEY)}catch{}}
function applyMotionSetting(){document.body.classList.toggle('reduce-motion',readSetting(REDUCE_MOTION_KEY,false))}
function renderSavedChat(){
  if(!messages)return;
  messages.replaceChildren();
  add("Hey there. I’m Ventorea AI. Ask me about the studio, RSL, our systems or development progress.",'bot');
  chat.forEach(m=>add(m.content,m.role==='user'?'user':'bot'));
}

let unreadCount=0,sessionStartedAt=Date.now(),serviceOnline=false;

function isDemoSignedIn(){return !!googleUser}
function updateAccountUI(){
  const signed=!!googleUser;
  if(accountOpen){accountOpen.innerHTML=signed?'MY ACCOUNT <span>↗</span>':'SIGN IN <span>↗</span>';accountOpen.setAttribute('aria-label',signed?'Open account settings':'Sign in with Google')}
  if(input){input.disabled=!signed;input.placeholder=signed?'Message Ventorea AI…':'Sign in with Google to use Ventorea AI'}
  if(signed)populateAccountSettings();
  updateLoginPage();
}
function showModal(el){if(!el)return;el.classList.add('open');el.setAttribute('aria-hidden','false');document.body.classList.add('modal-open')}
function hideModal(el){if(!el)return;el.classList.remove('open');el.setAttribute('aria-hidden','true');document.body.classList.toggle('modal-open',!!document.querySelector('.modal.open'))}
function aiOpen(){if(!isDemoSignedIn()){openGoogleLogin();if(googleLoginStatus){googleLoginStatus.textContent='Sign in with Google to unlock Ventorea AI.';googleLoginStatus.className='form-status error'}return}renderSavedChat();document.body.classList.add('ai-chat-open');panel?.classList.add('open');panel?.setAttribute('aria-hidden','false');launcher?.setAttribute('aria-expanded','true');mobileLauncher?.setAttribute('aria-expanded','true');setUnread(0);setTimeout(()=>input?.focus({preventScroll:true}),180)}
function aiClose(){document.body.classList.remove('ai-chat-open');panel?.classList.remove('open');panel?.setAttribute('aria-hidden','true');launcher?.setAttribute('aria-expanded','false');mobileLauncher?.setAttribute('aria-expanded','false');if(window.matchMedia('(max-width: 680px)').matches)mobileLauncher?.focus();else launcher?.focus()}
function setUnread(count){unreadCount=Math.max(0,count);if(unreadBadge){unreadBadge.hidden=unreadCount===0;unreadBadge.textContent=unreadCount>9?'9+':String(unreadCount)}if(launcher)launcher.setAttribute('aria-label',unreadCount?('Open Ventorea AI, '+unreadCount+' unread messages'):'Open Ventorea AI')}
function setPresence(online,label){if(presenceText)presenceText.textContent=label;if(presenceDot){presenceDot.classList.toggle('is-online',online);presenceDot.classList.toggle('is-offline',!online)}if(menuPresence){menuPresence.textContent=online?'ONLINE':'OFFLINE';menuPresence.classList.toggle('is-online',online);menuPresence.classList.toggle('is-offline',!online)}}
function duration(ms){const sec=Math.max(0,Math.floor(ms/1000)),h=Math.floor(sec/3600),m=Math.floor((sec%3600)/60),s=sec%60;return h?String(h).padStart(2,'0')+':'+String(m).padStart(2,'0')+':'+String(s).padStart(2,'0'):String(m).padStart(2,'0')+':'+String(s).padStart(2,'0')}
async function checkPresence(){
  try{const response=await fetch(AI_ENDPOINT,{method:'GET',cache:'no-store'});const data=await response.json().catch(()=>({}));serviceOnline=response.ok&&data.ok===true&&data.keyConfigured===true;const needsSetup=response.ok&&data.ok===true&&data.keyConfigured===false;setPresence(serviceOnline,serviceOnline?'Online · active '+duration(Date.now()-sessionStartedAt):needsSetup?'Setup needed':'Offline · active '+duration(Date.now()-sessionStartedAt));if(needsSetup&&presenceText)presenceText.title='The server needs its AI API key configured.'}
  catch{serviceOnline=false;setPresence(false,'Offline · active '+duration(Date.now()-sessionStartedAt))}
}
renderSavedChat();
if(launcher){launcher.setAttribute('aria-controls','aiPanel');launcher.setAttribute('aria-expanded','false');launcher.onclick=()=>panel?.classList.contains('open')?aiClose():aiOpen()}
if(mobileLauncher){mobileLauncher.setAttribute('aria-controls','aiPanel');mobileLauncher.setAttribute('aria-expanded','false');mobileLauncher.onclick=()=>panel?.classList.contains('open')?aiClose():aiOpen()}
close?.addEventListener('click',aiClose);
const SUPABASE_URL='https://ujxcvfgkpqzkpfthahla.supabase.co';
const SUPABASE_PUBLISHABLE_KEY='sb_publishable_BeuJ8qa-4oBzWcijNNPGKA_j-wSf3Uq';
let supabaseClient=null,googleUser=null;
const googleLoginModal=$('googleLoginModal'),googleLoginStatus=$('googleLoginStatus'),googleLoginButton=$('googleLoginButton'),googleSignOutButton=$('googleSignOutButton');
function updateLoginPage(){
 const formContent=$('loginFormContent'),signedInPanel=$('loginSignedIn');
 if(!formContent||!signedInPanel)return;
 const signed=!!googleUser;
 formContent.hidden=signed;
 signedInPanel.hidden=!signed;
 const email=$('loginSignedInEmail');
 if(email)email.textContent=googleUser?.email||'Your Ventorea account is signed in.';
}
function openGoogleLogin(){
 showModal(googleLoginModal);
 refreshGoogleAccount();
 // Prevent iOS Safari from scrolling the page when focus is applied to the login button.
 if(!window.matchMedia('(pointer: coarse)').matches)setTimeout(()=>googleLoginButton?.focus({preventScroll:true}),80);
}
function refreshGoogleAccount(){
 if(!googleLoginStatus){updateLoginPage();return}
 if(!window.supabase||SUPABASE_PUBLISHABLE_KEY==='PASTE_YOUR_SUPABASE_PUBLISHABLE_KEY_HERE'){googleLoginStatus.textContent='Setup needed: add your Supabase publishable key in script.js before testing login.';googleLoginStatus.className='form-status error';updateLoginPage();return}
 if(googleUser){googleLoginStatus.textContent='Signed in as '+(googleUser.email||googleUser.user_metadata?.full_name||'Google user')+'.';googleLoginStatus.className='form-status success';if(googleLoginButton)googleLoginButton.hidden=true;if(googleSignOutButton)googleSignOutButton.hidden=false}
 else{googleLoginStatus.textContent='Choose Google to securely sign in to Ventorea Studios.';googleLoginStatus.className='form-status';if(googleLoginButton)googleLoginButton.hidden=false;if(googleSignOutButton)googleSignOutButton.hidden=true}
 updateLoginPage();
}
if(window.supabase&&SUPABASE_PUBLISHABLE_KEY!=='PASTE_YOUR_SUPABASE_PUBLISHABLE_KEY_HERE'){
 supabaseClient=window.supabase.createClient(SUPABASE_URL,SUPABASE_PUBLISHABLE_KEY);
 supabaseClient.auth.getSession().then(({data,error})=>{if(error)console.error('Supabase session restore failed:',error);googleUser=data?.session?.user||null;refreshGoogleAccount();updateAccountUI()}).catch(error=>console.error('Supabase session restore failed:',error));
 supabaseClient.auth.onAuthStateChange((event,session)=>{
  googleUser=session?.user||null;
  refreshGoogleAccount();
  updateAccountUI();
  if(googleUser&&googleLoginStatus){
    googleLoginStatus.textContent='Signed in as '+(googleUser.email||'Google user')+'. Your profile is available from My Account.';
    googleLoginStatus.className='form-status success';
  }
  // Do not automatically open Account Settings after OAuth. It caused a page jump
  // and made sign-in look frozen while profile/friend data loaded on mobile.
});
}
const accountSettingsModal=$('accountSettingsModal');
const accountProfileForm=$('accountProfileForm');
const accountDisplayName=$('accountDisplayName');
const accountEmail=$('accountEmail');
const accountPhone=$('accountPhone');
const accountBio=$('accountBio');
const accountIdentityName=$('accountIdentityName');
const accountIdentityEmail=$('accountIdentityEmail');
const accountAvatar=$('accountAvatar');
const accountProfileStatus=$('accountProfileStatus');
const settingsStatus=$('settingsStatus');
const rememberChatSetting=$('rememberChatSetting');
const reduceMotionSetting=$('reduceMotionSetting');
function displayNameFor(user){return user?.user_metadata?.display_name||user?.user_metadata?.full_name||user?.user_metadata?.name||user?.email?.split('@')[0]||'Ventorea member'}
function populateAccountSettings(){
 if(!googleUser)return;
 const name=displayNameFor(googleUser),email=googleUser.email||'';
 if(accountDisplayName&&document.activeElement!==accountDisplayName)accountDisplayName.value=name;
 if(accountEmail)accountEmail.value=email;
 if(accountPhone&&document.activeElement!==accountPhone)accountPhone.value=googleUser.user_metadata?.phone_number||'';
 if(accountBio&&document.activeElement!==accountBio)accountBio.value=googleUser.user_metadata?.bio||'';
 if(accountIdentityName)accountIdentityName.textContent=name;
 if(accountIdentityEmail)accountIdentityEmail.textContent=email;
 if(accountAvatar)accountAvatar.textContent=(name.trim()[0]||'V').toUpperCase();
 if(rememberChatSetting)rememberChatSetting.checked=readSetting(REMEMBER_CHAT_KEY,true);
 if(reduceMotionSetting)reduceMotionSetting.checked=readSetting(REDUCE_MOTION_KEY,false);
}
function openAccountSettings(){
 if(!googleUser){openGoogleLogin();return}
 populateAccountSettings();showModal(accountSettingsModal);loadFriends();
}
accountOpen?.addEventListener('click',()=>googleUser?openAccountSettings():window.location.assign(new URL('/login.html',window.location.origin).href));
$('accountSettingsClose')?.addEventListener('click',()=>hideModal(accountSettingsModal));
accountSettingsModal?.addEventListener('click',e=>{if(e.target===accountSettingsModal)hideModal(accountSettingsModal)});
accountProfileForm?.addEventListener('submit',async e=>{
 e.preventDefault();if(!supabaseClient||!googleUser)return;
 const name=accountDisplayName.value.trim();
 if(!name){accountProfileStatus.textContent='Please enter a display name.';accountProfileStatus.className='form-status error';return}
 const save=$('accountSaveProfile');if(save)save.disabled=true;
 accountProfileStatus.textContent='Saving profile…';accountProfileStatus.className='form-status';
 try{
  const phone=accountPhone?.value.trim()||'';
 const bio=accountBio?.value.trim()||'';
 const {data,error}=await supabaseClient.auth.updateUser({data:{display_name:name,phone_number:phone,bio,profile_setup_complete:true}});
  if(error)throw error;
  googleUser=data.user||googleUser;populateAccountSettings();updateAccountUI();try{await ensurePublicProfile()}catch(profileError){console.warn('Friends profile setup is not complete:',profileError)}
  accountProfileStatus.textContent='Profile saved successfully.';accountProfileStatus.className='form-status success';
 }catch(error){accountProfileStatus.textContent=error?.message||'Could not save your profile.';accountProfileStatus.className='form-status error'}
 finally{if(save)save.disabled=false}
});

const accountFriendCode=$('accountFriendCode'),friendCodeInput=$('friendCodeInput'),friendsStatus=$('friendsStatus'),friendRequestsList=$('friendRequestsList'),friendsList=$('friendsList');
function setFriendsStatus(message,kind=''){if(friendsStatus){friendsStatus.textContent=message;friendsStatus.className='form-status'+(kind?' '+kind:'')}}
function makeFriendCode(){return 'VENT-'+Math.random().toString(36).slice(2,8).toUpperCase()}
function safeText(tag,text,className){const el=document.createElement(tag);el.textContent=text;if(className)el.className=className;return el}
async function ensurePublicProfile(){
 if(!supabaseClient||!googleUser)return;
 const user=googleUser;let code='';
 const {data:existing,error:readError}=await supabaseClient.from('profiles').select('friend_code').eq('user_id',user.id).maybeSingle();
 if(readError)throw readError;
 code=existing?.friend_code||makeFriendCode();
 const {error}=await supabaseClient.from('profiles').upsert({user_id:user.id,display_name:displayNameFor(user),bio:user.user_metadata?.bio||'',friend_code:code,updated_at:new Date().toISOString()},{onConflict:'user_id'});
 if(error)throw error;
 if(accountFriendCode)accountFriendCode.value=code;
}
async function loadFriends(){
 if(!supabaseClient||!googleUser)return;
 if(friendRequestsList)friendRequestsList.replaceChildren(safeText('p','Loading requests…','settings-help'));
 if(friendsList)friendsList.replaceChildren(safeText('p','Loading friends…','settings-help'));
 try{
  await ensurePublicProfile();
  const {data:requests,error:reqError}=await supabaseClient.from('friend_requests').select('id,sender_id,receiver_id,status,created_at,sender:profiles!friend_requests_sender_id_fkey(display_name,friend_code),receiver:profiles!friend_requests_receiver_id_fkey(display_name,friend_code)').eq('receiver_id',googleUser.id).eq('status','pending').order('created_at',{ascending:false});
  if(reqError)throw reqError;
  if(friendRequestsList){friendRequestsList.replaceChildren();if(!requests?.length)friendRequestsList.append(safeText('p','No pending requests.','settings-help'));for(const request of requests){const row=document.createElement('div');row.className='friend-row';const info=document.createElement('div');info.append(safeText('b',request.sender?.display_name||'Ventorea member'),safeText('small',request.sender?.friend_code||''));const accept=document.createElement('button');accept.type='button';accept.className='button button-bright';accept.textContent='ACCEPT';accept.addEventListener('click',()=>acceptFriendRequest(request));row.append(info,accept);friendRequestsList.append(row)}}
  const {data:links,error:linkError}=await supabaseClient.from('friendships').select('friend_id,friend:profiles!friendships_friend_id_fkey(display_name,friend_code,bio)').eq('user_id',googleUser.id).order('created_at',{ascending:false});
  if(linkError)throw linkError;
  if(friendsList){friendsList.replaceChildren();if(!links?.length)friendsList.append(safeText('p','No friends yet. Add someone using their friend code.','settings-help'));for(const link of links){const row=document.createElement('div');row.className='friend-row';const info=document.createElement('div');info.append(safeText('b',link.friend?.display_name||'Ventorea member'),safeText('small',link.friend?.friend_code||''));const remove=document.createElement('button');remove.type='button';remove.className='button button-outline';remove.textContent='REMOVE';remove.addEventListener('click',()=>removeFriend(link.friend_id));row.append(info,remove);friendsList.append(row)}}
 }catch(error){const msg=error?.code==='42P01'||String(error?.message||'').includes('schema cache')?'Friends need database setup first. Run supabase/schema.sql in your Supabase SQL Editor, then reload.':(error?.message||'Could not load friends.');if(friendRequestsList)friendRequestsList.replaceChildren(safeText('p',msg,'settings-help'));if(friendsList)friendsList.replaceChildren(safeText('p',msg,'settings-help'));if(accountFriendCode)accountFriendCode.value='Set up required';}
}
async function sendFriendRequest(e){
 e.preventDefault();if(!supabaseClient||!googleUser)return;
 const code=friendCodeInput?.value.trim().toUpperCase();if(!code)return;
 const button=$('addFriendButton');if(button)button.disabled=true;setFriendsStatus('Looking up friend code…');
 try{
  await ensurePublicProfile();
  const {data:profile,error}=await supabaseClient.from('profiles').select('user_id,display_name').eq('friend_code',code).maybeSingle();
  if(error)throw error;if(!profile)throw new Error('That friend code was not found.');
  if(profile.user_id===googleUser.id)throw new Error('You cannot add yourself.');
  const {data:existing,error:existingError}=await supabaseClient.from('friendships').select('friend_id').eq('user_id',googleUser.id).eq('friend_id',profile.user_id).maybeSingle();
  if(existingError)throw existingError;if(existing)throw new Error('You are already friends.');
  const {error:insertError}=await supabaseClient.from('friend_requests').insert({sender_id:googleUser.id,receiver_id:profile.user_id,status:'pending'});
  if(insertError){if(insertError.code==='23505')throw new Error('You already sent a request to this person.');throw insertError}
  if(friendCodeInput)friendCodeInput.value='';setFriendsStatus('Friend request sent to '+profile.display_name+'.','success');
 }catch(error){setFriendsStatus(error?.message||'Could not send friend request.','error')}
 finally{if(button)button.disabled=false}
}
async function acceptFriendRequest(request){
 try{
  const {error:updateError}=await supabaseClient.from('friend_requests').update({status:'accepted'}).eq('id',request.id).eq('receiver_id',googleUser.id);
  if(updateError)throw updateError;
  const rows=[{user_id:googleUser.id,friend_id:request.sender_id},{user_id:request.sender_id,friend_id:googleUser.id}];
  const {error:insertError}=await supabaseClient.from('friendships').insert(rows);
  if(insertError&&insertError.code!=='23505')throw insertError;setFriendsStatus('Friend added.','success');await loadFriends();
 }catch(error){setFriendsStatus(error?.message||'Could not accept request.','error')}
}
async function removeFriend(friendId){
 if(!confirm('Remove this friend?'))return;
 try{const {error}=await supabaseClient.from('friendships').delete().eq('user_id',googleUser.id).eq('friend_id',friendId);if(error)throw error;await supabaseClient.from('friendships').delete().eq('user_id',friendId).eq('friend_id',googleUser.id);setFriendsStatus('Friend removed.','success');await loadFriends()}catch(error){setFriendsStatus(error?.message||'Could not remove friend.','error')}
}
$('addFriendForm')?.addEventListener('submit',sendFriendRequest);
$('copyFriendCode')?.addEventListener('click',async()=>{try{await navigator.clipboard.writeText(accountFriendCode?.value||'');setFriendsStatus('Friend code copied.','success')}catch{setFriendsStatus('Copy failed. Select the code and copy it manually.','error')}});

rememberChatSetting?.addEventListener('change',()=>{
 try{localStorage.setItem(REMEMBER_CHAT_KEY,String(rememberChatSetting.checked));if(!rememberChatSetting.checked)localStorage.removeItem(CHAT_STORAGE_KEY);else saveChatHistory();settingsStatus.textContent=rememberChatSetting.checked?'AI chat history will be saved on this device.':'AI chat history will not be saved on this device.';settingsStatus.className='form-status success'}catch{settingsStatus.textContent='Your browser blocked this setting.';settingsStatus.className='form-status error'}
});
reduceMotionSetting?.addEventListener('change',()=>{
 try{localStorage.setItem(REDUCE_MOTION_KEY,String(reduceMotionSetting.checked));applyMotionSetting();settingsStatus.textContent='Motion preference updated.';settingsStatus.className='form-status success'}catch{settingsStatus.textContent='Your browser blocked this setting.';settingsStatus.className='form-status error'}
});
$('clearChatButton')?.addEventListener('click',()=>{
 chat.length=0;try{localStorage.removeItem(CHAT_STORAGE_KEY)}catch{};renderSavedChat();settingsStatus.textContent='Saved AI chat history cleared from this device.';settingsStatus.className='form-status success'
});
$('accountSignOutButton')?.addEventListener('click',async()=>{
 if(!supabaseClient)return;
 const signout=$('accountSignOutButton');if(signout)signout.disabled=true;
 try{const {error}=await supabaseClient.auth.signOut();if(error)throw error;googleUser=null;chat.length=0;try{localStorage.removeItem(CHAT_STORAGE_KEY)}catch{};hideModal(accountSettingsModal);refreshGoogleAccount();updateAccountUI()}
 catch(error){settingsStatus.textContent=error?.message||'Could not sign out.';settingsStatus.className='form-status error'}
 finally{if(signout)signout.disabled=false}
});
$('googleLoginClose')?.addEventListener('click',()=>hideModal(googleLoginModal));
googleLoginModal?.addEventListener('click',e=>{if(e.target===googleLoginModal)hideModal(googleLoginModal)});
let googleOAuthPending=false;
googleLoginButton?.addEventListener('click',async()=>{
 if(googleOAuthPending)return;
 if(!supabaseClient){refreshGoogleAccount();return}
 googleOAuthPending=true;
 googleLoginButton.disabled=true;
 googleLoginStatus.textContent='Connecting to Google securely…';
 googleLoginStatus.className='form-status';
 try {
  // Let Supabase perform its native top-level redirect. This is more reliable
  // than manually navigating to a URL after an awaited request in mobile Safari.
  const {error}=await supabaseClient.auth.signInWithOAuth({
   provider:'google',
   options:{redirectTo:window.location.origin+'/',queryParams:{prompt:'select_account'}}
  });
  if(error)throw error;
  window.setTimeout(()=>{
   googleOAuthPending=false;
   if(googleLoginButton)googleLoginButton.disabled=false;
   if(googleLoginStatus&&(!googleLoginModal||googleLoginModal.classList.contains('open'))){
    googleLoginStatus.textContent='Google sign-in did not open. Please try again. If the problem continues, contact Ventorea support.';
    googleLoginStatus.className='form-status error';
   }
  },12000);
 } catch(error) {
  googleOAuthPending=false;
  googleLoginStatus.textContent=error?.message||'Google sign-in could not be started. Please try again.';
  googleLoginStatus.className='form-status error';
  googleLoginButton.disabled=false;
 }
});
function initLoginPage(){
 const signInForm=$('authSignInForm'),signUpForm=$('authSignUpForm');
 if(!signInForm||!signUpForm)return;
 const remember=$('rememberEmail'),emailInput=$('authEmail'),status=googleLoginStatus;
 const setStatus=(message,kind)=>{if(!status)return;status.textContent=message;status.className='form-status'+(kind?' '+kind:'')};
 const signinTab=$('authModeSignIn'),signupTab=$('authModeSignUp');
 const setMode=mode=>{
  const signIn=mode==='signin';
  signInForm.hidden=!signIn;signUpForm.hidden=signIn;
  if(signinTab){signinTab.classList.toggle('is-active',signIn);signinTab.setAttribute('aria-selected',String(signIn))}
  if(signupTab){signupTab.classList.toggle('is-active',!signIn);signupTab.setAttribute('aria-selected',String(!signIn))}
  if(!googleUser)setStatus(signIn?'Sign in with Google or your email and password.':'Create an account with your email and password.');
 };
 signinTab?.addEventListener('click',()=>setMode('signin'));
 signupTab?.addEventListener('click',()=>setMode('signup'));
 let cookieChoice='';try{cookieChoice=localStorage.getItem('ventorea-cookie-choice')||''}catch{}
 if(cookieChoice==='declined'){
  clearRememberedEmail();
  if(remember){remember.checked=false;remember.disabled=true}
 }else if(remember&&emailInput){
  const savedEmail=readRememberedEmail();
  if(savedEmail){emailInput.value=savedEmail;remember.checked=true}
 }
 const syncRememberedEmail=()=>{
  if(!remember||remember.disabled)return;
  if(remember.checked)writeRememberedEmail(emailInput?.value||'');
  else clearRememberedEmail();
 };
 remember?.addEventListener('change',syncRememberedEmail);
 emailInput?.addEventListener('change',syncRememberedEmail);
 signInForm.addEventListener('submit',async event=>{
  event.preventDefault();
  if(!supabaseClient){setStatus('Sign-in is unavailable right now. Please try again later.','error');return}
  const email=emailInput?.value.trim()||'';
  const password=$('authPassword')?.value||'';
  if(remember?.checked)writeRememberedEmail(email);else clearRememberedEmail();
  const submit=$('authSignInSubmit');if(submit)submit.disabled=true;
  setStatus('Signing in securely…');
  try{
   const {error}=await supabaseClient.auth.signInWithPassword({email,password});
   if(error)throw error;
   setStatus('You’re signed in. Welcome back.','success');
   updateLoginPage();
   window.location.assign('/');
  }catch(error){
   const message=String(error?.message||'').toLowerCase();
   setStatus(message.includes('invalid login credentials')?'That email and password don’t match. Please try again.':'We couldn’t sign you in. Check your details and try again.','error');
  }finally{if(submit)submit.disabled=false}
 });
 signUpForm.addEventListener('submit',async event=>{
  event.preventDefault();
  if(!supabaseClient){setStatus('Account creation is unavailable right now. Please try again later.','error');return}
  const username=$('authUsername')?.value.trim()||'';
  const phone=$('authPhone')?.value.trim()||'';
  const email=$('signupEmail')?.value.trim()||'';
  const password=$('signupPassword')?.value||'';
  const submit=$('authSignUpSubmit');if(submit)submit.disabled=true;
  setStatus('Creating your account securely…');
  try{
   const {data,error}=await supabaseClient.auth.signUp({
    email,password,
    options:{data:{username,display_name:username,phone_number:phone},emailRedirectTo:window.location.origin+'/'}
   });
   if(error)throw error;
   if(data?.session){
    setStatus('Your account is ready. Welcome to Ventorea.','success');
    updateLoginPage();
    window.location.assign('/');
   }else setStatus('Check your email for a confirmation link. After confirming, you can sign in here.','success');
  }catch(error){
   const message=String(error?.message||'').toLowerCase();
   setStatus(message.includes('password')?'Choose a stronger password and try again.':'We couldn’t create your account. Check your details and try again.','error');
  }finally{if(submit)submit.disabled=false}
 });
 setMode('signin');
 updateLoginPage();
}
googleSignOutButton?.addEventListener('click',async()=>{
 if(!supabaseClient)return;const {error}=await supabaseClient.auth.signOut();
 if(error){googleLoginStatus.textContent=error.message;googleLoginStatus.className='form-status error'}
 else{googleUser=null;googleLoginButton.disabled=false;refreshGoogleAccount();updateAccountUI()}
});
function add(text,type){
  if(!messages)return null;const p=document.createElement('p');p.className=type;p.textContent=text;messages.appendChild(p);messages.scrollTop=messages.scrollHeight;return p;
}
async function sendToAI(){
  if(!isDemoSignedIn()){openGoogleLogin();return}
  const q=input?.value.trim().slice(0,MAX_MESSAGE_LENGTH);if(!q||input.disabled)return;
  const userBubble=add(q,'user'),receipt=document.createElement('small');receipt.className='ai-receipt';receipt.textContent='Sent ✓';userBubble?.appendChild(receipt);
  chat.push({role:'user',content:q});while(chat.length>MAX_HISTORY)chat.shift();saveChatHistory();input.value='';input.disabled=true;
  const submit=form?.querySelector('button[type="submit"],button:not([type])');if(submit)submit.disabled=true;
  const loading=add('Thinking…','bot');
  try{
    const {data:sessionData,error:sessionError}=await supabaseClient.auth.getSession();if(sessionError||!sessionData?.session){googleUser=null;updateAccountUI();throw new Error('Your sign-in session expired. Please sign in with Google again.')}googleUser=sessionData.session.user;updateAccountUI();const response=await fetch(AI_ENDPOINT,{method:'POST',headers:{'Content-Type':'application/json','Authorization':'Bearer '+sessionData.session.access_token},body:JSON.stringify({messages:chat,user:{id:sessionData.session.user.id,email:sessionData.session.user.email}})});
    const data=await response.json().catch(()=>({}));loading?.remove();if(!response.ok)throw new Error(typeof data.error==='string'?data.error:'Ventorea AI returned HTTP '+response.status+'.');
    const answer=typeof data.content==='string'?data.content.trim():'';add(answer||'Ventorea AI returned an empty response.','bot');
    if(answer){chat.push({role:'assistant',content:answer.slice(0,MAX_MESSAGE_LENGTH)});while(chat.length>MAX_HISTORY)chat.shift();saveChatHistory();if(receipt)receipt.textContent='Read ✓✓';if(!panel?.classList.contains('open'))setUnread(unreadCount+1)}
  }catch(error){loading?.remove();if(receipt)receipt.textContent='Not sent';add(error?.message||'Ventorea AI could not be reached. Please try again.','bot');checkPresence()}
  finally{if(input){input.disabled=!isDemoSignedIn();if(panel?.classList.contains('open'))input.focus()}if(submit)submit.disabled=false}
}
form?.addEventListener('submit',e=>{e.preventDefault();sendToAI()});
function setCookieChoice(choice){try{localStorage.setItem('ventorea-cookie-choice',choice)}catch{};const remember=$('rememberEmail');if(choice==='declined'){clearRememberedEmail();if(remember){remember.checked=false;remember.disabled=true}}else if(remember)remember.disabled=false;cookieNotice?.classList.remove('is-visible')}
function showCookieNotice(){cookieNotice?.classList.add('is-visible')}
function initCookieNotice(){let saved='';try{saved=localStorage.getItem('ventorea-cookie-choice')||''}catch{};if(!saved)showCookieNotice()}
$('cookieAccept')?.addEventListener('click',()=>setCookieChoice('acknowledged'));$('cookieDecline')?.addEventListener('click',()=>setCookieChoice('declined'));$('cookieSettingsOpen')?.addEventListener('click',showCookieNotice);
document.querySelectorAll('.faq details').forEach(d=>d.addEventListener('toggle',()=>{if(d.open)document.querySelectorAll('.faq details').forEach(other=>{if(other!==d)other.removeAttribute('open')})}));
document.addEventListener('keydown',event=>{if(event.key!=='Escape')return;if(panel?.classList.contains('open'))aiClose();if(googleLoginModal?.classList.contains('open'))hideModal(googleLoginModal);['accountSettingsModal','feedbackModal','supportModal'].forEach(id=>{const el=$(id);if(el?.classList.contains('open'))hideModal(el)})});
[googleLoginModal,accountSettingsModal,$('feedbackModal'),$('supportModal')].forEach(el=>el?.addEventListener('click',e=>{if(e.target===el)hideModal(el)}));

// Keep the animated starfield off touch devices: drawing it at 60fps was
// needlessly expensive while mobile browsers were opening the Google sign-in flow.
(()=>{
 const canvas=$('ambientCanvas');if(!canvas)return;
 const mobile=window.matchMedia('(max-width: 680px)').matches||window.matchMedia('(pointer: coarse)').matches;
 if(mobile){canvas.style.display='none';return;}
 const ctx=canvas.getContext('2d',{alpha:true});if(!ctx)return;
 let width=0,height=0,dpr=1,raf=0,particles=[];
 const reduced=window.matchMedia('(prefers-reduced-motion: reduce)').matches;
 function resize(){
  dpr=Math.min(window.devicePixelRatio||1,1.5);
  width=window.innerWidth;height=window.innerHeight;
  canvas.width=Math.floor(width*dpr);canvas.height=Math.floor(height*dpr);
  ctx.setTransform(dpr,0,0,dpr,0,0);
  const count=Math.min(64,Math.max(24,Math.floor(width*height/24000)));
  particles=Array.from({length:count},()=>({x:Math.random()*width,y:Math.random()*height,r:.5+Math.random()*1.3,a:.12+Math.random()*.35,v:.08+Math.random()*.28,phase:Math.random()*Math.PI*2}));
  draw(0);
 }
 function draw(t){
  ctx.clearRect(0,0,width,height);
  for(let i=0;i<particles.length;i++){
   const p=particles[i];if(!reduced)p.y-=p.v*.22;if(p.y< -3)p.y=height+3;
   const alpha=p.a*(reduced?1:.65+.35*Math.sin(t*.0007+p.phase));
   ctx.beginPath();ctx.arc(p.x,p.y,p.r,0,Math.PI*2);ctx.fillStyle='rgba(111,183,255,'+alpha+')';ctx.fill();
   if(i%3===0)for(let j=i+1;j<Math.min(i+5,particles.length);j++){
    const q=particles[j],dx=p.x-q.x,dy=p.y-q.y,d=Math.hypot(dx,dy);
    if(d<115){ctx.beginPath();ctx.moveTo(p.x,p.y);ctx.lineTo(q.x,q.y);ctx.strokeStyle='rgba(65,143,230,'+((1-d/115)*.12)+')';ctx.lineWidth=.6;ctx.stroke()}
   }
  }
  if(!reduced)raf=requestAnimationFrame(draw);
 }
 window.addEventListener('resize',resize,{passive:true});resize();
 if(!reduced)raf=requestAnimationFrame(draw);
 document.addEventListener('visibilitychange',()=>{if(document.hidden)cancelAnimationFrame(raf);else if(!reduced){cancelAnimationFrame(raf);raf=requestAnimationFrame(draw)}});
})();
updateAccountUI();applyMotionSetting();checkPresence();initCookieNotice();initLoginPage();setInterval(()=>{if(presenceText){const status=serviceOnline?'Online':'Offline';presenceText.textContent=status+' · active '+duration(Date.now()-sessionStartedAt)}},1000);





// Keep the mobile chat panel usable when the on-screen keyboard opens.
(()=>{const viewport=window.visualViewport,panel=document.getElementById('aiPanel');if(!viewport||!panel)return;const fit=()=>{if(!window.matchMedia('(max-width: 680px)').matches||!panel.classList.contains('open')){panel.style.removeProperty('--ai-visible-height');return}panel.style.setProperty('--ai-visible-height',Math.max(240,Math.floor(viewport.height-90))+'px')};viewport.addEventListener('resize',fit,{passive:true});viewport.addEventListener('scroll',fit,{passive:true});document.getElementById('aiMobileOpen')?.addEventListener('click',()=>setTimeout(fit,200));document.getElementById('aiClose')?.addEventListener('click',()=>panel.style.removeProperty('--ai-visible-height'));})();


// v50 mobile interaction safeguards
function setModalOpen(el, open){
  if(!el) return;
  el.classList.toggle('open', open);
  el.setAttribute('aria-hidden', String(!open));
  document.body.classList.toggle('modal-open', open || !!document.querySelector('.modal.open'));
}
const baseShowModal=showModal;
showModal=function(el){baseShowModal(el);document.body.classList.add('modal-open')};
const baseHideModal=hideModal;
hideModal=function(el){baseHideModal(el);document.body.classList.toggle('modal-open',!!document.querySelector('.modal.open'))};
document.querySelectorAll('.modal').forEach(el=>{
  el.addEventListener('click',event=>{if(event.target===el)hideModal(el)});
});
document.addEventListener('keydown',event=>{
  if(event.key==='Escape'){
    document.querySelectorAll('.modal.open').forEach(hideModal);
    if(panel?.classList.contains('open'))aiClose();
    nav?.classList.remove('open');
    menu?.setAttribute('aria-expanded','false');
    menu?.setAttribute('aria-label','Open menu');
  }
});


/* Ventorea 2026 interaction layer / v52 */
(()=>{
  const root=document.documentElement;
  const progress=document.getElementById('scrollProgressBar');
  const backToTop=document.getElementById('backToTop');
  const reduceMotion=window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const finePointer=window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  let scrollFrame=0;
  root.classList.add('motion-ready');

  const targets=document.querySelectorAll('.section, .system-card, .world-card, .timeline-item, .faq-list details, .project-visual, .hero-art');
  targets.forEach((el,index)=>{
    el.classList.add('reveal-target');
    if(el.classList.contains('system-card')||el.classList.contains('world-card'))el.style.transitionDelay=(index%4)*55+'ms';
  });

  if(!reduceMotion && 'IntersectionObserver' in window){
    const observer=new IntersectionObserver(entries=>{
      entries.forEach(entry=>{
        if(entry.isIntersecting){
          entry.target.classList.add('is-visible');
          observer.unobserve(entry.target);
        }
      });
    },{threshold:.08,rootMargin:'0px 0px -5% 0px'});
    targets.forEach(el=>observer.observe(el));
  }else{
    targets.forEach(el=>el.classList.add('is-visible'));
  }

  const updateScrollUI=()=>{
    scrollFrame=0;
    const max=Math.max(1,root.scrollHeight-window.innerHeight);
    const ratio=Math.min(1,Math.max(0,window.scrollY/max));
    if(progress)progress.style.width=(ratio*100)+'%';
    if(backToTop)backToTop.classList.toggle('is-visible',window.scrollY>520);
  };
  const requestScrollUI=()=>{
    if(!scrollFrame)scrollFrame=requestAnimationFrame(updateScrollUI);
  };
  window.addEventListener('scroll',requestScrollUI,{passive:true});
  window.addEventListener('resize',requestScrollUI,{passive:true});
  updateScrollUI();

  backToTop?.addEventListener('click',()=>{
    window.scrollTo({top:0,behavior:reduceMotion?'auto':'smooth'});
  });

  if(finePointer && !reduceMotion){
    document.querySelectorAll('.system-card, .world-card').forEach(card=>{
      card.addEventListener('pointermove',event=>{
        const box=card.getBoundingClientRect();
        card.style.setProperty('--pointer-x',Math.round(event.clientX-box.left)+'px');
        card.style.setProperty('--pointer-y',Math.round(event.clientY-box.top)+'px');
      },{passive:true});
      card.addEventListener('pointerleave',()=>{
        card.style.removeProperty('--pointer-x');
        card.style.removeProperty('--pointer-y');
      },{passive:true});
    });
  }

  // Keep the header and scroll position predictable when a visitor follows an in-page link.
  document.querySelectorAll('a[href^="#"]').forEach(link=>{
    link.addEventListener('click',()=>{
      const nav=document.getElementById('navLinks');
      const menu=document.getElementById('menu');
      if(nav?.classList.contains('open')){
        nav.classList.remove('open');
        menu?.setAttribute('aria-expanded','false');
        menu?.setAttribute('aria-label','Open menu');
      }
    });
  });
})();
