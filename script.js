const menu=document.getElementById('menu');
const nav=document.getElementById('navLinks');
if(menu&&nav){
  menu.setAttribute('aria-expanded','false');
  menu.addEventListener('click',()=>{
    const open=nav.classList.toggle('open');
    menu.setAttribute('aria-expanded',String(open));
    menu.setAttribute('aria-label',open?'Close menu':'Open menu');
  });
  document.querySelectorAll('#navLinks a').forEach(a=>a.addEventListener('click',()=>{
    nav.classList.remove('open');menu.setAttribute('aria-expanded','false');menu.setAttribute('aria-label','Open menu');
  }));
}

const AI_ENDPOINT='https://ventorea-studios.vercel.app/api/chat';
const $=id=>document.getElementById(id);
const launcher=$('aiMenuOpen'),mobileLauncher=$('aiMobileOpen'),panel=$('aiPanel'),close=$('aiClose'),messages=$('aiMessages'),form=$('aiForm'),input=$('aiInput'),unreadBadge=$('aiUnread'),presenceText=$('aiPresenceText'),presenceDot=$('aiPresenceDot'),menuPresence=$('aiMenuStatus');
const accountOpen=$('accountOpen');
const cookieNotice=$('cookieNotice');
const CHAT_STORAGE_KEY='ventorea-ai-chat-history-v1';
const MAX_HISTORY=12;const MAX_MESSAGE_LENGTH=2000;
const chat=loadChatHistory();
function loadChatHistory(){
  try{const saved=JSON.parse(localStorage.getItem(CHAT_STORAGE_KEY)||'[]');return Array.isArray(saved)?saved.filter(m=>m&&['user','assistant'].includes(m.role)&&typeof m.content==='string').slice(-MAX_HISTORY):[]}catch{return []}
}
function saveChatHistory(){try{localStorage.setItem(CHAT_STORAGE_KEY,JSON.stringify(chat.slice(-MAX_HISTORY)))}catch{}}
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
  if(accountOpen){accountOpen.innerHTML=signed?'ACCOUNT <span>✓</span>':'SIGN IN <span>↗</span>';accountOpen.setAttribute('aria-label',signed?'Open account settings':'Sign in with Google')}
  if(input){input.disabled=!signed;input.placeholder=signed?'Message Ventorea AI…':'Sign in with Google to use Ventorea AI'}
}
function showModal(el){if(!el)return;el.classList.add('open');el.setAttribute('aria-hidden','false')}
function hideModal(el){if(!el)return;el.classList.remove('open');el.setAttribute('aria-hidden','true')}
function aiOpen(){if(!isDemoSignedIn()){openGoogleLogin();if(googleLoginStatus){googleLoginStatus.textContent='Sign in with Google to unlock Ventorea AI.';googleLoginStatus.className='form-status error'}return}renderSavedChat();panel?.classList.add('open');panel?.setAttribute('aria-hidden','false');launcher?.setAttribute('aria-expanded','true');mobileLauncher?.setAttribute('aria-expanded','true');setUnread(0);setTimeout(()=>input?.focus({preventScroll:true}),100)}
function aiClose(){panel?.classList.remove('open');panel?.setAttribute('aria-hidden','true');launcher?.setAttribute('aria-expanded','false');mobileLauncher?.setAttribute('aria-expanded','false');if(window.matchMedia('(max-width: 680px)').matches)mobileLauncher?.focus();else launcher?.focus()}
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
function openGoogleLogin(){showModal(googleLoginModal);refreshGoogleAccount();setTimeout(()=>googleLoginButton?.focus(),80)}
function refreshGoogleAccount(){
 if(!googleLoginStatus)return;
 if(!window.supabase||SUPABASE_PUBLISHABLE_KEY==='PASTE_YOUR_SUPABASE_PUBLISHABLE_KEY_HERE'){googleLoginStatus.textContent='Setup needed: add your Supabase publishable key in script.js before testing login.';googleLoginStatus.className='form-status error';return}
 if(googleUser){googleLoginStatus.textContent='Signed in as '+(googleUser.email||googleUser.user_metadata?.full_name||'Google user')+'.';googleLoginStatus.className='form-status success';if(googleLoginButton)googleLoginButton.hidden=true;if(googleSignOutButton)googleSignOutButton.hidden=false}
 else{googleLoginStatus.textContent='Choose Google to securely sign in to Ventorea Studios.';googleLoginStatus.className='form-status';if(googleLoginButton)googleLoginButton.hidden=false;if(googleSignOutButton)googleSignOutButton.hidden=true}
}
if(window.supabase&&SUPABASE_PUBLISHABLE_KEY!=='PASTE_YOUR_SUPABASE_PUBLISHABLE_KEY_HERE'){
 supabaseClient=window.supabase.createClient(SUPABASE_URL,SUPABASE_PUBLISHABLE_KEY);
 supabaseClient.auth.getSession().then(({data,error})=>{if(error)console.error('Supabase session restore failed:',error);googleUser=data?.session?.user||null;refreshGoogleAccount();updateAccountUI()}).catch(error=>console.error('Supabase session restore failed:',error));
 supabaseClient.auth.onAuthStateChange((_event,session)=>{googleUser=session?.user||null;refreshGoogleAccount();updateAccountUI();if(googleUser&&googleLoginStatus)googleLoginStatus.textContent='Signed in as '+(googleUser.email||'Google user')+'.'});
}
accountOpen?.addEventListener('click',openGoogleLogin);
$('googleLoginClose')?.addEventListener('click',()=>hideModal(googleLoginModal));
googleLoginModal?.addEventListener('click',e=>{if(e.target===googleLoginModal)hideModal(googleLoginModal)});
googleLoginButton?.addEventListener('click',async()=>{
 if(!supabaseClient){refreshGoogleAccount();return}
 googleLoginButton.disabled=true;googleLoginStatus.textContent='Redirecting to Google…';
 const {error}=await supabaseClient.auth.signInWithOAuth({provider:'google',options:{redirectTo:window.location.href}});
 if(error){googleLoginStatus.textContent=error.message;googleLoginStatus.className='form-status error';googleLoginButton.disabled=false}
});
googleSignOutButton?.addEventListener('click',async()=>{
 if(!supabaseClient)return;const {error}=await supabaseClient.auth.signOut();
 if(error){googleLoginStatus.textContent=error.message;googleLoginStatus.className='form-status error'}
 else{googleUser=null;googleLoginButton.disabled=false;refreshGoogleAccount()}
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
function setCookieChoice(choice){try{localStorage.setItem('ventorea-cookie-choice',choice)}catch{};cookieNotice?.classList.remove('is-visible')}
function showCookieNotice(){cookieNotice?.classList.add('is-visible')}
function initCookieNotice(){let saved='';try{saved=localStorage.getItem('ventorea-cookie-choice')||''}catch{};if(!saved)showCookieNotice()}
$('cookieAccept')?.addEventListener('click',()=>setCookieChoice('acknowledged'));$('cookieDecline')?.addEventListener('click',()=>setCookieChoice('declined'));$('cookieSettingsOpen')?.addEventListener('click',showCookieNotice);
document.querySelectorAll('.faq details').forEach(d=>d.addEventListener('toggle',()=>{if(d.open)document.querySelectorAll('.faq details').forEach(other=>{if(other!==d)other.removeAttribute('open')})}));
document.addEventListener('keydown',event=>{if(event.key!=='Escape')return;if(panel?.classList.contains('open'))aiClose();if(googleLoginModal?.classList.contains('open'))hideModal(googleLoginModal);['feedbackModal','supportModal'].forEach(id=>{const el=$(id);if(el?.classList.contains('open'))hideModal(el)})});
[googleLoginModal,$('feedbackModal'),$('supportModal')].forEach(el=>el?.addEventListener('click',e=>{if(e.target===el)hideModal(el)}));

// Animated connected starfield for the midnight-blue background.
(()=>{const canvas=$('ambientCanvas');if(!canvas)return;const ctx=canvas.getContext('2d',{alpha:true});if(!ctx)return;let width=0,height=0,dpr=1,raf=0;const reduced=window.matchMedia('(prefers-reduced-motion: reduce)').matches;let particles=[];
function resize(){dpr=Math.min(window.devicePixelRatio||1,2);width=window.innerWidth;height=window.innerHeight;canvas.width=Math.floor(width*dpr);canvas.height=Math.floor(height*dpr);ctx.setTransform(dpr,0,0,dpr,0,0);const count=Math.min(85,Math.max(28,Math.floor(width*height/19000)));particles=Array.from({length:count},()=>({x:Math.random()*width,y:Math.random()*height,r:.5+Math.random()*1.5,a:.15+Math.random()*.55,v:.08+Math.random()*.28,phase:Math.random()*Math.PI*2}));draw(0)}
function draw(t){ctx.clearRect(0,0,width,height);for(let i=0;i<particles.length;i++){const p=particles[i];if(!reduced)p.y-=p.v*.22;if(p.y< -3)p.y=height+3;const alpha=p.a*(reduced?1:.65+.35*Math.sin(t*.0007+p.phase));ctx.beginPath();ctx.arc(p.x,p.y,p.r,0,Math.PI*2);ctx.fillStyle='rgba(111,183,255,'+alpha+')';ctx.fill();if(i%3===0)for(let j=i+1;j<Math.min(i+5,particles.length);j++){const q=particles[j],dx=p.x-q.x,dy=p.y-q.y,d=Math.hypot(dx,dy);if(d<115){ctx.beginPath();ctx.moveTo(p.x,p.y);ctx.lineTo(q.x,q.y);ctx.strokeStyle='rgba(65,143,230,'+((1-d/115)*.12)+')';ctx.lineWidth=.6;ctx.stroke()}}}if(!reduced)raf=requestAnimationFrame(draw)}
window.addEventListener('resize',resize,{passive:true});resize();if(!reduced)raf=requestAnimationFrame(draw);document.addEventListener('visibilitychange',()=>{if(document.hidden)cancelAnimationFrame(raf);else if(!reduced){cancelAnimationFrame(raf);raf=requestAnimationFrame(draw)}})})();
updateAccountUI();checkPresence();initCookieNotice();setInterval(()=>{if(presenceText){const status=serviceOnline?'Online':'Offline';presenceText.textContent=status+' · active '+duration(Date.now()-sessionStartedAt)}},1000);



