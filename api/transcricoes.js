import { autenticar } from './_auth.js';

export const maxDuration = 60;
const TIPOS = new Set(['audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/ogg', 'audio/webm', 'audio/mp4', 'video/mp4']);
const json = (res, status, data) => { res.statusCode = status; res.setHeader('content-type', 'application/json; charset=utf-8'); res.setHeader('cache-control', 'private, no-store'); res.end(JSON.stringify(data)); };
const corpo = async (req) => {
  if (req.body) return typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
  const partes = []; let n = 0;
  for await (const p of req) { n += p.length; if (n > 4_000_000) throw new Error('Arquivo muito grande'); partes.push(p); }
  return JSON.parse(Buffer.concat(partes).toString('utf8'));
};

export default async function handler(req, res) {
  const auth = autenticar(req.headers?.authorization, process.env);
  if (!auth) return json(res, 401, { erro: 'Autenticação necessária.' });
  const { SUPABASE_URL: url, GEMINI_API_KEY: gemini } = process.env;
  const key = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key || (req.method === 'POST' && !gemini)) return json(res, 503, { erro: 'Transcrição ainda não configurada.' });
  let origem;
  try { origem = new URL(url); } catch { return json(res, 503, { erro: 'Configuração do banco inválida.' }); }
  if (origem.protocol !== 'https:' || !origem.hostname.endsWith('.supabase.co')) return json(res, 503, { erro: 'Configuração do banco inválida.' });
  const admins = new Set((process.env.TRANSCRICOES_ADMIN_USERS || '').split(',').map((s) => s.trim()).filter(Boolean));
  const admin = admins.has(auth.user);
  const db = new URL('/rest/v1/transcricoes', origem);
  // Chaves sb_secret não são JWTs: o gateway as recebe somente no apikey.
  const headers = { apikey: key, 'content-type': 'application/json', ...(key.startsWith('sb_secret_') ? {} : { authorization: `Bearer ${key}` }) };
  try {
    if (req.method === 'GET') {
      db.searchParams.set('select', 'id,criado_em,usuario,nome_arquivo,referencia,metadados,texto');
      db.searchParams.set('order', 'criado_em.desc'); db.searchParams.set('limit', '200');
      if (!admin) db.searchParams.set('usuario', `eq.${auth.user}`);
      const resposta = await fetch(db, { headers });
      if (!resposta.ok) throw new Error('Banco indisponível');
      return json(res, 200, { registros: await resposta.json(), administrador: admin });
    }
    if (req.method !== 'POST') return json(res, 405, { erro: 'Método não permitido.' });
    if (!String(req.headers?.['content-type'] || '').toLowerCase().startsWith('application/json')) return json(res, 415, { erro: 'Envie JSON.' });
    const origin = req.headers?.origin;
    if (origin && new URL(origin).host !== req.headers.host) return json(res, 403, { erro: 'Origem não autorizada.' });
    const dados = await corpo(req);
    const audio = String(dados.audio || ''), mime = String(dados.mime || '').toLowerCase();
    if (!TIPOS.has(mime) || !/^[A-Za-z0-9+/]+={0,2}$/.test(audio) || audio.length > 3_500_000)
      return json(res, 400, { erro: 'Use um áudio compatível de até 2,5 MB.' });
    const modelos = [...new Set([process.env.GEMINI_MODEL || 'gemini-flash-latest', 'gemini-3.5-flash', 'gemini-flash-lite-latest'])];
    if (!modelos.every((modelo) => /^[a-zA-Z0-9._-]+$/.test(modelo))) throw new Error('Modelo inválido');
    const pedido = JSON.stringify({ contents: [{ parts: [{ text: 'Transcreva fielmente o áudio em português. Não invente palavras; sinalize trechos inaudíveis. Responda somente com a transcrição.' }, { inline_data: { mime_type: mime, data: audio } }] }] });
    let gem;
    for (const modelo of modelos) {
      try {
        gem = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${modelo}:generateContent`, {
          method: 'POST', headers: { 'content-type': 'application/json', 'x-goog-api-key': gemini },
          body: pedido, signal: AbortSignal.timeout(16000)
        });
      } catch {
        console.error('Gemini indisponível ou tempo esgotado; modelo', modelo);
        gem = null;
        continue;
      }
      if (gem.ok || !([404, 429].includes(gem.status) || gem.status >= 500)) break;
      console.error('Gemini recusou a transcrição; modelo', modelo, 'HTTP', gem.status);
    }
    if (!gem) return json(res, 502, { erro: 'O Gemini não respondeu a tempo. Tente novamente em alguns instantes.' });
    if (!gem.ok) {
      console.error('Gemini recusou a transcrição; HTTP', gem.status);
      if (gem.status === 400 || gem.status === 413) return json(res, 502, { erro: 'O Gemini não aceitou este áudio. Confira o formato e tente outro arquivo.' });
      if (gem.status === 401 || gem.status === 403) return json(res, 502, { erro: 'O Gemini recusou a chave de acesso. Verifique a configuração da API.' });
      if (gem.status === 404) return json(res, 502, { erro: 'O modelo Gemini configurado não está disponível para esta chave.' });
      if (gem.status === 429) return json(res, 502, { erro: 'O Gemini atingiu o limite de uso. Aguarde e confira a cota da API.' });
      return json(res, 502, { erro: 'O Gemini está indisponível no momento. Tente novamente mais tarde.' });
    }
    const resposta = await gem.json();
    const texto = resposta.candidates?.[0]?.content?.parts?.map((p) => p.text || '').join('').trim();
    if (!texto) return json(res, 502, { erro: 'O Gemini não retornou uma transcrição para este áudio.' });
    const metadados = {};
    for (const k of ['envolvido', 'nome', 'placa', 'octa', 'telefone', 'data', 'analista', 'associado']) metadados[k] = String(dados.metadados?.[k] || '').slice(0, 200);
    if (metadados.data && !/^\d{4}-\d{2}-\d{2}$/.test(metadados.data)) return json(res, 400, { erro: 'Data inválida.' });
    if (metadados.envolvido && !['Associado', 'Condutor', 'Terceiro'].includes(metadados.envolvido)) return json(res, 400, { erro: 'Tipo de envolvido inválido.' });
    const registro = { usuario: auth.user, nome_arquivo: String(dados.nome || 'Áudio').slice(0, 200), referencia: String(dados.referencia || '').slice(0, 200), metadados, texto };
    const salvo = await fetch(db, { method: 'POST', headers: { ...headers, prefer: 'return=representation' }, body: JSON.stringify(registro) });
    if (!salvo.ok) throw new Error('A transcrição não pôde ser salva.');
    return json(res, 201, { registro: (await salvo.json())[0] });
  } catch (e) { return json(res, 502, { erro: e.message || 'Falha na transcrição.' }); }
}
