/* Mister Cluber — solicitações de segundo clube; mantém conta e vínculos existentes. */
(function(){
'use strict';
var requests=[];
var publicClubs=[];
var isReady=function(){return !!(typeof sb!=='undefined'&&sb&&typeof _authUser!=='undefined'&&_authUser&&typeof DB!=='undefined'&&DB&&DB.cur)};
function safe(x){return String(x==null?'':x).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]})}
function notice(x){if(typeof note==='function')note(x);else alert(x)}
async function loadMine(){
 if(!isReady())return [];
 var out=await sb.from('cm_multi_club_requests').select('id,club_id,status,requested_at').eq('user_id',_authUser.id);
 if(out.error)throw out.error;return out.data||[];
}
async function loadClubs(){
 var out=await sb.rpc('cm_signup_clubs');
 if(out.error)throw out.error;return out.data||[];
}
window.cmOpenSecondClubRequest=async function(){
 if(!isReady())return notice('Entre na sua conta para solicitar outro clube.');
 var d=document.getElementById('dlg');
 if(!d)return;
 d.innerHTML='<h2>Solicitar acesso a outro clube</h2><p class="mute">Sua participação no clube atual continuará ativa. Uma nova aprovação será necessária.</p><div id="cmSecondClubContent">Carregando...</div><div class="row" style="justify-content:flex-end;margin-top:16px"><button class="btn ghost" type="button" id="cmSecondClose">Fechar</button></div>';
 d.showModal();d.querySelector('#cmSecondClose').onclick=function(){d.close()};
 try{
  var data=await Promise.all([loadClubs(),loadMine()]);
  publicClubs=data[0];var pending=data[1];
  var joined=new Set((_members||[]).filter(function(m){return m.status==='active'}).map(function(m){return m.club_id}));
  var available=publicClubs.filter(function(c){return !joined.has(c.id)});
  var info=pending.map(function(r){
   var cl=publicClubs.find(function(c){return c.id===r.club_id});
   return '<div style="margin:6px 0;padding:9px;border:1px solid var(--line);border-radius:8px">'+safe(cl?cl.name:'Clube')+' · <b>'+safe(r.status==='pending'?'Aguardando aprovação':r.status==='approved'?'Aprovado — atualize a página':'Recusado')+'</b></div>'
  }).join('');
  var el=d.querySelector('#cmSecondClubContent');if(!el)return;
  el.innerHTML=(info?'<h3>Minhas solicitações</h3>'+info:'')+
   (available.length?'<label for="cmSecondTarget">Clube desejado</label><select id="cmSecondTarget">'+available.map(function(c){return '<option value="'+safe(c.id)+'">'+safe(c.name)+'</option>'}).join('')+'</select><p class="mute">Função solicitada: Jogador</p><button class="btn" type="button" id="cmSecondSend" style="width:100%">Enviar solicitação</button>':'<p class="mute">Nenhum outro clube disponível.</p>');
  var b=d.querySelector('#cmSecondSend');if(b)b.onclick=async function(){
   b.disabled=true;
   try{
    var target=d.querySelector('#cmSecondTarget').value;
    if(!available.some(function(c){return c.id===target}))throw new Error('Clube inválido');
    var sent=await sb.rpc('cm_request_second_club',{p_club:target});
    if(sent.error)throw sent.error;
    d.close();notice('Solicitação enviada ao administrador do clube. Seu acesso atual foi mantido.');
   }catch(e){notice(e.message||'Não foi possível enviar a solicitação.');b.disabled=false}
  };
 }catch(e){var el=d.querySelector('#cmSecondClubContent');if(el)el.textContent='Falha ao carregar clubes: '+(e.message||'tente novamente')}
};
var priorSwitchers=switchers;
switchers=function(){
 var old=priorSwitchers();
 if(!isReady())return old;
 var members=(_members||[]).filter(function(m){return m.status==='active'&&DB.clubs[m.club_id]});
 var selector='';
 if(members.length>1&&!isActualAdmin()){
  selector='<label style="color:inherit">Meus clubes</label><select aria-label="Alternar clube" style="background:var(--surface);color:var(--ink)" onchange="switchClub(this.value)">'+members.map(function(m){return '<option value="'+safe(m.club_id)+'" '+(DB.cur===m.club_id?'selected':'')+'>'+safe(DB.clubs[m.club_id].club.name)+' · '+safe(m.role)+'</option>'}).join('')+'</select>';
 }
 return (selector||'')+old+'<button type="button" class="btn ghost sm" style="width:100%;margin-top:10px;background:var(--surface);color:var(--ink)" onclick="cmOpenSecondClubRequest()">＋ Solicitar acesso a outro clube</button>';
};
async function drawSecondClubApprovals(){
 var slot=document.getElementById('cmSecondApprovals');
 if(!slot||!isReady()||!isActualAdmin())return;
 try{
  var r=await sb.rpc('cm_second_club_pending');if(r.error)throw r.error;
  if(!(isSystemOwner()&&S&&S.club&&S.club.demo))r.data=(r.data||[]).filter(function(x){return x.club_id===DB.cur});
  if(!slot.isConnected)return;
  var rows=r.data||[];
  if(!rows.length){slot.innerHTML='<h3>Solicitações de outros clubes</h3><p class="mute">Nenhuma solicitação pendente.</p>';return}
  slot.innerHTML='<h3>Solicitações de outros clubes ('+rows.length+')</h3>'+rows.map(function(v){
   var club=DB.clubs[v.club_id];
   return '<div class="row" style="justify-content:space-between;gap:10px;padding:12px 0;border-bottom:1px solid var(--line)"><div><b>'+safe(v.full_name||v.email||'Jogador')+'</b><br><small class="mute">Clube: '+safe(club?club.club.name:'Clube solicitado')+' · Jogador</small></div><div class="row"><button class="btn sm" onclick="cmReviewSecondClub(\''+safe(v.id)+'\',true)">Aprovar</button><button class="btn ghost sm" onclick="cmReviewSecondClub(\''+safe(v.id)+'\',false)">Recusar</button></div></div>'
  }).join('');
 }catch(e){if(slot.isConnected)slot.innerHTML='<h3>Solicitações de outros clubes</h3><p class="neg">'+safe(e.message||'Falha ao carregar')+'</p>'}
}
window.cmReviewSecondClub=async function(id,approve){
 if(!isReady()||!isActualAdmin())return;
 if(!confirm(approve?'Aprovar acesso deste jogador ao clube solicitado?':'Recusar solicitação deste jogador?'))return;
 try{
  var r=await sb.rpc('cm_review_second_club',{p_request:id,p_approve:!!approve});
  if(r.error)throw r.error;
  await drawSecondClubApprovals();
  notice(approve?'Jogador aprovado. Ele poderá acessar este clube ao atualizar o sistema.':'Solicitação recusada.');
 }catch(e){notice(e.message||'Não foi possível analisar a solicitação.')}
};
var priorRender=render;
render=function(){
 var out=priorRender.apply(this,arguments);
 if(view==='access'&&isActualAdmin()){
  var main=document.getElementById('main');
  if(main&&!document.getElementById('cmSecondApprovals')){
   var slot=document.createElement('div');
   slot.id='cmSecondApprovals';slot.className='card';slot.style.marginTop='16px';slot.textContent='Carregando solicitações de outros clubes...';
   var accessRequestsCard=main.querySelector('.cm-pending');
   if(accessRequestsCard){accessRequestsCard.insertAdjacentElement('afterend',slot)}
   else{main.appendChild(slot)}
  }
  drawSecondClubApprovals();
 }
 return out;
};
})();