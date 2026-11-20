import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { carregarTudo, indexador, mapProcessoSiga, incorporarStatusSga, salvarVistoria, vistoriaDosAnalistas } from '../api/_core.js';
import { GRUPOS } from '../api/dados.js';
import { autenticar } from '../api/_auth.js';

test('vistoria inclui somente as duas tarefas dos analistas autorizadas', () => {
  for (const tarefa of ['Comunicar Autorização', 'Analisar Necessidade de Carro Reserva']) {
    const p = { setor: 'ANALISTAS', tarefa };
    p._vistoriaAnalistas = vistoriaDosAnalistas(p);
    assert.equal(GRUPOS.reguladores(p), true);
    assert.equal(GRUPOS.analistas(p), true);
  }
  assert.equal(vistoriaDosAnalistas({ setor:'ANALISTAS', tarefa:'Análise do Processo' }), false);
  assert.equal(vistoriaDosAnalistas({ setor:'CONSULTORES', tarefa:'Comunicar Autorização' }), false);
  assert.equal(GRUPOS.reguladores({setor:'ANALISTAS', tarefa:'Análise do Processo'}), false);
});

test('as tarefas dos analistas chegam ao grupo dos reguladores na carga real', async () => {
  const { privateKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
  const saJson = { client_email:'teste@example.invalid', private_key:privateKey.export({type:'pkcs8', format:'pem'}) };
  const abas = { SIGA:[['PROTOCOLO SIGA','SETOR','Tarefa'], ['1','ANALISTAS','Comunicar Autorizacao'], ['2','ANALISTAS','Analisar Necessidade de Carro Reserva'], ['3','ANALISTAS','Análise do Processo']] };
  const original = globalThis.fetch;
  globalThis.fetch = async (url) => String(url).includes('oauth2.googleapis.com') ? { json:async () => ({access_token:'teste'}) } : { json:async () => ({values:abas[decodeURIComponent(String(url).split('/values/')[1].split('?')[0])] || []}) };
  try { const r = await carregarTudo({saJson, sheetSinistro:'teste', sheetReguladores:''}); assert.deepEqual(r.processos.filter(GRUPOS.reguladores).map(p=>p.protocoloSiga), ['1','2']); }
  finally { globalThis.fetch = original; }
});

test('cabeçalhos duplicados usam o primeiro valor preenchido', () => {
  const get = indexador(['REGULADOR ANALISTA', 'REGULADOR ANALISTA']);
  assert.equal(get(['', 'Rafael'], 'REGULADOR ANALISTA'), 'Rafael');
});

test('orçamentista, Rafael, nome fantasia e produção vêm das colunas nomeadas', async () => {
  const { privateKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
  const saJson = { client_email: 'teste@example.invalid', private_key: privateKey.export({ type: 'pkcs8', format: 'pem' }) };
  const abas = {
    SIGA: [['PROTOCOLO SIGA','PROTOCOLO SGA','SETOR','Cobertura','Nome','Regulador','CNPJ'], ['2026-1','42','REGULADORES','ASSOCIADO','Maria','LUIZ','12345678000199']],
    REGULADORES: [['PROTOCOLO SIGA','PROTOCOLO','Cobertura','Nome','Data liberação','REGULADOR SGA','REGULADOR ANALISTA','ID EXTERNO','CNPJ'], ['2026-1','42','ASSOCIADO','Maria','18/11/2026','LUIZ','','RAFAEL','12345678000199']],
    'SGA!A:AF': [['PROTOCOLO','TIPO EVENTO','NOME ASSOCIADO','D A T A D A A N A L I S E D O R E G U L A D O R','ID EXTERNO','NOME FANTASIA OFICINA','CNPJ','ANALISTA RESPONSAVEL'], ['42','ASSOCIADO','Maria','17/11/2026','RAFAEL','Oficina A','12345678000199','Analista SGA']],
    OFICINAS: [['Nome','Nome fantasia','Telefone','E-mail contato','Cpf/cnpj','Consultor Tecnico'], ['Empresa','Oficina A','','','12345678000199','Ana']],
    'BASE REGULADOR ANALISTA': [['NUMERO','REGULADOR ANALISTA','DATA DA ANALISE']],
    'BASE VISTORIA INICIAL': [['NUMERO','REGULADOR ANALISTA','DATA DA ANALISE'], ['2026-1','LUIZ','18/11/2026']],
  };
  const original = globalThis.fetch;
  globalThis.fetch = async (url) => String(url).includes('oauth2.googleapis.com') ? { json: async () => ({ access_token: 'teste' }) } :
    { json: async () => ({ values: abas[decodeURIComponent(String(url).split('/values/')[1].split('?')[0])] || [] }) };
  try {
    const r = await carregarTudo({ saJson, sheetSinistro: 'gerencial', sheetReguladores: 'reguladores' });
    assert.equal(r.processos[0].responsavel, 'LUIZ');
    assert.equal(r.processos[0].reguladorAnalista, 'RAFAEL');
    assert.equal(r.processos[0].oficinaSga, 'Oficina A');
    assert.equal(r.processos[0].analista, 'Analista SGA');
    assert.equal(r.processos[0].consultorTecnico, 'Ana');
    assert.equal(r.listas.oficinas[0].quantidade, 1);
    assert.deepEqual(r.analises.map(({pessoa, data}) => ({pessoa, data})), [{pessoa:'RAFAEL', data:'2026-11-17'}]);
    assert.deepEqual(r.vistorias.map(({pessoa, data}) => ({pessoa, data})), [{pessoa:'LUIZ', data:'2026-11-18'}]);
    assert.equal(r.gerado.br, 'Não informado');
  } finally { globalThis.fetch = original; }
});

test('papel desconhecido não concede acesso gerencial', () => {
  const header = 'Basic ' + Buffer.from('usuario:senha').toString('base64');
  assert.equal(autenticar(header, { VIEW_USERS: JSON.stringify({ usuario: { senha: 'senha', papel: 'desconhecido' } }) }), null);
});

test('preparação da vistoria separa data e responsável nas colunas corretas', async () => {
  const { privateKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
  const saJson = { client_email: 'teste@example.invalid', private_key: privateKey.export({ type: 'pkcs8', format: 'pem' }) };
  const original = globalThis.fetch;
  globalThis.fetch = async (url) => String(url).includes('oauth2.googleapis.com') ? { json: async () => ({ access_token: 'teste' }) } :
    { json: async () => ({ values: [['NUMERO','REGULADOR ANALISTA','DATA DA ANALISE'], ['2026-1','ANTIGO','']] }) };
  try {
    const r = await salvarVistoria({saJson, sheetSinistro:'gerencial'}, [{protocolo:'2026-1', dataIso:'2026-11-18', responsavel:'LUIZ'}], {dryRun:true});
    assert.deepEqual(r.updates, ["'BASE VISTORIA INICIAL'!C2 = 18/11/2026", "'BASE VISTORIA INICIAL'!B2 = LUIZ"]);
  } finally { globalThis.fetch = original; }
});

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
