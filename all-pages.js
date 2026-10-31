(()=>{'use strict';
const pages=[
['⌂','Home','Main page','/'],['◉','Our Vision','Studio mission','/Vision/'],['▣','The Game · RSL','Project overview','/RSL/'],['⌘','Systems','Game features','/Systems/'],['↗','Roadmap','Development progress','/Roadmap/'],['?','FAQ','Common questions','/FAQ/'],['✧','Ventorea AI','AI assistant','/?login=required'],['◎','Sign In','Profile and account','/login/'],['✉','Contact','Get in touch','/Contact/'],['✎','Feedback','Share an idea','/Feedback/'],['◌','Support','Help and requests','/Support/'],['◇','Services','Studio services','/Service/'],['◈','Privacy Policy','Personal information','/Privacy/'],['▤','Terms of Service','Website terms','/Terms/'],['◍','Cookie Policy','Browser storage','/Cookies/']];
const header=document.querySelector('.site-header');if(!header)return;

// Secondary pages share the same mobile navigation behavior as the homepage.
const pageNav=header.querySelector('nav');
let pageMenu=header.querySelector('#menu');
const needsPageMenuBinding=!pageMenu;
if(pageNav&&!pageMenu){
  pageMenu=document.createElement('button');
  pageMenu.type='button';pageMenu.id='menu';pageMenu.className='menu';
  pageMenu.setAttribute('aria-label','Open menu');pageMenu.setAttribute('aria-expanded','false');
  pageMenu.setAttribute('aria-controls',pageNav.id||'pageNavigation');
  if(!pageNav.id)pageNav.id='pageNavigation';
  pageMenu.textContent='☰';
  const cta=header.querySelector('.header-cta');
  if(cta)header.insertBefore(pageMenu,cta);else header.appendChild(pageMenu);
}
if(pageMenu&&pageNav&&needsPageMenuBinding&&!pageMenu.dataset.navReady){
  pageMenu.dataset.navReady='true';
  const closePageNav=()=>{pageNav.classList.remove('open');pageMenu.setAttribute('aria-expanded','false');pageMenu.setAttribute('aria-label','Open menu');pageMenu.textContent='☰';};
  pageMenu.addEventListener('click',()=>{
    const open=!pageNav.classList.contains('open');
    pageNav.classList.toggle('open',open);
    pageMenu.setAttribute('aria-expanded',String(open));
    pageMenu.setAttribute('aria-label',open?'Close menu':'Open menu');
    pageMenu.textContent=open?'×':'☰';
  });
  pageNav.querySelectorAll('a').forEach(a=>a.addEventListener('click',closePageNav));
  document.addEventListener('click',event=>{if(pageNav.classList.contains('open')&&!pageNav.contains(event.target)&&!pageMenu.contains(event.target))closePageNav();});
  document.addEventListener('keydown',event=>{if(event.key==='Escape')closePageNav();});
  window.addEventListener('resize',()=>{if(window.innerWidth>900)closePageNav();},{passive:true});
}

// Replace static image wordmarks with accessible live text branding.
document.querySelectorAll('.brand img.brand-logo').forEach(img=>{
  const wordmark=document.createElement('span');
  wordmark.className='brand-wordmark';
  wordmark.setAttribute('role','img');
  wordmark.setAttribute('aria-label','Ventorea Studios');
  wordmark.innerHTML='<span class="brand-wordmark-main"><span class="brand-v">V</span>entorea</span><span class="brand-wordmark-sub"><span class="brand-s">S</span>tudios</span>';
  img.replaceWith(wordmark);
});
let trigger=document.getElementById('allPagesOpen');
if(!trigger){trigger=document.createElement('button');trigger.type='button';trigger.id='allPagesOpen';trigger.className='all-pages-cta';trigger.setAttribute('aria-expanded','false');trigger.setAttribute('aria-controls','allPagesPanel');trigger.innerHTML='<span class="all-pages-icon" aria-hidden="true"><i></i><i></i><i></i><i></i></span><span>ALL PAGES</span><span class="all-pages-arrow" aria-hidden="true">⌄</span>';const cta=header.querySelector('.header-cta');if(cta)header.insertBefore(trigger,cta);else header.appendChild(trigger);}
let panel=document.getElementById('allPagesPanel');
if(!panel){panel=document.createElement('section');panel.id='allPagesPanel';panel.className='all-pages-panel';panel.hidden=true;panel.setAttribute('aria-label','All website pages');panel.innerHTML='<div class="all-pages-heading"><div><span class="all-pages-kicker">VENTOREA STUDIOS</span><h2>All pages</h2><p>Every destination, one menu.</p></div><button type="button" id="allPagesClose" aria-label="Close all pages">✕</button></div><div class="all-pages-grid"></div>';panel.querySelector('.all-pages-grid').innerHTML=pages.map(([icon,title,desc,url])=>'<a href="'+url+'"><span class="all-pages-item-icon" aria-hidden="true">'+icon+'</span><span><b>'+title+'</b><small>'+desc+'</small></span><i aria-hidden="true">↗</i></a>').join('');document.body.appendChild(panel);}
const grid=panel.querySelector('.all-pages-grid');
if(grid){for(const [icon,title,desc,url] of pages){const targetPath=new URL(url,location.origin).pathname;const exists=[...grid.querySelectorAll('a')].some(a=>new URL(a.getAttribute('href'),location.href).pathname===targetPath);if(!exists){const a=document.createElement('a');a.href=url;a.innerHTML='<span class="all-pages-item-icon" aria-hidden="true">'+icon+'</span><span><b>'+title+'</b><small>'+desc+'</small></span><i aria-hidden="true">↗</i>';grid.appendChild(a);}}}
const close=panel.querySelector('#allPagesClose');let closeTimer;
const openPanel=()=>{clearTimeout(closeTimer);panel.hidden=false;trigger.setAttribute('aria-expanded','true');requestAnimationFrame(()=>requestAnimationFrame(()=>panel.classList.add('is-open')));};
const closePanel=(returnFocus=false)=>{panel.classList.remove('is-open');trigger.setAttribute('aria-expanded','false');closeTimer=setTimeout(()=>{panel.hidden=true;},380);if(returnFocus)trigger.focus({preventScroll:true});};
trigger.addEventListener('click',()=>{if(panel.hidden||!panel.classList.contains('is-open'))openPanel();else closePanel();});
close?.addEventListener('click',()=>closePanel(true));panel.querySelectorAll('a').forEach(a=>a.addEventListener('click',()=>closePanel(false)));
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!panel.hidden)closePanel(true);});
document.addEventListener('click',e=>{if(!panel.hidden&&!panel.contains(e.target)&&!trigger.contains(e.target))closePanel(false);});
})();