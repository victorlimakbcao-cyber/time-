(function(){
'use strict';

function deny(mod,act){
  if(typeof requirePerm==='function')return !requirePerm(mod,act);
  return true;
}
function guard(name,mod,act){
  var fn=window[name];
  if(typeof fn!=='function')return;
  window[name]=function(){
    if(deny(mod,act))return;
    return fn.apply(this,arguments);
  };
}
guard('qeStart','elenco','edit');
guard('qeSave','elenco','edit');
guard('addPlayer','elenco','create');
guard('addStaff','elenco','create');
guard('editPlayer','elenco','edit');
guard('setPlayerPhoto','elenco','edit');
guard('delPlayerPhoto','elenco','edit');
guard('setStaffPhoto','elenco','edit');
guard('delStaffPhoto','elenco','edit');
guard('arch','elenco','edit');
guard('archS','elenco','edit');
guard('delPlayer','elenco','delete');
guard('delStaff','elenco','delete');

function hideMutationControls(){
  if(typeof view==='undefined'||view!=='elenco')return;
  var root=document.getElementById('main'); if(!root)return;
  var allowCreate=canDo('elenco','create'),allowEdit=canDo('elenco','edit'),allowDelete=canDo('elenco','delete');
  if(!allowCreate){
    root.querySelectorAll('[onclick*="addPlayer("],[onclick*="addStaff("]').forEach(function(el){el.remove()});
  }
  if(!allowEdit){
    root.querySelectorAll('[onclick*="qeStart("],[onclick*="editPlayer("],[onclick*="arch("],[onclick*="archS("],[onchange*="qp("],[onchange*="avail"]').forEach(function(el){el.remove()});
    if(typeof fl!=='undefined'&&fl.elEdit){fl.elEdit=false;fl.qe=null;}
  }
  if(!allowDelete){
    root.querySelectorAll('[onclick*="delPlayer("],[onclick*="delStaff("]').forEach(function(el){el.remove()});
  }
  if(!allowEdit&&!allowDelete){
    root.querySelectorAll('.pl-tbl th:last-child,.pl-tbl td:last-child').forEach(function(el){el.remove()});
  }
}
function polishAccess(){
  document.querySelectorAll('.cm-club-real-logo').forEach(function(img){
    img.addEventListener('error',function(){
      var p=img.parentElement;
      if(!p)return;
      var fallback=document.createElement('span');
      fallback.className='cm-club-mark';
      fallback.textContent='CL';
      p.replaceChild(fallback,img);
    },{once:true});
  });
}
var previousRender=window.render;
window.render=function(){
  var out=previousRender.apply(this,arguments);
  hideMutationControls();
  polishAccess();
  return out;
};
setTimeout(function(){hideMutationControls();polishAccess()},0);
})();