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
const DEMO_EMAIL='demo@ventorea.studio';
const DEMO_PASSWORD='VentoreaDemo2026!';
const DEMO_KEY='ventorea-demo-session';
const $=id=>document.getElementById(id);
const launcher=$('aiMenuOpen'),panel=$('aiPanel'),close=$('aiClose'),messages=$('aiMessages'),form=$('aiForm'),input=$('aiInput'),unreadBadge=$('aiUnread'),presenceText=$('aiPresenceText'),presenceDot=$('aiPresenceDot'),menuPresence=$('aiMenuStatus');
const demoModal=$('demoModal'),demoLoginForm=$('demoLoginForm'),demoEmail=$('demoEmail'),demoPassword=$('demoPassword'),demoStatus=$('demoStatus'),accountOpen=$('accountOpen');
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

function isDemoSignedIn(){try{return sessionStorage.getItem(DEMO_KEY)==='signed-in'}catch{return false}}
function updateAccountUI(){
  const signed=isDemoSignedIn();
  if(accountOpen){accountOpen.innerHTML=signed?'DEMO ACCOUNT <span>✓</span>':'DEMO SIGN IN <span>↗</span>';accountOpen.setAttribute('aria-label',signed?'Open demo account settings':'Sign in to the demo account')}
  if($('demoSignOut'))$('demoSignOut').hidden=!signed;
  if(input){input.disabled=!signed;input.placeholder=signed?'Message Ventorea AI…':'Sign in to use Ventorea AI'}
  if(signed&&demoStatus){demoStatus.textContent='Signed in to the public demo account for this tab.';demoStatus.className='form-status success'}
}
function showModal(el){if(!el)return;el.classList.add('open');el.setAttribute('aria-hidden','false')}
function hideModal(el){if(!el)return;el.classList.remove('open');el.setAttribute('aria-hidden','true')}
function openDemo(){updateAccountUI();showModal(demoModal);setTimeout(()=>demoEmail?.focus(),80)}
function signOut(){try{sessionStorage.removeItem(DEMO_KEY)}catch{};chat.length=0;saveChatHistory();if(messages)messages.replaceChildren();add('Sign in to the public demo account to start chatting with Ventorea AI.','bot');hideModal(demoModal);hideModal(panel);panel?.classList.remove('open');updateAccountUI();setPresence(serviceOnline,serviceOnline?'Online · active '+duration(Date.now()-sessionStartedAt):'Offline · active '+duration(Date.now()-sessionStartedAt))}
function aiOpen(){if(!isDemoSignedIn()){openDemo();if(demoStatus){demoStatus.textContent='Sign in with the public demo account to unlock Ventorea AI.';demoStatus.className='form-status error'}return}renderSavedChat();panel?.classList.add('open');panel?.setAttribute('aria-hidden','false');launcher?.setAttribute('aria-expanded','true');setUnread(0);setTimeout(()=>input?.focus({preventScroll:true}),100)}
function aiClose(){panel?.classList.remove('open');panel?.setAttribute('aria-hidden','true');launcher?.setAttribute('aria-expanded','false');launcher?.focus()}
function setUnread(count){unreadCount=Math.max(0,count);if(unreadBadge){unreadBadge.hidden=unreadCount===0;unreadBadge.textContent=unreadCount>9?'9+':String(unreadCount)}if(launcher)launcher.setAttribute('aria-label',unreadCount?('Open Ventorea AI, '+unreadCount+' unread messages'):'Open Ventorea AI')}
function setPresence(online,label){if(presenceText)presenceText.textContent=label;if(presenceDot){presenceDot.classList.toggle('is-online',online);presenceDot.classList.toggle('is-offline',!online)}if(menuPresence){menuPresence.textContent=online?'ONLINE':'OFFLINE';menuPresence.classList.toggle('is-online',online);menuPresence.classList.toggle('is-offline',!online)}}
function duration(ms){const sec=Math.max(0,Math.floor(ms/1000)),h=Math.floor(sec/3600),m=Math.floor((sec%3600)/60),s=sec%60;return h?String(h).padStart(2,'0')+':'+String(m).padStart(2,'0')+':'+String(s).padStart(2,'0'):String(m).padStart(2,'0')+':'+String(s).padStart(2,'0')}
async function checkPresence(){
  try{const response=await fetch(AI_ENDPOINT,{method:'GET',cache:'no-store'});const data=await response.json().catch(()=>({}));serviceOnline=response.ok&&data.ok===true&&data.keyConfigured===true;const needsSetup=response.ok&&data.ok===true&&data.keyConfigured===false;setPresence(serviceOnline,serviceOnline?'Online · active '+duration(Date.now()-sessionStartedAt):needsSetup?'Setup needed':'Offline · active '+duration(Date.now()-sessionStartedAt));if(needsSetup&&presenceText)presenceText.title='The server needs its AI API key configured.'}
  catch{serviceOnline=false;setPresence(false,'Offline · active '+duration(Date.now()-sessionStartedAt))}
}
renderSavedChat();
if(launcher){launcher.setAttribute('aria-controls','aiPanel');launcher.setAttribute('aria-expanded','false');launcher.onclick=()=>panel?.classList.contains('open')?aiClose():aiOpen()}
close?.addEventListener('click',aiClose);accountOpen?.addEventListener('click',openDemo);$('demoSettingsOpen')?.addEventListener('click',openDemo);
$('demoClose')?.addEventListener('click',()=>hideModal(demoModal));
$('fillDemoCredentials')?.addEventListener('click',()=>{if(demoEmail)demoEmail.value=DEMO_EMAIL;if(demoPassword)demoPassword.value=DEMO_PASSWORD;if(demoStatus){demoStatus.textContent='Demo credentials filled. Sign in to continue.';demoStatus.className='form-status'}});
$('demoSignOut')?.addEventListener('click',signOut);
demoLoginForm?.addEventListener('submit',e=>{
  e.preventDefault();
  if(demoEmail?.value.trim().toLowerCase()===DEMO_EMAIL&&demoPassword?.value===DEMO_PASSWORD){
    try{sessionStorage.setItem(DEMO_KEY,'signed-in')}catch{}
    if(demoStatus){demoStatus.textContent='Demo sign-in successful. Ventorea AI is unlocked for this tab.';demoStatus.className='form-status success'}
    updateAccountUI();setTimeout(()=>{hideModal(demoModal);aiOpen()},350);
  }else if(demoStatus){demoStatus.textContent='Those details do not match the public demo account. Use “Fill demo credentials”.';demoStatus.className='form-status error'}
});
function add(text,type){
  if(!messages)return null;const p=document.createElement('p');p.className=type;p.textContent=text;messages.appendChild(p);messages.scrollTop=messages.scrollHeight;return p;
}
async function sendToAI(){
  if(!isDemoSignedIn()){openDemo();return}
  const q=input?.value.trim().slice(0,MAX_MESSAGE_LENGTH);if(!q||input.disabled)return;
  const userBubble=add(q,'user'),receipt=document.createElement('small');receipt.className='ai-receipt';receipt.textContent='Sent ✓';userBubble?.appendChild(receipt);
  chat.push({role:'user',content:q});while(chat.length>MAX_HISTORY)chat.shift();saveChatHistory();input.value='';input.disabled=true;
  const submit=form?.querySelector('button[type="submit"],button:not([type])');if(submit)submit.disabled=true;
  const loading=add('Thinking…','bot');
  try{
    const response=await fetch(AI_ENDPOINT,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({messages:chat,demoSession:true,demoUser:DEMO_EMAIL})});
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
document.addEventListener('keydown',event=>{if(event.key!=='Escape')return;if(panel?.classList.contains('open'))aiClose();if(demoModal?.classList.contains('open'))hideModal(demoModal);['feedbackModal','supportModal'].forEach(id=>{const el=$(id);if(el?.classList.contains('open'))hideModal(el)})});
[demoModal,$('feedbackModal'),$('supportModal')].forEach(el=>el?.addEventListener('click',e=>{if(e.target===el)hideModal(el)}));

// Animated connected starfield for the midnight-blue background.
(()=>{const canvas=$('ambientCanvas');if(!canvas)return;const ctx=canvas.getContext('2d',{alpha:true});if(!ctx)return;let width=0,height=0,dpr=1,raf=0;const reduced=window.matchMedia('(prefers-reduced-motion: reduce)').matches;let particles=[];
function resize(){dpr=Math.min(window.devicePixelRatio||1,2);width=window.innerWidth;height=window.innerHeight;canvas.width=Math.floor(width*dpr);canvas.height=Math.floor(height*dpr);ctx.setTransform(dpr,0,0,dpr,0,0);const count=Math.min(85,Math.max(28,Math.floor(width*height/19000)));particles=Array.from({length:count},()=>({x:Math.random()*width,y:Math.random()*height,r:.5+Math.random()*1.5,a:.15+Math.random()*.55,v:.08+Math.random()*.28,phase:Math.random()*Math.PI*2}));draw(0)}
function draw(t){ctx.clearRect(0,0,width,height);for(let i=0;i<particles.length;i++){const p=particles[i];if(!reduced)p.y-=p.v*.22;if(p.y< -3)p.y=height+3;const alpha=p.a*(reduced?1:.65+.35*Math.sin(t*.0007+p.phase));ctx.beginPath();ctx.arc(p.x,p.y,p.r,0,Math.PI*2);ctx.fillStyle='rgba(111,183,255,'+alpha+')';ctx.fill();if(i%3===0)for(let j=i+1;j<Math.min(i+5,particles.length);j++){const q=particles[j],dx=p.x-q.x,dy=p.y-q.y,d=Math.hypot(dx,dy);if(d<115){ctx.beginPath();ctx.moveTo(p.x,p.y);ctx.lineTo(q.x,q.y);ctx.strokeStyle='rgba(65,143,230,'+((1-d/115)*.12)+')';ctx.lineWidth=.6;ctx.stroke()}}}if(!reduced)raf=requestAnimationFrame(draw)}
window.addEventListener('resize',resize,{passive:true});resize();if(!reduced)raf=requestAnimationFrame(draw);document.addEventListener('visibilitychange',()=>{if(document.hidden)cancelAnimationFrame(raf);else if(!reduced){cancelAnimationFrame(raf);raf=requestAnimationFrame(draw)}})})();
updateAccountUI();checkPresence();initCookieNotice();setInterval(()=>{if(presenceText){const status=serviceOnline?'Online':'Offline';presenceText.textContent=status+' · active '+duration(Date.now()-sessionStartedAt)}},1000);



