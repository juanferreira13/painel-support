(function () {
  const { el } = window.GS;
  window.GS.renderTranscricoes = async function (mount) {
    const wrap = el('div', { class: 'largura', style: 'padding: 32px 0' });
    const title = el('h1', null, 'Transcrições de áudio');
    const info = el('p', null, 'Envie um áudio para transcrever. Cada pessoa vê seus próprios registros; a coordenação autorizada pode consultar todos.');
    const form = el('form', { class: 'cartao formulario-transcricao' });
    const arq = el('input', { type: 'file', accept: 'audio/mpeg,audio/wav,audio/ogg,audio/webm,audio/mp4,video/mp4', required: true });
    const ref = el('input', { type: 'text', placeholder: 'Protocolo ou referência', maxlength: '200' });
    const tipo = el('select'); for (const valor of ['', 'Associado', 'Condutor', 'Terceiro']) tipo.append(el('option', { value: valor }, valor || 'Selecione o envolvido'));
    const nome = el('input', { type: 'text', placeholder: 'Nome do envolvido', maxlength: '200' });
    const placa = el('input', { type: 'text', placeholder: 'Placa', maxlength: '20' });
    const octa = el('input', { type: 'text', placeholder: 'ID Octa', maxlength: '200' });
    const telefone = el('input', { type: 'tel', placeholder: 'Telefone com DDD', maxlength: '30' });
    const enviar = el('button', { class: 'botao', type: 'submit' }, 'Transcrever e salvar');
    const estado = el('p', { role: 'status' });
    const lista = el('section', { class: 'cartao' });
    const campo = (rotulo, input) => { const label = el('label', { class: 'campo' }, rotulo); label.append(input); return label; };
    form.append(campo('Arquivo de áudio (até 2,5 MB)', arq), campo('Protocolo ou referência', ref),
      campo('Tipo de envolvido', tipo), campo('Nome do envolvido', nome), campo('Placa', placa), campo('ID Octa', octa), campo('Telefone com DDD', telefone), enviar, estado);
    wrap.append(title, info, form, lista); mount.replaceChildren(wrap);
    async function carregar() {
      lista.replaceChildren(el('p', null, 'Carregando transcrições...'));
      try {
        const r = await fetch('/api/transcricoes', { cache: 'no-store' }); const j = await r.json().catch(() => ({ erro: 'Serviço de transcrições indisponível.' }));
        if (!r.ok) throw new Error(j.erro || 'Não foi possível carregar.');
        const cab = el('h2', null, j.administrador ? 'Transcrições da equipe' : 'Minhas transcrições');
        const blocos = j.registros.map((item) => {
          const detalhe = el('details');
          const rotulo = [item.referencia || item.nome_arquivo, item.usuario, new Date(item.criado_em).toLocaleString('pt-BR')].join(' · ');
          const meta = item.metadados || {};
          const dados = [meta.envolvido && `${meta.envolvido}: ${meta.nome || ''}`, meta.placa && `Placa: ${meta.placa}`, meta.octa && `ID Octa: ${meta.octa}`, meta.telefone && `Telefone: ${meta.telefone}`].filter(Boolean).join('\n');
          detalhe.append(el('summary', null, rotulo), el('p', { style: 'white-space: pre-wrap' }, dados), el('p', { style: 'white-space: pre-wrap' }, item.texto));
          return detalhe;
        });
        lista.replaceChildren(cab, ...(blocos.length ? blocos : [el('p', null, 'Nenhuma transcrição encontrada.')]));
      } catch (e) { lista.replaceChildren(el('p', null, e.message)); }
    }
    form.addEventListener('submit', async (e) => {
      e.preventDefault(); const f = arq.files[0]; if (!f) return;
      if (f.size > 2_500_000) { estado.textContent = 'O arquivo ultrapassa 2,5 MB.'; return; }
      enviar.disabled = true; estado.textContent = 'Transcrevendo e salvando...';
      try {
        const b64 = await new Promise((resolve, reject) => { const leitor = new FileReader(); leitor.onload = () => resolve(String(leitor.result).split(',')[1]); leitor.onerror = reject; leitor.readAsDataURL(f); });
        const r = await fetch('/api/transcricoes', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ nome: f.name, mime: f.type, referencia: ref.value, audio: b64, metadados: { envolvido: tipo.value, nome: nome.value, placa: placa.value, octa: octa.value, telefone: telefone.value } }) });
        const j = await r.json(); if (!r.ok) throw new Error(j.erro || 'Não foi possível transcrever.');
        estado.textContent = 'Transcrição salva.'; form.reset(); await carregar();
      } catch (err) { estado.textContent = err.message || 'Não foi possível transcrever.'; }
      finally { enviar.disabled = false; }
    });
    await carregar();
  };
})();
