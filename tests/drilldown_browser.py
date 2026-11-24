"""Smoke test do detalhamento com dados fictícios (requer Playwright e Edge)."""
import functools
import http.server
import json
import threading
from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
handler = functools.partial(http.server.SimpleHTTPRequestHandler, directory=str(ROOT))
server = http.server.ThreadingHTTPServer(('127.0.0.1', 0), handler)
threading.Thread(target=server.serve_forever, daemon=True).start()
dados = {'configurado': True, 'papel': 'gerencial', 'permitidos': ['sinistro', 'reguladores'],
         'processos': [{'protocoloSiga': '2026-1', 'setor': 'REGULADORES', 'setorAtual': 'REGULADORES', 'nome': 'Teste A'},
                       {'protocoloSiga': '2026-2', 'setor': 'REGULADORES', 'setorAtual': 'REGULADORES', 'nome': 'Teste B'}],
         'analises': [{'protocolo': '2026-1', 'data': '2026-11-01', 'pessoa': 'ANA'},
                      {'protocolo': '2026-3', 'data': '2026-11-02', 'pessoa': 'ANA'},
                      {'protocolo': '2026-2', 'data': '2026-10-01', 'pessoa': 'ANA'}],
         'vistorias': [{'protocolo': '2026-1', 'data': '2026-11-01', 'pessoa': 'ANA'},
                       {'protocolo': '2026-2', 'data': '2026-10-01', 'pessoa': 'ANA'}],
         'listas': {'reguladores': [], 'reguladoresAnalistas': ['ANA']},
         'fonte': {'live': True, 'rotulo': 'Teste'}}
try:
    with sync_playwright() as p:
        browser = p.chromium.launch(channel='msedge', headless=True)
        page = browser.new_page()
        page.clock.install(time='2026-11-23T12:00:00')
        page.route('**/api/dados?*', lambda route: route.fulfill(status=200, content_type='application/json', body=json.dumps(dados)))
        page.goto(f'http://127.0.0.1:{server.server_port}/#/dashboard/reguladores')
        celula = page.get_by_role('button', name='Mês 11/2026, Regulador analista ANA: 2. Filtrar')
        celula.wait_for()
        assert page.get_by_label('Mês das análises diárias').input_value() == '2026-11'
        assert page.get_by_label('Mês das vistorias diárias').input_value() == '2026-11'
        diario = page.locator('section.cartao').filter(has=page.get_by_role('heading', name='Análises por dia e regulador'))
        vistoria = page.locator('section.cartao').filter(has=page.get_by_role('heading', name='Vistorias iniciais por dia e regulador'))
        assert diario.get_by_text('01/10/2026').count() == 0
        assert vistoria.get_by_text('01/10/2026').count() == 0
        assert page.get_by_role('button', name='Mês 10/2026, Regulador analista ANA: 1. Filtrar').count() == 1
        celula.click()
        assert page.get_by_text('2 análises · 11/2026 · ANA').count() == 1
        assert page.locator('.detalhe-analises tbody tr').count() == 2
        assert page.get_by_text('1 de 2 processos, conforme os filtros acima.').count() == 1
        page.get_by_role('button', name='Limpar seleção').click()
        assert page.locator('.detalhe-analises tbody tr').count() == 0
        assert page.get_by_text('2 de 2 processos, conforme os filtros acima.').count() == 1
        page.get_by_label('Mês das análises diárias').select_option('2026-10')
        page.get_by_label('Mês das vistorias diárias').select_option('2026-10')
        assert diario.get_by_text('01/10/2026').count() == 1
        assert vistoria.get_by_text('01/10/2026').count() == 1
        assert page.get_by_role('button', name='Mês 10/2026, Regulador analista ANA: 1. Filtrar').count() == 1
        assert page.get_by_role('button', name='Mês 11/2026, Regulador analista ANA: 2. Filtrar').count() == 1
        browser.close()
finally:
    server.shutdown()
