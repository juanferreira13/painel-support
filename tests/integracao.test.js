import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { carregarTudo, indexador, mapProcessoSiga, incorporarStatusSga } from '../api/_core.js';
import { GRUPOS } from '../api/dados.js';

test('encaminhamento por tarefa controla o acesso ao painel de consultores', () => {
  assert.equal(GRUPOS.consultores({ setor: 'REGULADORES', porTarefa: 'CONSULTORES', evento: 'COLISÃO' }), true);
  assert.equal(GRUPOS.consultores({ setor: 'CONSULTORES', porTarefa: '', evento: 'COLISÃO' }), true);
  assert.equal(GRUPOS.consultores({ setor: 'CONSULTORES', porTarefa: 'ANALISTAS', evento: 'COLISÃO' }), false);
  assert.equal(GRUPOS.consultores({ setor: 'CONSULTORES', porTarefa: 'CONSULTORES', evento: 'VIDROS' }), false);
});

test('separa consultor comercial do técnico e mantém os campos do SIGA', () => {
  const cab = ['PROTOCOLO SIGA', 'SETOR', 'POR TAREFA', 'VOLUNTARIO', 'CONSULTOR TECNICO', 'CAMPO ADICIONAL', 'Tarefa'];
  const linha = ['2026-00123', 'PEÇAS', 'CONSULTORES', 'Comercial', 'Técnico', 'Detalhe', 'Comprar peça'];
  const get = indexador(cab);
  const p = mapProcessoSiga((...nomes) => get(linha, ...nomes));
  assert.equal(p.consultor, 'Comercial');
  assert.equal(p.consultorTecnico, 'Técnico');
  assert.equal(p.porTarefa, 'CONSULTORES');
  assert.equal(p.campoAdicional, 'Detalhe');
  assert.equal(p.tarefa, 'Comprar peça');
});

test('inclui somente os três status do SGA, sem duplicar ou inventar informações SIGA', () => {
  const processos = [{ protocoloSga: '100', protocoloSiga: '2026-001', cobertura: 'ASSOCIADO', nome: 'Alice',
    statusSga: 'ANTIGO', statusSiga: 'AUTORIZADO', setor: 'REGULADORES' }];
  const cab = ['PROTOCOLO', 'TIPO EVENTO', 'NOME ASSOCIADO', 'NOME TERCEIRO', 'PLACA', 'PLACA TERCEIRO',
    'SITUACAO EVENTO', 'ANALISTA RESPONSAVEL', 'DATA COMUNICADO EVENTO'];
  const linhas = [cab,
    ['100', 'ASSOCIADO', 'Alice', '', 'ABC1234', '', 'EXCLUIR', 'Ana', '12/11/2026'],
    ['100', 'TERCEIRO', 'Alice', 'Bruno', 'ABC1234', 'DEF1234', 'NOTIFICADO', 'Bia', '13/11/2026'],
    ['200', 'ASSOCIADO', 'Carla', '', 'GHI1234', '', 'ONLINE', '', '14/11/2026'],
    ['300', 'ASSOCIADO', 'Dora', '', 'JKL1234', '', 'FINALIZADO', '', '10/11/2026'],
    ['200', 'ASSOCIADO', 'Carla', '', 'GHI1234', '', 'ONLINE', '', '14/11/2026']];
  incorporarStatusSga(processos, linhas);
  assert.equal(processos.length, 3);
  assert.equal(processos[0].statusSga, 'EXCLUIR');
  assert.equal(processos[0].statusSiga, 'AUTORIZADO');
  assert.equal(GRUPOS.analistas(processos[0]), true);
  const terceiro = processos.find((p) => p.nome === 'Bruno');
  assert.equal(terceiro.statusSga, 'NOTIFICADO');
  assert.equal(terceiro.statusSiga, '');
  assert.equal(terceiro.protocoloSiga, '');
  assert.equal(terceiro.placaSga, 'DEF1234');
  assert.equal(terceiro.diasAberto, null);
  assert.equal(terceiro._somenteSGA, true);
  assert.equal(GRUPOS.analistas(terceiro), true);
  assert.equal(GRUPOS.consultores(terceiro), false);
  assert.equal(processos.find((p) => p.nome === 'Carla').statusSga, 'ONLINE');
});

test('cruzamento preserva tarefa, consultores e cadastro completo de oficinas', async () => {
  const { privateKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
  const saJson = { client_email: 'teste@example.invalid', private_key: privateKey.export({ type: 'pkcs8', format: 'pem' }) };
  const abas = {
    SIGA: [['PROTOCOLO SIGA', 'SETOR', 'POR TAREFA', 'Tarefa', 'VOLUNTARIO', 'CONSULTOR TECNICO'],
      ['2026-00123', 'REGULADORES', 'CONSULTORES', 'Vistoria Inicial', 'Comercial', 'Técnico']],
    'BASE REGULADOR ANALISTA': [['NUMERO', 'REGULADOR ANALISTA'], ['2026-00123', 'Regulador']],
    'BASE VISTORIA INICIAL': [['NUMERO', 'DATA DA ANALISE']],
    REGULADORES: [['PROTOCOLO SIGA', 'Tarefa'], ['2026-00123', 'Vistoria Inicial']],
    OFICINAS: [['Nome', 'Nome fantasia', 'Telefone', 'E-mail contato', 'Cpf/cnpj', 'Cep', 'Logradouro', 'Nº', 'Complemento', 'Bairro', 'Cidade', 'Estado', 'Segmento', 'Site', 'Situação', 'Contato'],
      ['Razão', '', '123', 'a@example.invalid', '12345678000199', '12345', 'Rua', '1', 'Sala', 'Centro', 'Brasília', 'DF', 'Mecânica', '', 'ATIVO', 'Técnico']],
  };
  const original = globalThis.fetch;
  globalThis.fetch = async (url) => {
    if (String(url).includes('oauth2.googleapis.com')) return { json: async () => ({ access_token: 'teste' }) };
    const aba = decodeURIComponent(String(url).split('/values/')[1].split('?')[0]);
    return { json: async () => ({ values: abas[aba] || [] }) };
  };
  try {
    const { processos, listas } = await carregarTudo({ saJson, sheetSinistro: 'gerencial', sheetReguladores: 'reguladores' });
    assert.equal(processos.length, 1);
    assert.equal(processos[0].porTarefa, 'CONSULTORES');
    assert.equal(processos[0].consultor, 'Comercial');
    assert.equal(processos[0].consultorTecnico, 'Técnico');
    assert.equal(processos[0].reguladorAnalista, 'Regulador');
    assert.equal(listas.oficinas[0].oficina, 'Razão');
    assert.equal(listas.oficinas[0].complemento, 'Sala');
    assert.equal(listas.oficinas[0].consultor, 'Técnico');
  } finally { globalThis.fetch = original; }
});
