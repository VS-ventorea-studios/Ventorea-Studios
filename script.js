const menu=document.getElementById('menu');
const nav=document.getElementById('navLinks');
if(menu&&nav){
  menu.setAttribute('aria-expanded','false');
  menu.setAttribute('aria-controls','navLinks');
  menu.addEventListener('click',()=>{
    const open=nav.classList.toggle('open');
    menu.setAttribute('aria-expanded',String(open));
    menu.setAttribute('aria-label',open?'Close menu':'Open menu');
  });
  document.querySelectorAll('#navLinks a').forEach(a=>a.addEventListener('click',()=>{
    nav.classList.remove('open');
    menu.setAttribute('aria-expanded','false');
    menu.setAttribute('aria-label','Open menu');
  }));
}

const launcher=document.getElementById('aiLauncher');
const panel=document.getElementById('aiPanel');
const close=document.getElementById('aiClose');
const messages=document.getElementById('aiMessages');
const form=document.getElementById('aiForm');
const input=document.getElementById('aiInput');
const unreadBadge=document.getElementById('aiUnread');
const presenceText=document.getElementById('aiPresenceText');
const presenceDot=document.getElementById('aiPresenceDot');
const chat=[];
const MAX_HISTORY=12;
const MAX_MESSAGE_LENGTH=2000;
const AI_ENDPOINT='/api/chat';
let unreadCount=0;
let lastUserMessage=null;

function setUnread(count){
  unreadCount=Math.max(0,count);
  if(unreadBadge){
    unreadBadge.hidden=unreadCount===0;
    unreadBadge.textContent=unreadCount>9?'9+':String(unreadCount);
  }
  if(launcher)launcher.setAttribute('aria-label',unreadCount? `Open Ventorea AI, ${unreadCount} unread ${unreadCount===1?'message':'messages'}`:'Open Ventorea AI');
}
function setPresence(online,label){
  if(presenceText)presenceText.textContent=label;
  if(presenceDot){
    presenceDot.classList.toggle('is-online',online);
    presenceDot.classList.toggle('is-offline',!online);
  }
}
async function checkPresence(){
  try{
    const response=await fetch(AI_ENDPOINT,{method:'GET',cache:'no-store'});
    const data=await response.json().catch(()=>({}));
    const serviceReady=response.ok&&data.ok===true&&data.keyConfigured===true;
    const needsSetup=response.ok&&data.ok===true&&data.keyConfigured===false;
    setPresence(serviceReady,serviceReady?'Online':needsSetup?'Setup needed':'Offline');
    if(presenceText&&needsSetup)presenceText.title='Add GEMINI_API_KEY in Vercel project settings to enable replies.';
  }catch{
    setPresence(false,'Offline');
  }
}
function aiOpen(){
  panel.classList.add('open');
  panel?.setAttribute('aria-hidden','false');
  launcher?.setAttribute('aria-expanded','true');
  setUnread(0);
  setTimeout(()=>input?.focus(),100);
}
function aiClose(){
  panel.classList.remove('open');
  panel?.setAttribute('aria-hidden','true');
  launcher?.setAttribute('aria-expanded','false');
  launcher?.focus();
}
if(launcher){
  launcher.setAttribute('aria-controls','aiPanel');
  launcher.setAttribute('aria-expanded','false');
  launcher.onclick=()=>panel?.classList.contains('open')?aiClose():aiOpen();
}
if(close)close.onclick=aiClose;

function add(text,type){
  const p=document.createElement('p');
  p.className=type;
  p.textContent=text;
  messages.appendChild(p);
  messages.scrollTop=messages.scrollHeight;
  return p;
}
async function sendToAI(){
  const q=input.value.trim().slice(0,MAX_MESSAGE_LENGTH);
  if(!q||input.disabled)return;
  const userBubble=add(q,'user');
  const receipt=document.createElement('small');
  receipt.className='ai-receipt';
  receipt.textContent='Sent ✓';
  userBubble.appendChild(receipt);
  lastUserMessage={bubble:userBubble,receipt};
  chat.push({role:'user',content:q});
  while(chat.length>MAX_HISTORY)chat.shift();
  input.value='';
  input.disabled=true;
  const submit=form?.querySelector('button[type="submit"],button:not([type])');
  if(submit)submit.disabled=true;
  const loading=add('Thinking…','bot');
  try{
    const response=await fetch(AI_ENDPOINT,{
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify({messages:chat})
    });
    const data=await response.json().catch(()=>({}));
    loading.remove();
    if(!response.ok)throw new Error(typeof data.error==='string'?data.error:`Ventorea AI returned HTTP ${response.status}.`);
    const answer=typeof data.content==='string'?data.content.trim():'';
    add(answer||'Ventorea AI returned an empty response.','bot');
    if(answer){
      chat.push({role:'assistant',content:answer.slice(0,MAX_MESSAGE_LENGTH)});
      while(chat.length>MAX_HISTORY)chat.shift();
      if(lastUserMessage?.receipt)lastUserMessage.receipt.textContent='Read ✓✓';
      if(!panel?.classList.contains('open'))setUnread(unreadCount+1);
    }
  }catch(error){
    loading.remove();
    if(lastUserMessage?.receipt)lastUserMessage.receipt.textContent='Not sent';
    add(error?.message||'Ventorea AI could not be reached. Please try again.','bot');
    console.error('Ventorea AI request failed:',error);
    checkPresence();
  }finally{
    input.disabled=false;
    if(submit)submit.disabled=false;
    if(panel?.classList.contains('open'))input.focus();
  }
}
if(form)form.addEventListener('submit',e=>{e.preventDefault();sendToAI()});
checkPresence();
document.querySelectorAll('.faq details').forEach(d=>d.addEventListener('toggle',()=>{
  if(d.open)document.querySelectorAll('.faq details').forEach(other=>{
    if(other!==d)other.removeAttribute('open');
  });
}));

document.addEventListener('keydown',event=>{
  if(event.key!=='Escape')return;
  if(panel?.classList.contains('open'))aiClose();
  const feedback=document.getElementById('feedbackModal');
  if(feedback?.classList.contains('open'))document.getElementById('feedbackClose')?.click();
  const support=document.getElementById('supportModal');
  if(support?.classList.contains('open'))document.getElementById('supportClose')?.click();
});

// Subtle animated starfield for the dark-blue live background.
(()=>{
  const canvas=document.getElementById('ambientCanvas');
  if(!canvas)return;
  const ctx=canvas.getContext('2d',{alpha:true});
  if(!ctx)return;
  let width=0,height=0,dpr=1,raf=0;
  const reduced=window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  let particles=[];
  function resize(){
    dpr=Math.min(window.devicePixelRatio||1,2);
    width=window.innerWidth;height=window.innerHeight;
    canvas.width=Math.floor(width*dpr);canvas.height=Math.floor(height*dpr);
    ctx.setTransform(dpr,0,0,dpr,0,0);
    const count=Math.min(85,Math.max(28,Math.floor(width*height/19000)));
    particles=Array.from({length:count},()=>({x:Math.random()*width,y:Math.random()*height,r:.5+Math.random()*1.5,a:.15+Math.random()*.55,v:.08+Math.random()*.28,phase:Math.random()*Math.PI*2}));
    draw(0);
  }
  function draw(t){
    ctx.clearRect(0,0,width,height);
    for(let i=0;i<particles.length;i++){
      const p=particles[i];
      if(!reduced)p.y-=p.v*.22;
      if(p.y< -3)p.y=height+3;
      const alpha=p.a*(reduced?1:.65+.35*Math.sin(t*.0007+p.phase));
      ctx.beginPath();ctx.arc(p.x,p.y,p.r,0,Math.PI*2);
      ctx.fillStyle='rgba(111,183,255,'+alpha+')';ctx.fill();
      if(i%3===0){
        for(let j=i+1;j<Math.min(i+5,particles.length);j++){
          const q=particles[j],dx=p.x-q.x,dy=p.y-q.y,d=Math.hypot(dx,dy);
          if(d<115){ctx.beginPath();ctx.moveTo(p.x,p.y);ctx.lineTo(q.x,q.y);ctx.strokeStyle='rgba(65,143,230,'+((1-d/115)*.12)+')';ctx.lineWidth=.6;ctx.stroke();}
        }
      }
    }
    if(!reduced)raf=requestAnimationFrame(draw);
  }
  window.addEventListener('resize',resize,{passive:true});
  resize();
  if(!reduced)raf=requestAnimationFrame(draw);
  document.addEventListener('visibilitychange',()=>{if(document.hidden)cancelAnimationFrame(raf);else if(!reduced){cancelAnimationFrame(raf);raf=requestAnimationFrame(draw)}});
})();
