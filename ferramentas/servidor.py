"""Servidor local do NS Codex, que nunca deixa o navegador guardar cópia.

    python ferramentas/servidor.py [porta]      (padrão: 8081)

POR QUE NÃO O http.server DIRETO

O `python -m http.server` não manda Cache-Control. Sem essa instrução o Chrome
decide sozinho por quanto tempo confia na cópia que já tem, e passa a servir
app.js, dados.js e style.css do disco dele — a tela abre desatualizada mesmo
com os arquivos certos na pasta. Foi o que aconteceu em 13/08.

Aqui cada resposta vai com `no-store`: o navegador é proibido de guardar. Em
desenvolvimento é o que se quer — editou, salvou, F5, apareceu. Não é preciso
rodar gera_dados_embutidos.py só para ver a alteração, nem limpar cache.

ISTO NÃO VALE PARA QUEM RECEBE O ZIP

Lá o app abre por file://, sem servidor nenhum, e o cache é bem-vindo: o
dados.js tem 1,5 MB e desceria de novo a cada clique no menu. Para esse caso o
que funciona é o carimbo `?v=<hash>` que gera_dados_embutidos.py põe nas
páginas — muda só quando o conteúdo muda.
"""
import http.server
import os
import socketserver
import sys

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PORTA_PADRAO = 8081


class SemCache(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=RAIZ, **kwargs)

    def end_headers(self):
        self.send_header("Cache-Control", "no-store, must-revalidate")
        self.send_header("Pragma", "no-cache")
        self.send_header("Expires", "0")
        super().end_headers()

    def log_message(self, formato, *args):
        # o log padrão polui o terminal com uma linha por arquivo; só erro importa
        if args and str(args[1]).startswith(("4", "5")):
            super().log_message(formato, *args)


if __name__ == "__main__":
    porta = int(sys.argv[1]) if len(sys.argv) > 1 else PORTA_PADRAO
    socketserver.TCPServer.allow_reuse_address = True
    with socketserver.TCPServer(("", porta), SemCache) as servidor:
        print(f"NS Codex em http://127.0.0.1:{porta}/index.html")
        print("Sem cache: editou, salvou, F5 — aparece. Ctrl+C para parar.")
        try:
            servidor.serve_forever()
        except KeyboardInterrupt:
            print("\nservidor parado")
