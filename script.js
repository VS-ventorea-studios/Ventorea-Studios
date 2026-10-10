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
const chat=[];
const MAX_HISTORY=12;
const MAX_MESSAGE_LENGTH=2000;
const AI_ENDPOINT='/api/chat';

function aiOpen(){
  panel.classList.add('open');
  launcher?.setAttribute('aria-expanded','true');
  setTimeout(()=>input?.focus(),100);
}
function aiClose(){
  panel.classList.remove('open');
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
  if(!q)return;
  if(input.disabled)return;
  add(q,'user');
  chat.push({role:'user',content:q});
  // Keep only recent turns so browser memory and payload size remain bounded.
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
    }
  }catch(error){
    loading.remove();
    add(error?.message||'Ventorea AI could not be reached. Please try again.','bot');
    console.error('Ventorea AI request failed:',error);
  }finally{
    input.disabled=false;
    if(submit)submit.disabled=false;
    input.focus();
  }
}
if(form)form.addEventListener('submit',e=>{e.preventDefault();sendToAI()});
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