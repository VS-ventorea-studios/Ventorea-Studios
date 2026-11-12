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

const AI_ENDPOINT='/api/chat';
const $=id=>document.getElementById(id);
const launcher=$('aiMenuOpen'),desktopLauncher=$('aiDesktopOpen'),mobileLauncher=$('aiMobileOpen'),panel=$('aiPanel'),closeButton=$('aiClose'),messages=$('aiMessages'),form=$('aiForm'),input=$('aiInput'),unreadBadge=$('aiUnread'),presenceText=$('aiPresenceText'),presenceDot=$('aiPresenceDot'),menuPresence=$('aiMenuStatus');
const aiAuthRequired=$('aiAuthRequired'),aiSignInButton=$('aiSignInButton');
const accountOpen=$('accountOpen');
const cookieNotice=$('cookieNotice');
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
  if(accountOpen){accountOpen.innerHTML=signed?'MY ACCOUNT <span>↗</span>':'SIGN IN <span>↗</span>';accountOpen.href='/account/';accountOpen.setAttribute('aria-label',signed?'Open account settings':'Sign in with Google')}
  if(input){input.disabled=!signed;input.placeholder=signed?'Message Ventorea AI…':'Sign in with Google to use Ventorea AI'}
  if(aiAuthRequired)aiAuthRequired.hidden=signed;
  if(form)form.hidden=!signed;
  if(aiSignInButton)aiSignInButton.disabled=!!googleOAuthPending;
  if(signed)populateAccountSettings();
}
function showModal(el){if(!el)return;el.classList.add('open');el.setAttribute('aria-hidden','false');document.body.classList.add('modal-open')}
function hideModal(el){if(!el)return;el.classList.remove('open');el.setAttribute('aria-hidden','true');document.body.classList.toggle('modal-open',!!document.querySelector('.modal.open'))}
function aiOpen(){
  // Open the chat immediately. Session recovery runs in the background so slow
  // auth requests never make the desktop or mobile launcher appear unresponsive.
  renderSavedChat();
  updateAccountUI();
  document.body.classList.add('ai-chat-open');
  panel?.classList.add('open');
  panel?.setAttribute('aria-hidden','false');
  launcher?.setAttribute('aria-expanded','true');
  desktopLauncher?.setAttribute('aria-expanded','true');
  mobileLauncher?.setAttribute('aria-expanded','true');
  setUnread(0);
  if(isDemoSignedIn())setTimeout(()=>input?.focus({preventScroll:true}),180);
  loadSession().then(user=>{
    if(user&&panel?.classList.contains('open'))setTimeout(()=>input?.focus({preventScroll:true}),80);
  }).catch(error=>console.warn('Could not verify Ventorea AI sign-in:',error));
}
function aiClose(){document.body.classList.remove('ai-chat-open');panel?.classList.remove('open');panel?.setAttribute('aria-hidden','true');launcher?.setAttribute('aria-expanded','false');desktopLauncher?.setAttribute('aria-expanded','false');mobileLauncher?.setAttribute('aria-expanded','false');if(window.matchMedia('(max-width: 680px)').matches)mobileLauncher?.focus();else if(desktopLauncher)desktopLauncher.focus();else launcher?.focus()}
function setUnread(count){unreadCount=Math.max(0,count);if(unreadBadge){unreadBadge.hidden=unreadCount===0;unreadBadge.textContent=unreadCount>9?'9+':String(unreadCount)}if(launcher)launcher.setAttribute('aria-label',unreadCount?('Open Ventorea AI, '+unreadCount+' unread messages'):'Open Ventorea AI')}
function setPresence(online,label){if(presenceText)presenceText.textContent=label;if(presenceDot){presenceDot.classList.toggle('is-online',online);presenceDot.classList.toggle('is-offline',!online)}if(menuPresence){menuPresence.textContent=online?'ONLINE':'OFFLINE';menuPresence.classList.toggle('is-online',online);menuPresence.classList.toggle('is-offline',!online)}}
function duration(ms){const sec=Math.max(0,Math.floor(ms/1000)),h=Math.floor(sec/3600),m=Math.floor((sec%3600)/60),s=sec%60;return h?String(h).padStart(2,'0')+':'+String(m).padStart(2,'0')+':'+String(s).padStart(2,'0'):String(m).padStart(2,'0')+':'+String(s).padStart(2,'0')}
async function checkPresence(){
  try{const response=await fetch(AI_ENDPOINT,{method:'GET',cache:'no-store'});const data=await response.json().catch(()=>({}));serviceOnline=response.ok&&data.ok===true&&data.keyConfigured===true;const needsSetup=response.ok&&data.ok===true&&data.keyConfigured===false;setPresence(serviceOnline,serviceOnline?'Online · active '+duration(Date.now()-sessionStartedAt):needsSetup?'Setup needed':'Offline · active '+duration(Date.now()-sessionStartedAt));if(needsSetup&&presenceText)presenceText.title='The server needs its AI API key configured.'}
  catch{serviceOnline=false;setPresence(false,'Offline · active '+duration(Date.now()-sessionStartedAt))}
}
renderSavedChat();
if(launcher){launcher.setAttribute('aria-controls','aiPanel');launcher.setAttribute('aria-expanded','false');launcher.addEventListener('click',event=>{event.preventDefault();if(panel?.classList.contains('open'))aiClose();else aiOpen()})}
if(desktopLauncher){desktopLauncher.setAttribute('aria-controls','aiPanel');desktopLauncher.setAttribute('aria-expanded','false');desktopLauncher.addEventListener('click',()=>{if(panel?.classList.contains('open'))aiClose();else aiOpen()})}
if(mobileLauncher){mobileLauncher.setAttribute('aria-controls','aiPanel');mobileLauncher.setAttribute('aria-expanded','false');mobileLauncher.addEventListener('click',event=>{event.preventDefault();if(panel?.classList.contains('open'))aiClose();else aiOpen()})}
closeButton?.addEventListener('click',aiClose);
aiSignInButton?.addEventListener('click',startGoogleLogin);

let googleUser=null,googleOAuthPending=false;
const googleLoginModal=$('googleLoginModal'),googleLoginStatus=$('googleLoginStatus'),googleLoginButton=$('googleLoginButton'),googleSignOutButton=$('googleSignOutButton');
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
const accountFriendCode=$('accountFriendCode');
const friendCodeInput=$('friendCodeInput');
const friendsStatus=$('friendsStatus');
const friendRequestsList=$('friendRequestsList');
const friendsList=$('friendsList');

function displayNameFor(user){return user?.display_name||user?.email?.split('@')[0]||'Ventorea member'}
function safeText(tag,text,className){const el=document.createElement(tag);el.textContent=text;if(className)el.className=className;return el}
function setFriendsStatus(message,kind=''){if(friendsStatus){friendsStatus.textContent=message;friendsStatus.className='form-status'+(kind?' '+kind:'')}}
function populateAccountSettings(user=googleUser){
 if(!user)return;
 const name=displayNameFor(user),email=user.email||'';
 if(accountDisplayName&&document.activeElement!==accountDisplayName)accountDisplayName.value=name;
 if(accountEmail)accountEmail.value=email;
 if(accountPhone&&document.activeElement!==accountPhone)accountPhone.value=user.phone_number||'';
 if(accountBio&&document.activeElement!==accountBio)accountBio.value=user.bio||'';
 if(accountIdentityName)accountIdentityName.textContent=name;
 if(accountIdentityEmail)accountIdentityEmail.textContent=email;
 if(accountAvatar)accountAvatar.textContent=(name.trim()[0]||'V').toUpperCase();
 if(rememberChatSetting)rememberChatSetting.checked=readSetting(REMEMBER_CHAT_KEY,true);
 if(reduceMotionSetting)reduceMotionSetting.checked=readSetting(REDUCE_MOTION_KEY,false);
 if(accountFriendCode&&user.friend_code)accountFriendCode.value=user.friend_code;
}
function refreshGoogleAccount(){
 if(!googleLoginStatus)return;
 if(googleUser){
  googleLoginStatus.textContent='Signed in as '+(googleUser.email||'Google user')+'. Your profile is available from My Account.';
  googleLoginStatus.className='form-status success';
  if(googleLoginButton)googleLoginButton.hidden=true;
  if(googleSignOutButton)googleSignOutButton.hidden=false;
 }else{
  googleLoginStatus.textContent='Choose Google to securely sign in to Ventorea Studios.';
  googleLoginStatus.className='form-status';
  if(googleLoginButton)googleLoginButton.hidden=false;
  if(googleSignOutButton)googleSignOutButton.hidden=true;
 }
}
async function loadSession(){
 const response=await fetch('/api/auth/session',{method:'GET',credentials:'same-origin',cache:'no-store'});
 const data=await response.json().catch(()=>({}));
 if(!response.ok)throw new Error(data.error||'Account service is unavailable.');
 googleUser=data.user||null;
 refreshGoogleAccount();
 updateAccountUI();
 return googleUser;
}
function openGoogleLogin(){
 showModal(googleLoginModal);
 refreshGoogleAccount();
 if(!window.matchMedia('(pointer: coarse)').matches)setTimeout(()=>googleLoginButton?.focus({preventScroll:true}),80);
}
function startGoogleLogin(){
 if(googleOAuthPending)return;
 googleOAuthPending=true;
 if(googleLoginButton)googleLoginButton.disabled=true;
 if(aiSignInButton)aiSignInButton.disabled=true;
 if(googleLoginStatus){googleLoginStatus.textContent='Connecting to Google securely…';googleLoginStatus.className='form-status'}
 window.location.assign('/api/auth/google/start');
}
async function signOut(){
 const response=await fetch('/api/auth/logout',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'}});
 const data=await response.json().catch(()=>({}));
 if(!response.ok)throw new Error(data.error||'Could not sign out.');
 googleUser=null;
 chat.length=0;
 try{localStorage.removeItem(CHAT_STORAGE_KEY)}catch{}
 refreshGoogleAccount();
 updateAccountUI();
}
async function openAccountSettings(){
 if(!googleUser){openGoogleLogin();return}
 populateAccountSettings();
 showModal(accountSettingsModal);
 if(friendRequestsList)friendRequestsList.replaceChildren(safeText('p','Loading requests…','settings-help'));
 if(friendsList)friendsList.replaceChildren(safeText('p','Loading friends…','settings-help'));
 try{
  const response=await fetch('/api/account/profile',{credentials:'same-origin',cache:'no-store'});
  const data=await response.json().catch(()=>({}));
  if(!response.ok)throw new Error(data.error||'Could not load your profile.');
  googleUser=data.user||googleUser;
  populateAccountSettings();
 }catch(error){
  if(accountProfileStatus){accountProfileStatus.textContent=error.message;accountProfileStatus.className='form-status error'}
 }
 await loadFriends();
}
async function loadFriends(){
 if(!googleUser)return;
 if(friendRequestsList)friendRequestsList.replaceChildren(safeText('p','Loading requests…','settings-help'));
 if(friendsList)friendsList.replaceChildren(safeText('p','Loading friends…','settings-help'));
 try{
  const response=await fetch('/api/account/friends',{credentials:'same-origin',cache:'no-store'});
  const data=await response.json().catch(()=>({}));
  if(!response.ok)throw new Error(data.error||'Could not load friends.');
  if(accountFriendCode)accountFriendCode.value=data.friendCode||'Not available';
  if(friendRequestsList){
   friendRequestsList.replaceChildren();
   if(!data.requests?.length)friendRequestsList.append(safeText('p','No pending requests.','settings-help'));
   for(const request of data.requests||[]){
    const row=document.createElement('div');row.className='friend-row';
    const info=document.createElement('div');info.append(safeText('b',request.sender_name||'Ventorea member'),safeText('small',request.sender_code||''));
    const accept=document.createElement('button');accept.type='button';accept.className='button button-bright';accept.textContent='ACCEPT';
    accept.addEventListener('click',()=>acceptFriendRequest(request.id));row.append(info,accept);friendRequestsList.append(row);
   }
  }
  if(friendsList){
   friendsList.replaceChildren();
   if(!data.friends?.length)friendsList.append(safeText('p','No friends yet. Add someone using their friend code.','settings-help'));
   for(const friend of data.friends||[]){
    const row=document.createElement('div');row.className='friend-row';
    const info=document.createElement('div');info.append(safeText('b',friend.display_name||'Ventorea member'),safeText('small',friend.friend_code||''));
    const remove=document.createElement('button');remove.type='button';remove.className='button button-outline';remove.textContent='REMOVE';
    remove.addEventListener('click',()=>removeFriend(friend.friend_id));row.append(info,remove);friendsList.append(row);
   }
  }
 }catch(error){
  if(friendRequestsList)friendRequestsList.replaceChildren(safeText('p',error.message||'Could not load requests.','settings-help'));
  if(friendsList)friendsList.replaceChildren(safeText('p',error.message||'Could not load friends.','settings-help'));
 }
}
async function acceptFriendRequest(requestId){
 try{
  const response=await fetch('/api/account/friends',{method:'PATCH',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify({requestId})});
  const data=await response.json().catch(()=>({}));
  if(!response.ok)throw new Error(data.error||'Could not accept request.');
  setFriendsStatus('Friend added.','success');await loadFriends();
 }catch(error){setFriendsStatus(error.message||'Could not accept request.','error')}
}
async function removeFriend(friendId){
 if(!confirm('Remove this friend?'))return;
 try{
  const response=await fetch('/api/account/friends',{method:'DELETE',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify({friendId})});
  const data=await response.json().catch(()=>({}));
  if(!response.ok)throw new Error(data.error||'Could not remove friend.');
  setFriendsStatus('Friend removed.','success');await loadFriends();
 }catch(error){setFriendsStatus(error.message||'Could not remove friend.','error')}
}
async function sendFriendRequest(event){
 event.preventDefault();
 if(!googleUser)return;
 const friendCode=friendCodeInput?.value.trim().toUpperCase();
 if(!friendCode)return;
 const button=$('addFriendButton');if(button)button.disabled=true;
 setFriendsStatus('Looking up friend code…');
 try{
  const response=await fetch('/api/account/friends',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'send',friendCode})});
  const data=await response.json().catch(()=>({}));
  if(!response.ok)throw new Error(data.error||'Could not send friend request.');
  if(friendCodeInput)friendCodeInput.value='';
  setFriendsStatus(data.message||'Friend request sent.','success');
 }catch(error){setFriendsStatus(error.message||'Could not send friend request.','error')}
 finally{if(button)button.disabled=false}
}

$('accountSettingsClose')?.addEventListener('click',()=>hideModal(accountSettingsModal));
accountSettingsModal?.addEventListener('click',event=>{if(event.target===accountSettingsModal)hideModal(accountSettingsModal)});
accountProfileForm?.addEventListener('submit',async event=>{
 event.preventDefault();
 if(!googleUser)return;
 const displayName=accountDisplayName?.value.trim()||'';
 if(!displayName){accountProfileStatus.textContent='Please enter a display name.';accountProfileStatus.className='form-status error';return}
 const save=$('accountSaveProfile');if(save)save.disabled=true;
 accountProfileStatus.textContent='Saving profile…';accountProfileStatus.className='form-status';
 try{
  const response=await fetch('/api/account/profile',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify({displayName,phone:accountPhone?.value.trim()||'',bio:accountBio?.value.trim()||''})});
  const data=await response.json().catch(()=>({}));
  if(!response.ok)throw new Error(data.error||'Could not save your profile.');
  googleUser=data.user||googleUser;populateAccountSettings();
  accountProfileStatus.textContent='Profile saved successfully.';accountProfileStatus.className='form-status success';
 }catch(error){accountProfileStatus.textContent=error.message||'Could not save your profile.';accountProfileStatus.className='form-status error'}
 finally{if(save)save.disabled=false}
});
$('addFriendForm')?.addEventListener('submit',sendFriendRequest);
$('copyFriendCode')?.addEventListener('click',async()=>{
 try{await navigator.clipboard.writeText(accountFriendCode?.value||'');setFriendsStatus('Friend code copied.','success')}
 catch{setFriendsStatus('Copy failed. Select the code and copy it manually.','error')}
});
rememberChatSetting?.addEventListener('change',()=>{
 try{localStorage.setItem(REMEMBER_CHAT_KEY,String(rememberChatSetting.checked));if(!rememberChatSetting.checked)localStorage.removeItem(CHAT_STORAGE_KEY);else saveChatHistory();settingsStatus.textContent=rememberChatSetting.checked?'AI chat history will be saved on this device.':'AI chat history will not be saved on this device.';settingsStatus.className='form-status success'}
 catch{settingsStatus.textContent='Your browser blocked this setting.';settingsStatus.className='form-status error'}
});
reduceMotionSetting?.addEventListener('change',()=>{
 try{localStorage.setItem(REDUCE_MOTION_KEY,String(reduceMotionSetting.checked));applyMotionSetting();settingsStatus.textContent='Motion preference updated.';settingsStatus.className='form-status success'}
 catch{settingsStatus.textContent='Your browser blocked this setting.';settingsStatus.className='form-status error'}
});
$('clearChatButton')?.addEventListener('click',()=>{
 chat.length=0;try{localStorage.removeItem(CHAT_STORAGE_KEY)}catch{};renderSavedChat();settingsStatus.textContent='Saved AI chat history cleared from this device.';settingsStatus.className='form-status success';
});
$('accountSignOutButton')?.addEventListener('click',async()=>{
 const button=$('accountSignOutButton');if(button)button.disabled=true;
 try{await signOut();hideModal(accountSettingsModal)}
 catch(error){settingsStatus.textContent=error.message||'Could not sign out.';settingsStatus.className='form-status error'}
 finally{if(button)button.disabled=false}
});
$('googleLoginClose')?.addEventListener('click',()=>hideModal(googleLoginModal));
googleLoginModal?.addEventListener('click',event=>{if(event.target===googleLoginModal)hideModal(googleLoginModal)});
googleLoginButton?.addEventListener('click',startGoogleLogin);
googleSignOutButton?.addEventListener('click',async()=>{
 try{await signOut();googleLoginStatus.textContent='You have signed out successfully.';googleLoginStatus.className='form-status success'}
 catch(error){googleLoginStatus.textContent=error.message||'Could not sign out.';googleLoginStatus.className='form-status error'}
});
loadSession().catch(error=>{
 console.warn('Ventorea account session unavailable:',error);
 googleUser=null;refreshGoogleAccount();updateAccountUI();
});
if(new URLSearchParams(window.location.search).get('login')==='required')aiOpen();

function add(text,type){
  if(!messages)return null;
  const p=document.createElement('div');p.className=type;
  if(type==='bot'&&text==='Thinking…'){
    p.classList.add('ai-thinking-glow');p.setAttribute('aria-live','polite');
    p.innerHTML='<span class="ai-thinking-dot" aria-hidden="true"></span><span>Thinking</span><span class="ai-thinking-ellipsis" aria-hidden="true">...</span>';
  }else if(type==='bot'){
    // Render a small, safe Markdown subset. Never inject model text as HTML.
    const lines=String(text??'').split(/\\r?\\n/);
    const addInline=(parent,line)=>{
      const re=/(https?:\\/\\/[^\\s<>"']+|\\*\\*[^*]+\\*\\*)/g;let last=0,m;
      while((m=re.exec(line))){
        if(m.index>last)parent.appendChild(document.createTextNode(line.slice(last,m.index)));
        const token=m[0];
        if(token.startsWith('http')){
          const clean=token.replace(/[),.!?]+$/,'');const suffix=token.slice(clean.length);
          try{const u=new URL(clean);if(u.protocol==='https:'||u.protocol==='http:'){const a=document.createElement('a');a.href=u.href;a.target='_blank';a.rel='noopener noreferrer';a.textContent=clean;a.className='ai-answer-link';parent.appendChild(a)}else parent.appendChild(document.createTextNode(clean))}catch{parent.appendChild(document.createTextNode(clean))}
          if(suffix)parent.appendChild(document.createTextNode(suffix));
        }else{const strong=document.createElement('strong');strong.textContent=token.slice(2,-2);parent.appendChild(strong)}
        last=re.lastIndex;
      }
      if(last<line.length)parent.appendChild(document.createTextNode(line.slice(last)));
    };
    for(const line of lines){
      if(!line.trim()){p.appendChild(document.createElement('br'));continue}
      const row=document.createElement(/^#{1,3}\\s/.test(line)?'h4':/^(?:[-*]|\\d+\\.)\\s/.test(line)?'div':'div');
      if(/^#{1,3}\\s/.test(line)){row.className='ai-answer-heading';addInline(row,line.replace(/^#{1,3}\\s/,''))}
      else if(/^(?:[-*])\\s/.test(line)){row.className='ai-answer-list-item';row.appendChild(document.createTextNode('• '));addInline(row,line.replace(/^(?:[-*])\\s/,''))}
      else if(/^\\d+\\.\\s/.test(line)){row.className='ai-answer-list-item';addInline(row,line)}
      else addInline(row,line);
      p.appendChild(row);
    }
  }else p.textContent=text;
  messages.appendChild(p);messages.scrollTop=messages.scrollHeight;return p;
}
(()=>{if(document.getElementById('aiReadableReplyStyles'))return;const style=document.createElement('style');style.id='aiReadableReplyStyles';style.textContent=`.ai-messages .bot{font-size:16px!important;line-height:1.75!important;overflow-wrap:anywhere}.ai-messages .bot .ai-answer-heading{font-size:1.18em;font-weight:700;margin:.55em 0 .25em;color:#f2f7ff}.ai-messages .bot .ai-answer-list-item{padding-left:.25em;margin:.18em 0}.ai-messages .bot strong{font-weight:750;color:#fff}.ai-messages .bot .ai-answer-link{color:#83c6ff;text-decoration:underline;text-underline-offset:3px;overflow-wrap:anywhere}.ai-messages .bot .ai-answer-link:hover{color:#c0e3ff}.ai-messages .user{font-size:15px!important;line-height:1.65!important}@media(max-width:680px){.ai-messages .bot{font-size:17px!important;line-height:1.75!important}.ai-messages .user{font-size:16px!important}}`;document.head.appendChild(style);})();
(()=>{if(document.getElementById('aiThinkingGlowStyles'))return;const style=document.createElement('style');style.id='aiThinkingGlowStyles';style.textContent=`.ai-messages .ai-thinking-glow{display:flex;align-items:center;gap:9px;width:max-content;max-width:90%;border:1px solid rgba(77,163,255,.42);box-shadow:0 0 8px rgba(77,163,255,.14),inset 0 0 10px rgba(77,163,255,.06);animation:aiThinkingGlow 2.1s ease-in-out infinite;color:#e0edff}.ai-thinking-dot{width:8px;height:8px;flex:0 0 8px;border-radius:50%;background:#7fc1ff;box-shadow:0 0 5px 2px rgba(77,163,255,.42);animation:aiThinkingPulse 1.6s ease-in-out infinite}.ai-thinking-ellipsis{display:inline-block;min-width:18px;letter-spacing:2px;animation:aiThinkingDots 1.2s steps(4,end) infinite;overflow:hidden}@keyframes aiThinkingGlow{0%,100%{border-color:rgba(77,163,255,.28);box-shadow:0 0 5px rgba(77,163,255,.1),inset 0 0 8px rgba(77,163,255,.04)}50%{border-color:rgba(125,195,255,.95);box-shadow:0 0 8px 3px rgba(77,163,255,.32),0 0 22px rgba(77,163,255,.18),inset 0 0 13px rgba(77,163,255,.12)}}@keyframes aiThinkingPulse{0%,100%{opacity:.55;transform:scale(.85);box-shadow:0 0 4px 1px rgba(77,163,255,.28)}50%{opacity:1;transform:scale(1.15);box-shadow:0 0 8px 4px rgba(77,163,255,.8)}}@keyframes aiThinkingDots{0%{width:0}100%{width:18px}}@media(prefers-reduced-motion:reduce){.ai-thinking-glow,.ai-thinking-dot,.ai-thinking-ellipsis{animation:none!important}}`;document.head.appendChild(style);})();
async function sendToAI(){
  if(!isDemoSignedIn()){openGoogleLogin();return}
  const q=input?.value.trim().slice(0,MAX_MESSAGE_LENGTH);if(!q||input.disabled)return;
  const userBubble=add(q,'user'),receipt=document.createElement('small');receipt.className='ai-receipt';receipt.textContent='Sent ✓';userBubble?.appendChild(receipt);
  chat.push({role:'user',content:q});while(chat.length>MAX_HISTORY)chat.shift();saveChatHistory();input.value='';input.disabled=true;
  const submit=form?.querySelector('button[type="submit"],button:not([type])');if(submit)submit.disabled=true;
  const loading=add('Thinking…','bot');
  try{
    const sessionUser=await loadSession();
    if(!sessionUser)throw new Error('Your sign-in session expired. Please sign in with Google again.');
    const requestController=new AbortController();
    const requestTimeout=window.setTimeout(()=>requestController.abort(),25000);
    let response;
    try {
      response=await fetch(AI_ENDPOINT,{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify({messages:chat}),signal:requestController.signal});
    } finally { window.clearTimeout(requestTimeout); }
    const data=await response.json().catch(()=>({}));loading?.remove();if(!response.ok)throw new Error(typeof data.error==='string'?data.error:'Ventorea AI returned HTTP '+response.status+'.');
    const answer=typeof data.content==='string'?data.content.trim():'';add(answer||'Ventorea AI returned an empty response.','bot');
    if(answer){chat.push({role:'assistant',content:answer.slice(0,MAX_MESSAGE_LENGTH)});while(chat.length>MAX_HISTORY)chat.shift();saveChatHistory();if(receipt)receipt.textContent='Read ✓✓';if(!panel?.classList.contains('open'))setUnread(unreadCount+1)}
  }catch(error){loading?.remove();if(receipt)receipt.textContent='Not sent';add(error?.name==='AbortError'?'Ventorea AI is taking too long to respond. Please try again.':(error?.message||'Ventorea AI could not be reached. Please try again.'),'bot');checkPresence()}
  finally{if(input){input.disabled=!isDemoSignedIn();if(panel?.classList.contains('open'))input.focus()}if(submit)submit.disabled=false}
}
form?.addEventListener('submit',e=>{e.preventDefault();sendToAI()});
function setCookieChoice(choice){try{localStorage.setItem('ventorea-cookie-choice',choice)}catch{};cookieNotice?.classList.remove('is-visible')}
function showCookieNotice(){cookieNotice?.classList.add('is-visible')}
function initCookieNotice(){let saved='';try{saved=localStorage.getItem('ventorea-cookie-choice')||''}catch{};if(!saved)showCookieNotice()}
$('cookieAccept')?.addEventListener('click',()=>setCookieChoice('acknowledged'));$('cookieDecline')?.addEventListener('click',()=>setCookieChoice('declined'));$('cookieSettingsOpen')?.addEventListener('click',showCookieNotice);
document.querySelectorAll('.faq details').forEach(d=>d.addEventListener('toggle',()=>{if(d.open)document.querySelectorAll('.faq details').forEach(other=>{if(other!==d)other.removeAttribute('open')})}));
document.addEventListener('keydown',event=>{if(event.key!=='Escape')return;if(panel?.classList.contains('open'))aiClose();if(googleLoginModal?.classList.contains('open'))hideModal(googleLoginModal);['accountSettingsModal','feedbackModal','supportModal'].forEach(id=>{const el=$(id);if(el?.classList.contains('open'))hideModal(el)})});
[googleLoginModal,accountSettingsModal,$('feedbackModal'),$('supportModal')].forEach(el=>el?.addEventListener('click',e=>{if(e.target===el)hideModal(el)}));

// Keep the ambient starfield static to avoid continuous canvas work while the page is open.
(()=>{
 const canvas=$('ambientCanvas');if(!canvas)return;
 const mobile=window.matchMedia('(max-width: 680px)').matches||window.matchMedia('(pointer: coarse)').matches;
 if(mobile){canvas.style.display='none';return}
 const ctx=canvas.getContext('2d',{alpha:true});if(!ctx)return;
 let width=0,height=0,dpr=1,particles=[];
 function resize(){
  dpr=Math.min(window.devicePixelRatio||1,1.5);
  width=window.innerWidth;height=window.innerHeight;
  canvas.width=Math.floor(width*dpr);canvas.height=Math.floor(height*dpr);
  ctx.setTransform(dpr,0,0,dpr,0,0);
  const count=Math.min(64,Math.max(24,Math.floor(width*height/24000)));
  particles=Array.from({length:count},()=>({x:Math.random()*width,y:Math.random()*height,r:.5+Math.random()*1.3,a:.12+Math.random()*.35}));
  draw();
 }
 function draw(){
  ctx.clearRect(0,0,width,height);
  for(let i=0;i<particles.length;i++){
   const p=particles[i];
   ctx.beginPath();ctx.arc(p.x,p.y,p.r,0,Math.PI*2);ctx.fillStyle='rgba(111,183,255,'+p.a+')';ctx.fill();
   if(i%3===0)for(let j=i+1;j<Math.min(i+5,particles.length);j++){
    const q=particles[j],dx=p.x-q.x,dy=p.y-q.y,d=Math.hypot(dx,dy);
    if(d<115){ctx.beginPath();ctx.moveTo(p.x,p.y);ctx.lineTo(q.x,q.y);ctx.strokeStyle='rgba(65,143,230,'+((1-d/115)*.12)+')';ctx.lineWidth=.6;ctx.stroke()}
   }
  }
 }
 window.addEventListener('resize',resize,{passive:true});
 resize();
})()

updateAccountUI();applyMotionSetting();checkPresence();initCookieNotice();setInterval(()=>{if(presenceText){const status=serviceOnline?'Online':'Offline';presenceText.textContent=status+' · active '+duration(Date.now()-sessionStartedAt)}},1000);





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


/* Ventorea 3D scroll and depth motion */
(()=> {
  const reduceMotion=window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const finePointer=window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  if(reduceMotion)return;

  const depthTargets=[
    ...document.querySelectorAll('.hero-art .art-sun,.hero-art .city-back,.hero-art .city-front,.hero-art .art-orbit,.hero-art .art-label,.project-sky .sun-disc,.project-sky .skyline,.world-art .world-sun,.world-art .world-buildings')
  ];
  depthTargets.forEach((el,index)=>el.dataset.scrollDepth=String([.12,.08,.16,.1,.06,.1,.07,.09,.06][index%9]));

  let frame=0;
  const updateDepth=()=>{
    frame=0;
    const mid=window.innerHeight*.52;
    depthTargets.forEach(el=>{
      const rect=el.getBoundingClientRect();
      const depth=Number(el.dataset.scrollDepth)||.08;
      const offset=Math.max(-42,Math.min(42,(mid-(rect.top+rect.height*.5))*depth));
      el.style.setProperty('--scroll-offset',offset.toFixed(1)+'px');
    });
  };
  const requestDepth=()=>{if(!frame)frame=requestAnimationFrame(updateDepth)};
  window.addEventListener('scroll',requestDepth,{passive:true});
  window.addEventListener('resize',requestDepth,{passive:true});
  updateDepth();

  if(finePointer){
    document.querySelectorAll('.system-card,.world-card').forEach(card=>{
      card.addEventListener('pointermove',event=>{
        const rect=card.getBoundingClientRect();
        const x=(event.clientX-rect.left)/rect.width-.5;
        const y=(event.clientY-rect.top)/rect.height-.5;
        card.style.setProperty('--tilt-x',(-y*5).toFixed(2)+'deg');
        card.style.setProperty('--tilt-y',(x*6).toFixed(2)+'deg');
        card.classList.add('is-3d-tilting');
      },{passive:true});
      const reset=()=>{
        card.classList.remove('is-3d-tilting');
        card.style.removeProperty('--tilt-x');
        card.style.removeProperty('--tilt-y');
      };
      card.addEventListener('pointerleave',reset,{passive:true});
      card.addEventListener('pointercancel',reset,{passive:true});
    });
  }
})();


/* Touch-friendly 3D movement driven by scroll position */
(()=> {
  const reduce=window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if(reduce)return;
  const cards=[...document.querySelectorAll('.system-card,.world-card')];
  const visuals=[...document.querySelectorAll('.project-visual,.route-hero')];
  const moving=[...cards,...visuals];
  if(!moving.length)return;
  moving.forEach(el=>el.classList.add('is-scroll-3d'));
  let raf=0;
  const clamp=(v,min,max)=>Math.max(min,Math.min(max,v));
  const update=()=>{
    raf=0;
    const mid=window.innerHeight*.52;
    moving.forEach((el,index)=>{
      const r=el.getBoundingClientRect();
      const distance=(mid-(r.top+r.height*.5))/Math.max(1,window.innerHeight*.72);
      const progress=clamp(distance,-1,1);
      const phase=((r.top+window.scrollY)/Math.max(1,window.innerHeight))*1.35;
      const tiltX=clamp(-progress*5.5,-5.5,5.5);
      const tiltY=clamp(Math.sin(phase)*2.8,-2.8,2.8);
      const lift=cards.includes(el)?(1-Math.abs(progress))*5:0;
      el.style.setProperty('--scroll-tilt-x',tiltX.toFixed(2)+'deg');
      el.style.setProperty('--scroll-tilt-y',tiltY.toFixed(2)+'deg');
      el.style.setProperty('--scroll-lift',lift.toFixed(1)+'px');
    });
  };
  const request=()=>{if(!raf)raf=requestAnimationFrame(update)};
  window.addEventListener('scroll',request,{passive:true});
  window.addEventListener('resize',request,{passive:true});
  update();
})();
