import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

test('atualização lê alterações do Sheets, ignora overlay antigo e conserva dados em falha', async () => {
  let nome = 'Primeiro', falhar = false, chamadas = 0;
  const GS = { isoDia: () => '2026-01-01', dataBr: () => '01/01/2026', diasEntre: () => 0, norm: (v) => String(v || '').toUpperCase() };
  const context = { window: { GS }, localStorage: { getItem: () => JSON.stringify({ P1: { nome: 'Valor antigo local' } }) },
    fetch: async () => {
      chamadas++;
      if (falhar) throw new Error('offline');
      return { ok: true, json: async () => ({ processos: [{ protocoloSiga: 'P1', nome, setor: 'ANALISTAS' }], listas: {} }) };
    }, console };
  vm.runInNewContext(await readFile(new URL('../assets/dados.js', import.meta.url), 'utf8'), context);
  await GS.DB.garantir();
  assert.equal((await GS.DB.carregar('analistas')).processos[0].nome, 'Primeiro');
  nome = 'Editado no Sheets';
  await GS.DB.atualizar();
  assert.equal((await GS.DB.carregar('analistas')).processos[0].nome, nome);
  falhar = true;
  await GS.DB.atualizar();
  assert.equal((await GS.DB.carregar('analistas')).processos[0].nome, nome);
  assert.equal(chamadas, 3);
});
