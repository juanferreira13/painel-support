import test from 'node:test';
import assert from 'node:assert/strict';
import { autenticar } from '../api/_auth.js';

const basic = (u, p) => 'Basic ' + Buffer.from(`${u}:${p}`).toString('base64');
test('acessos adicionais preservam os usuários existentes e concedem o papel gerencial', () => {
  const env = {
    VIEW_USERS: JSON.stringify({ ana: { senha: 'antiga', papel: 'analistas' } }),
    VIEW_EXTRA_USERS: JSON.stringify({ ana: { senha: 'nova', papel: 'gerencial' }, diogo: { senha: 'aleatoria', papel: 'gerencial' } }),
  };
  assert.equal(autenticar(basic('ana', 'nova'), env), null);
  assert.equal(autenticar(basic('ana', 'antiga'), env).papel, 'analistas');
  assert.equal(autenticar(basic('diogo', 'aleatoria'), env).papel, 'gerencial');
});
