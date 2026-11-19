import test from 'node:test';
import assert from 'node:assert/strict';
import handler from '../api/transcricoes.js';

const basic = (u) => 'Basic ' + Buffer.from(u + ':senha').toString('base64');
const responder = () => ({ setHeader() {}, end(v) { this.body = JSON.parse(v); } });

test('a consulta limita o usuário comum e permite somente administradores explícitos', async () => {
  const env = { ...process.env }, fetchOriginal = globalThis.fetch;
  Object.assign(process.env, { VIEW_USERS: JSON.stringify({ ana: { senha: 'senha', papel: 'analistas' }, larissa: { senha: 'senha', papel: 'gerencial' } }),
    SUPABASE_URL: 'https://exemplo.supabase.co', SUPABASE_SECRET_KEY: 'sb_secret_falsa', TRANSCRICOES_ADMIN_USERS: 'larissa' });
  const urls = []; globalThis.fetch = async (url, opts) => { urls.push(new URL(url)); assert.equal(opts.headers.authorization, undefined); return { ok: true, json: async () => [] }; };
  try {
    const anon = responder(); await handler({ method: 'GET', headers: {} }, anon); assert.equal(anon.statusCode, 401);
    const ana = responder(); await handler({ method: 'GET', headers: { authorization: basic('ana') } }, ana);
    assert.equal(ana.statusCode, 200); assert.equal(urls[0].searchParams.get('usuario'), 'eq.ana'); assert.equal(ana.body.administrador, false);
    const larissa = responder(); await handler({ method: 'GET', headers: { authorization: basic('larissa') } }, larissa);
    assert.equal(urls[1].searchParams.has('usuario'), false); assert.equal(larissa.body.administrador, true);
  } finally { process.env = env; globalThis.fetch = fetchOriginal; }
});

test('a transcrição é salva com o usuário autenticado e sem armazenar áudio', async () => {
  const env = { ...process.env }, fetchOriginal = globalThis.fetch;
  Object.assign(process.env, { VIEW_USERS: JSON.stringify({ ana: { senha:'senha', papel:'analistas' } }), SUPABASE_URL:'https://exemplo.supabase.co', SUPABASE_SERVICE_ROLE_KEY:'falsa', GEMINI_API_KEY:'falsa' });
  let salvo;
  globalThis.fetch = async (url, opts) => {
    if (String(url).includes('generativelanguage.googleapis.com')) return { ok: true, json: async () => ({ candidates:[{content:{parts:[{text:'Transcrição de teste'}]}}] }) };
    salvo = JSON.parse(opts.body); return { ok: true, json: async () => [{ id: 1, ...salvo }] };
  };
  try {
    const res = responder();
    await handler({ method:'POST', headers:{authorization:basic('ana'), 'content-type':'application/json'}, body:{ nome:'teste.mp3', mime:'audio/mpeg', audio:'dGVzdGU=', usuario:'outra' } }, res);
    assert.equal(res.statusCode, 201); assert.equal(salvo.usuario, 'ana'); assert.equal(salvo.texto, 'Transcrição de teste');
    assert.equal(Object.hasOwn(salvo, 'audio'), false);
  } finally { process.env = env; globalThis.fetch = fetchOriginal; }
});
