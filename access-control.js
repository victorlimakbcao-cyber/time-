(function(){
'use strict';

var SIGNUP_ROLES=['Jogador','Staff','Técnico','Auxiliar técnico','Comissão técnica','Diretor','Tesoureiro','Resp. estatísticas','Resp. súmula'];
window._cmSignupClubs=window._cmSignupClubs||[];

ICONS.access='<circle cx="9" cy="8" r="3.5"/><path d="M2 20c0-4 3-6 7-6s7 2 7 6M17 5a3 3 0 010 6M18 14v6M15 17h6"/>';
if(!NAV.some(function(x){return x[0]==='access'}))NAV.push(['access','Controle de acesso']);

function ensureAccessPerms(){
  Object.values(DB.clubs||{}).forEach(function(cl){
    if(!cl||!cl.perms)return;
    ['Dono','Presidente','Vice-presidente'].forEach(function(r){
      if(cl.perms[r])cl.perms[r].access={view:true,create:true,edit:true,delete:true};
    });
    Object.keys(cl.perms).forEach(function(r){
      if(!['Dono','Presidente','Vice-presidente'].includes(r))cl.perms[r].access={view:false,create:false,edit:false,delete:false};
    });
  });
}
ensureAccessPerms();

function insertSignupFields(){
  if(document.getElementById('cmSignupClub'))return;
  var email=document.getElementById('cmSignupEmail');
  if(!email)return;
  var err=document.getElementById('cmErrEmail');
  var host=(err&&err.parentNode)||email.parentNode;
  var wrap=document.createElement('div');
  wrap.id='cmSignupAccessFields';
  wrap.innerHTML=
    '<label for="cmSignupClub">Clube que deseja acessar</label>'+
    '<select id="cmSignupClub" onchange="cmValidateSignup()"><option value="">Carregando clubes...</option></select>'+
    '<div id="cmErrClub" class="cm-field-error"></div>'+
    '<label for="cmSignupRole">Função desejada</label>'+
    '<select id="cmSignupRole" onchange="cmValidateSignup()">'+
      SIGNUP_ROLES.map(function(r){return '<option>'+esc(r)+'</option>'}).join('')+
    '</select>'+
    '<p class="cm-auth-help">Seu acesso só será liberado após aprovação do responsável pelo clube escolhido.</p>';
  if(err&&err.nextSibling)host.insertBefore(wrap,err.nextSibling); else host.appendChild(wrap);
}

function renderSignupClubs(){
  insertSignupFields();
  var s=document.getElementById('cmSignupClub');
  if(!s)return;
  var cur=s.value;
  s.innerHTML='<option value="">Selecione um clube</option>'+window._cmSignupClubs.map(function(x){
    return '<option value="'+esc(x.id)+'">'+esc(x.name)+(x.sigla?' · '+esc(x.sigla):'')+'</option>';
  }).join('');
  if(cur&&window._cmSignupClubs.some(function(x){return x.id===cur}))s.value=cur;
}

window.cmLoadSignupClubs=async function(){
  if(!sb)return[];
  try{
    var res=await sb.rpc('cm_signup_clubs');
    if(res.error)throw res.error;
    window._cmSignupClubs=res.data||[];
    renderSignupClubs();
    return window._cmSignupClubs;
  }catch(e){
    console.warn('Falha ao carregar clubes para cadastro:',e);
    window._cmSignupClubs=[];
    insertSignupFields();
    var s=document.getElementById('cmSignupClub');
    if(s)s.innerHTML='<option value="">Clubes indisponíveis no momento</option>';
    return[];
  }
};

var baseAuthSetMode=cmAuthSetMode;
cmAuthSetMode=function(mode){
  baseAuthSetMode(mode);
  if(mode==='signup'){
    insertSignupFields();
    if(!window._cmSignupClubs.length)cmLoadSignupClubs(); else renderSignupClubs();
  }
};

cmValidateSignup=function(){
  var first=(document.getElementById('cmAuthFirst')?.value||'').trim();
  var last=(document.getElementById('cmAuthLast')?.value||'').trim();
  var email=(document.getElementById('cmSignupEmail')?.value||'').trim().toLowerCase();
  var club=document.getElementById('cmSignupClub')?.value||'';
  var password=document.getElementById('cmSignupPassword')?.value||'';
  var confirm=document.getElementById('cmSignupConfirm')?.value||'';
  var ok=true;
  cmSignupFieldError('cmErrFirst',first.length>=2?'':'Informe seu nome.');if(first.length<2)ok=false;
  cmSignupFieldError('cmErrLast',last.length>=2?'':'Informe seu sobrenome.');if(last.length<2)ok=false;
  cmSignupFieldError('cmErrEmail',cmValidEmail(email)?'':'Informe um e-mail válido.');if(!cmValidEmail(email))ok=false;
  cmSignupFieldError('cmErrClub',club&&window._cmSignupClubs.some(function(x){return x.id===club})?'':'Selecione o clube que deseja acessar.');if(!club||!window._cmSignupClubs.some(function(x){return x.id===club}))ok=false;
  cmSignupFieldError('cmErrPassword',password.length>=6?'':'Use pelo menos 6 caracteres.');if(password.length<6)ok=false;
  cmSignupFieldError('cmErrConfirm',confirm===password&&confirm.length>=6?'':'As senhas precisam ser iguais.');if(confirm!==password||confirm.length<6)ok=false;
  var b=document.getElementById('cmAuthSignup');if(b)b.disabled=!ok||_signupBusy;
  return ok;
};

cmAuthSubmit=async function(mode){
  if(!sb)return cmAuthMsg('Não foi possível iniciar a conexão com o Supabase.','bad');
  if(mode==='signin'){
    var email=(document.getElementById('cmAuthEmail')?.value||'').trim().toLowerCase();
    var password=document.getElementById('cmAuthPassword')?.value||'';
    if(!email)return cmAuthMsg('Informe seu e-mail.','bad');
    if(password.length<6)return cmAuthMsg('Informe sua senha.','bad');
    cmAuthBusy(true);cmAuthMsg('Entrando...');
    try{
      var login=await sb.auth.signInWithPassword({email:email,password:password});
      if(login.error)throw login.error;
      rememberAccount(email);
      if(login.data.session){cmAuthShow(login.data.session);_sbLoaded=false;await loadSupabase();render();}
    }catch(e){
      var msg=String(e&&e.message||'');
      if(/invalid login credentials/i.test(msg))cmAuthMsg('E-mail ou senha incorretos.','bad');
      else if(/email not confirmed/i.test(msg))cmAuthMsg('Confirme seu e-mail pelo link enviado antes de entrar.','bad');
      else cmAuthMsg(msg||'Não foi possível entrar.','bad');
    }finally{cmAuthBusy(false)}
    return;
  }

  insertSignupFields();
  var first=(document.getElementById('cmAuthFirst')?.value||'').trim();
  var last=(document.getElementById('cmAuthLast')?.value||'').trim();
  var email2=(document.getElementById('cmSignupEmail')?.value||'').trim().toLowerCase();
  var requestedClub=document.getElementById('cmSignupClub')?.value||'';
  var requestedRole=document.getElementById('cmSignupRole')?.value||'Jogador';
  var password2=document.getElementById('cmSignupPassword')?.value||'';
  if(!cmValidateSignup())return cmAuthMsg('Revise os campos destacados antes de continuar.','bad');
  if(_signupBusy)return;
  _signupBusy=true;cmAuthBusy(true);
  var sbt=document.getElementById('cmAuthSignup');if(sbt)sbt.textContent='Enviando e-mail...';
  cmAuthMsg('Criando sua conta e enviando o e-mail de confirmação...');
  try{
    var fullName=(first+' '+last).trim();
    var signup=await sb.auth.signUp({
      email:email2,password:password2,
      options:{
        data:{first_name:first,last_name:last,full_name:fullName,requested_club_id:requestedClub,requested_role:requestedRole},
        emailRedirectTo:location.origin
      }
    });
    if(signup.error)throw signup.error;
    rememberAccount(email2);
    _pendingSignupEmail=email2;
    try{localStorage.setItem('cm_pending_signup_email',email2)}catch(_){}
    cmSignupCooldown(75);
    if(signup.data.session){
      await sb.auth.signOut({scope:'local'});
      cmAuthMsg('Seu e-mail já estava confirmado. Entre novamente para continuar.','ok');
      cmAuthSetMode('signin');return;
    }
    var lab=document.getElementById('cmVerifyEmail');if(lab)lab.textContent=email2;
    cmAuthSetMode('verify');
    var clubName=(window._cmSignupClubs.find(function(x){return x.id===requestedClub})||{}).name||'clube escolhido';
    cmAuthMsg('E-mail enviado. Depois de confirmar, sua solicitação irá para '+clubName+' como '+requestedRole+'.','ok');
  }catch(e){
    var msg2=String(e&&e.message||'');
    if(/rate limit|too many requests/i.test(msg2)){
      cmSignupCooldown(120);
      cmAuthMsg('Não foi possível enviar o e-mail agora. O Supabase atingiu temporariamente o limite de envio. Seu formulário foi preservado; aguarde e tente novamente depois.','bad');
    }else cmAuthMsg(msg2||'Não foi possível criar a conta.','bad');
  }finally{
    _signupBusy=false;cmAuthBusy(false);
    if(sbt)sbt.textContent='Continuar';
    cmValidateSignup();
  }
};

cmLoadAccessRequests=async function(){
  if(!sb||!isActualAdmin()){_accessRequests=[];return[]}
  var globalOwner=isSystemOwner()&&S&&S.club&&S.club.demo;
  var q=sb.from('cm_access_requests')
    .select('id,user_id,email,full_name,status,requested_at,reviewed_at,assigned_club_id,assigned_role,requested_club_id,requested_role,note')
    .in('status',['pending','approved'])
    .order('requested_at',{ascending:true});
  if(!globalOwner)q=q.eq('requested_club_id',DB.cur);
  var res=await q;
  if(res.error)throw res.error;
  _accessRequests=(res.data||[]).filter(function(r){return r.status==='pending'||(globalOwner&&r.status==='approved'&&!r.assigned_club_id)});
  return _accessRequests;
};

cmApproveAccess=function(id){
  if(!isActualAdmin())return note('Somente Dono, Presidente ou Vice-presidente podem aprovar acessos.');
  var r=_accessRequests.find(function(x){return x.id===id});if(!r)return;
  var globalOwner=isSystemOwner()&&S.club&&S.club.demo;
  var clubs=globalOwner?Object.entries(DB.clubs).filter(function(x){return !x[1].club.demo}).map(function(x){return [x[0],x[1].club.name]}):[[DB.cur,S.club.name]];
  if(!clubs.length)return note('Nenhum clube disponível para vincular este usuário.');
  var defaultClub=(r.requested_club_id&&DB.clubs[r.requested_club_id])?r.requested_club_id:clubs[0][0];
  var targetState=DB.clubs[defaultClub]||S;
  var roles=Object.keys(targetState.perms||{}).filter(function(x){return x!=='Dono'});
  var defaultRole=roles.includes(r.requested_role)?r.requested_role:'Jogador';
  modal('Aprovar usuário',[
    {k:'club',l:'Clube',t:'sel',o:clubs,v:defaultClub},
    {k:'role',l:'Função',t:'sel',o:roles,v:defaultRole}
  ],function(v){
    (async function(){
      try{
        if(!globalOwner&&v.club!==DB.cur)throw new Error('Você só pode aprovar usuários para o clube atual.');
        var clubState=DB.clubs[v.club];if(!clubState)throw new Error('Clube inválido');
        var mem=await sb.from('cm_members').upsert({
          club_id:v.club,user_id:r.user_id,role:v.role,status:'active',
          display_name:r.full_name||r.email,email:r.email,permissions:{}
        },{onConflict:'club_id,user_id'});
        if(mem.error)throw mem.error;
        var req=await sb.from('cm_access_requests').update({
          status:'approved',reviewed_at:new Date().toISOString(),reviewed_by:_authUser.id,
          assigned_club_id:v.club,assigned_role:v.role,note:null
        }).eq('id',r.id);
        if(req.error)throw req.error;
        await cmLoadAccessRequests();
        await cmLoadClubMembers(DB.cur);
        if(typeof cmLoadGlobalMembers==='function'&&isSystemOwner())await cmLoadGlobalMembers();
        render();toast('Usuário aprovado e vinculado ao clube como '+v.role+'.');
      }catch(e){console.error(e);note(e&&e.message?e.message:'Não consegui aprovar este usuário.')}
    })();
  });
};

cmRejectAccess=async function(id){
  if(!isActualAdmin())return;
  var r=_accessRequests.find(function(x){return x.id===id});if(!r)return;
  ask('Recusar o acesso de <b>'+esc(r.full_name||r.email)+'</b>?',function(){
    (async function(){
      try{
        var q=sb.from('cm_access_requests').update({status:'rejected',reviewed_at:new Date().toISOString(),reviewed_by:_authUser.id}).eq('id',id);
        if(!(isSystemOwner()&&S.club&&S.club.demo))q=q.eq('requested_club_id',DB.cur);
        var res=await q;if(res.error)throw res.error;
        await cmLoadAccessRequests();render();toast('Pedido de acesso recusado.');
      }catch(e){console.error(e);note('Não consegui recusar este pedido.')}
    })();
  },'Recusar','RECUSAR ACESSO');
};

var baseUsersPanel=usersPanel;
usersPanel=function(){
  if(view==='config')return'';
  return baseUsersPanel();
};

accessRequestsPanel=function(){
  if(!isActualAdmin())return'';
  var rows=_accessRequests.map(function(r){
    var noClub=r.status==='approved'&&!r.assigned_club_id;
    var label=noClub?'Sem clube':'Aguardando aprovação';
    var club=(r.requested_club_id&&DB.clubs[r.requested_club_id])?DB.clubs[r.requested_club_id].club.name:'Sem destino';
    return '<tr>'+
      '<td><b>'+esc(r.full_name||'Sem nome')+'</b><div class="mute" style="font-size:12px">'+esc(r.email||'—')+'</div></td>'+
      '<td><b>'+esc(club)+'</b><div class="mute" style="font-size:12px">'+esc(r.requested_role||'Jogador')+'</div></td>'+
      '<td><span class="tag '+(noClub?'neu':'warn')+'">'+label+'</span></td>'+
      '<td>'+new Date(r.requested_at).toLocaleString('pt-BR')+'</td>'+
      '<td><div class="cm-pending-actions"><button class="btn sm" onclick="cmApproveAccess(\''+r.id+'\')">'+(noClub?'Vincular a clube':'Aprovar')+'</button>'+(noClub?'':'<button class="btn ghost sm" onclick="cmRejectAccess(\''+r.id+'\')">Recusar</button>')+'</div></td>'+
    '</tr>';
  }).join('');
  return '<div class="card cm-pending" style="margin-top:12px"><div class="row"><div><h3 style="margin:0">Solicitações de acesso</h3><p class="mute" style="margin:4px 0 0">Pendências deste clube. No clube de demonstração, o Dono vê o sistema inteiro.</p></div><span class="sp"></span>'+(_accessRequests.length?'<span class="cm-request-badge">'+_accessRequests.length+'</span>':'')+'</div>'+
    (rows?'<div class="wrap" style="margin-top:10px"><table class="tbl"><tr><th>Usuário</th><th>Clube / Função</th><th>Status</th><th>Solicitado em</th><th>Ações</th></tr>'+rows+'</table></div>':'<div class="empty">Nenhuma solicitação pendente para este clube.</div>')+
  '</div>';
};

function globalAccessPage(){
  var q=String(_globalUserFilter||'').trim().toLowerCase();
  var clubs=Object.entries(DB.clubs);
  var uniqueActive=new Set(_globalMembers.map(function(m){return m.user_id})).size;
  var pending=_accessRequests.filter(function(r){return r.status==='pending'}).length;
  var noClub=_accessRequests.filter(function(r){return r.status==='approved'&&!r.assigned_club_id}).length;
  var clubHtml=clubs.map(function(pair){return cmGlobalClubSection(pair[0],pair[1],q)}).join('');
  var requestRows=_accessRequests.filter(function(r){
    return !q||[r.full_name,r.email,r.requested_role,(r.requested_club_id&&DB.clubs[r.requested_club_id]?DB.clubs[r.requested_club_id].club.name:'')].some(function(v){return String(v||'').toLowerCase().includes(q)});
  }).map(function(r){
    var club=(r.requested_club_id&&DB.clubs[r.requested_club_id])?DB.clubs[r.requested_club_id].club.name:'Sem destino';
    var status=(r.status==='approved'&&!r.assigned_club_id)?'Sem clube':'Aguardando aprovação';
    return '<tr><td><b>'+esc(r.full_name||'Sem nome')+'</b><div class="mute" style="font-size:12px">'+esc(r.email||'—')+'</div></td>'+
      '<td><b>'+esc(club)+'</b><div class="mute" style="font-size:12px">'+esc(r.requested_role||'Jogador')+'</div></td>'+
      '<td><span class="tag '+(status==='Sem clube'?'neu':'warn')+'">'+status+'</span></td>'+
      '<td>'+new Date(r.requested_at).toLocaleString('pt-BR')+'</td>'+
      '<td><button class="btn sm" onclick="cmApproveAccess(\''+r.id+'\')">'+(status==='Sem clube'?'Vincular a clube':'Aprovar / direcionar')+'</button> '+(status==='Sem clube'?'':'<button class="btn ghost sm" onclick="cmRejectAccess(\''+r.id+'\')">Recusar</button>')+'</td></tr>';
  }).join('');
  return head('Controle de acesso','<button class="btn sm" onclick="newClubDialog()">＋ Criar clube</button>')+
    '<div class="cm-global-head"><div><h2>Visão geral do sistema</h2><p class="mute" style="margin:4px 0 0">Como Dono no clube de demonstração, você vê todos os clubes, usuários e solicitações.</p></div></div>'+
    '<div class="cm-global-kpis"><div class="cm-global-kpi"><small>Total de clubes</small><b>'+clubs.length+'</b></div><div class="cm-global-kpi"><small>Usuários ativos</small><b>'+uniqueActive+'</b></div><div class="cm-global-kpi"><small>Aguardando aprovação</small><b>'+pending+'</b></div><div class="cm-global-kpi"><small>Sem clube</small><b>'+noClub+'</b></div></div>'+
    '<div class="cm-global-toolbar"><input placeholder="Buscar clube, usuário, e-mail ou função..." value="'+esc(_globalUserFilter)+'" oninput="_globalUserFilter=this.value;render()"></div>'+
    clubHtml+
    '<div class="card cm-global-status-section"><div class="row"><div><h3>Solicitações e usuários sem clube</h3><p class="mute" style="margin:3px 0 0">Você pode aprovar, redirecionar ou vincular qualquer solicitação.</p></div><span class="sp"></span><span class="tag neu">'+_accessRequests.length+'</span></div>'+
      (requestRows?'<div class="wrap" style="margin-top:10px"><table class="tbl"><tr><th>Usuário</th><th>Clube / Função</th><th>Status</th><th>Solicitado em</th><th>Ações</th></tr>'+requestRows+'</table></div>':'<div class="empty">Nenhuma solicitação pendente.</div>')+
    '</div>';
}

window.access=function(){
  if(!isActualAdmin())return head('Controle de acesso')+'<div class="card"><div class="empty">Sua função não possui acesso a esta área.</div></div>';
  if(isSystemOwner()&&S.club&&S.club.demo)return globalAccessPage();
  var pending=_accessRequests.filter(function(r){return r.status==='pending'}).length;
  return head('Controle de acesso')+
    '<div class="card" style="margin-bottom:12px"><div class="row"><div><h2>'+esc(S.club.name)+'</h2><p class="mute" style="margin:4px 0 0">Gerencie somente os usuários e solicitações deste clube.</p></div><span class="sp"></span>'+(pending?'<span class="cm-request-badge">'+pending+'</span>':'')+'</div></div>'+
    accessRequestsPanel()+baseUsersPanel()+permPanel();
};

var baseConfig=config;
config=function(){
  var html=baseConfig();
  html=html.replace(/<button class="btn sm" onclick="go\('config','usuarios'\)">Clubes e usuários<\/button>/g,'');
  return html;
};

var baseRender=render;
render=function(){
  if(view==='access'){
    shell();
    var sim=isActualAdmin()&&DB.role!==_actualRole?'<div class="bn"><b>Visualizando como: '+esc(DB.role)+'</b><button class="btn sm" onclick="setRole(\''+esc(_actualRole)+'\')">Voltar para '+esc(_actualRole)+'</button></div>':'';
    document.getElementById('main').innerHTML=sim+access();
    post();
    return;
  }
  baseRender();
};

var baseShell=shell;
shell=function(){
  ensureAccessPerms();
  var items=NAV.filter(function(x){return can(x[0])}).map(function(x){
    var k=x[0],l=x[1],badge='';
    if(k==='access'){
      var n=_accessRequests.filter(function(r){return r.status==='pending'}).length;
      badge=n?'<span class="cm-request-badge" style="margin-left:auto">'+n+'</span>':'';
    }
    return '<a class="'+(view===k?'on':'')+'" onclick="go(\''+k+'\')">'+ic(k)+l+badge+'</a>';
  }).join('');
  document.getElementById('side').innerHTML='<div class="brand">'+logo(38,44)+'<b>'+esc(S.club.name)+(S.club.demo?' <small style="font-size:10px;opacity:.8">DEMO</small>':'')+'</b></div><div class="nav">'+items+'</div><div style="margin-top:auto;padding:8px">'+switchers()+cmAccountHtml()+'</div>';
  document.getElementById('bottom').innerHTML=[].concat(MOB.filter(can).map(function(k){return [k,NAV.find(function(n){return n[0]===k})[1]]}),[['menu','Mais']]).map(function(x){
    var k=x[0],l=x[1];return '<a class="'+((view===k||(k==='menu'&&!MOB.includes(view)))?'on':'')+'" onclick="go(\''+k+'\')">'+ic(k==='menu'?'mais':k)+l+'</a>';
  }).join('');
  var r=document.documentElement.style;r.setProperty('--brand',S.club.color);r.setProperty('--accent',S.club.accent);
};

var baseSwitchClub=switchClub;
switchClub=function(id){
  if(id==='__new'){newClubDialog();return}
  DB.cur=id;S=DB.clubs[id];normalizePerms(S);fill();fixPos();
  var m=_members.find(function(x){return x.club_id===id});
  _actualRole=m&&m.role?m.role:'Dono';DB.role=_actualRole;_permUser='';_userPermDraft=null;_userPermDirty=false;save();
  Promise.all([cmLoadClubMembers(id),cmLoadAccessRequests()]).then(function(){render()});
  go('dashboard');
};

setTimeout(function(){
  insertSignupFields();
  cmLoadSignupClubs();
  if(_authUser&&isActualAdmin())cmLoadAccessRequests().then(function(){render()}).catch(console.warn);
},0);
})();