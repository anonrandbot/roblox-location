// script.js
const ENDPOINT = '/api/send'; // serverless function na Vercel
const btn = document.getElementById('btnMain');
const modalBack = document.getElementById('modal');
const acceptBtn = document.getElementById('accept');
const denyBtn = document.getElementById('deny');
const consentCheckbox = document.getElementById('consentCheckbox');
const queue = document.getElementById('queue');
const bar = document.getElementById('bar');
const posEl = document.getElementById('pos');
const revokeBtn = document.getElementById('revoke');

function hasConsent(){ return localStorage.getItem('promo_consent') === 'true'; }
function setConsent(v){ localStorage.setItem('promo_consent', v ? 'true' : 'false'); }

// Abre modal se não houver consentimento
btn.addEventListener('click', ()=> {
  if(!hasConsent()){
    modalBack.style.display = 'flex';
    modalBack.setAttribute('aria-hidden','false');
  } else {
    collectAndStart();
  }
});

consentCheckbox.addEventListener('change', ()=> {
  acceptBtn.disabled = !consentCheckbox.checked;
});

denyBtn.addEventListener('click', ()=> {
  setConsent(false);
  modalBack.style.display = 'none';
  alert('Você recusou. Não será possível participar.');
});

acceptBtn.addEventListener('click', async ()=> {
  setConsent(true);
  modalBack.style.display = 'none';
  await collectAndStart();
});

revokeBtn.addEventListener('click', async (e)=> {
  e.preventDefault();
  setConsent(false);
  localStorage.removeItem('promo_submission_id');
  alert('Consentimento revogado (local). Para remoção no servidor, entre em contato com o responsável.');
});

async function collectAndStart(){
  try{
    const data = await gatherClientData();
    console.log('Dados coletados (envio):', data);

    // Envia para o endpoint server
    try{
      const res = await fetch(ENDPOINT, {
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body: JSON.stringify(data)
      });
      const json = await res.json().catch(()=>({}));
      if(json && json.ok && json.id) localStorage.setItem('promo_submission_id', json.id);
      console.log('Resposta do servidor:', json);
    }catch(err){
      console.error('Erro ao enviar para servidor:', err);
    }
  }catch(e){ console.error(e); }
  startQueueFlow();
}

function startQueueFlow(){
  document.querySelector('.card').querySelector('h1').scrollIntoView();
  queue.style.display = 'block';
  queue.setAttribute('aria-hidden','false');
  let p = Math.floor(Math.random()*20)+1;
  if(posEl) posEl.textContent = p;
  let percent = 0;
  const iv = setInterval(()=> {
    percent += Math.random()*8;
    if(percent>100) percent = 100;
    bar.style.width = percent + '%';
    if(percent >= 100){ clearInterval(iv); if(posEl) posEl.textContent = 'Processado'; }
  }, 400);
}

/* GATHER as many allowed client-side infos as possible */
async function gatherClientData(){
  const nav = navigator;
  const screen = window.screen || {};
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || null;
  const perf = (performance && performance.timing) ? performance.timing.toJSON?.() || performance.timing : null;

  const data = {
    timestamp: new Date().toISOString(),
    userAgent: nav.userAgent || null,
    platform: nav.platform || null,
    language: nav.language || nav.languages?.[0] || null,
    screen: { width: screen.width || null, height: screen.height || null, colorDepth: screen.colorDepth || null },
    deviceMemory: nav.deviceMemory || null,
    hardwareConcurrency: nav.hardwareConcurrency || null,
    cookieEnabled: nav.cookieEnabled || null,
    timezone: tz,
    connection: nav.connection ? { effectiveType: nav.connection.effectiveType, downlink: nav.connection.downlink } : null,
    battery: null,
    webgl: null,
    performanceTiming: perf,
    geolocation: null,
    referrer: document.referrer || null,
    origin: location.origin,
    path: location.pathname
  };

  // Battery info (se disponível)
  try{
    if(navigator.getBattery) {
      const b = await navigator.getBattery();
      data.battery = {charging: b.charging, level: b.level};
    }
  }catch(e){}

  // WebGL / GPU info
  try{
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
    if(gl){
      const dbgRenderInfo = gl.getExtension('WEBGL_debug_renderer_info');
      const renderer = dbgRenderInfo ? gl.getParameter(dbgRenderInfo.UNMASKED_RENDERER_WEBGL) : null;
      const vendor = dbgRenderInfo ? gl.getParameter(dbgRenderInfo.UNMASKED_VENDOR_WEBGL) : null;
      data.webgl = { renderer, vendor };
    }
  }catch(e){}

  // IP público via api.ipify.org (não obrigatório)
  try{
    const r = await fetch('https://api.ipify.org?format=json');
    const j = await r.json();
    data.publicIp = j.ip;
  }catch(e){ data.publicIp = null; }

  // Geolocation: pedimos permissão explicitamente (apenas se aceitarem)
  try{
    const geo = await new Promise((resolve) => {
      if(!navigator.geolocation) return resolve(null);
      // pergunta — o navegador mostrará prompt. Se o usuário recusar, receberemos erro.
      navigator.geolocation.getCurrentPosition(
        pos => resolve({lat: pos.coords.latitude, lon: pos.coords.longitude, accuracy: pos.coords.accuracy}),
        err => resolve({error: err.code || 'denied'}),
        {maximumAge:60000,timeout:10000}
      );
    });
    data.geolocation = geo;
  }catch(e){ data.geolocation = {error:'failed'}; }

  return data;
}
