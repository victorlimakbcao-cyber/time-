(function(){
  'use strict';
  async function loadMisterCluberBrand(){
    try{
      const ids=[1,3,4,5];
      const parts=await Promise.all(ids.map(async i=>{
        const r=await fetch('/assets/mc-logo-'+i+'.txt?v=20261009-3',{cache:'force-cache'});
        if(!r.ok)throw new Error('Falha ao carregar parte '+i);
        return (await r.text()).trim();
      }));
      const src='data:image/webp;base64,'+parts.join('');
      document.querySelectorAll('.mc-login-logo-img').forEach(img=>{img.src=src});
    }catch(e){
      console.warn('Logo oficial Mister Cluber não carregou:',e);
    }
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',loadMisterCluberBrand,{once:true});
  else loadMisterCluberBrand();
})();