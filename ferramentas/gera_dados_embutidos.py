"""Gera assets/js/dados.js — a cópia embutida dos JSON de Referencias/.

Ferramenta de bastidor, como as outras: roda na mão.

POR QUE ISTO EXISTE

O protótipo lê os dados com fetch(). Num servidor isso funciona; aberto direto
do disco (file://), o navegador recusa o fetch por segurança e a tela vem vazia.
Como o app precisa rodar na máquina de quem vai testar — sem instalar Python,
sem subir servidor, sem depender de rede —, os mesmos JSON entram também como
um .js, que o navegador carrega por <script> e não passa por CORS.

A fonte continua sendo Referencias/*.json. Este arquivo é derivado: quem edita
um JSON roda este script de novo. Rodando de servidor, o app segue lendo os
JSON direto — a cópia embutida só entra quando o fetch não é possível.
"""
import glob
import hashlib
import io
import json
import os
import re

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
REF = os.path.join(RAIZ, "Referencias")
DESTINO = os.path.join(RAIZ, "assets", "js", "dados.js")

CABECALHO = """/* dados.js — cópia embutida de Referencias/*.json.
 *
 * NÃO EDITE À MÃO. Gerado por ferramentas/gera_dados_embutidos.py a partir dos
 * JSON, que continuam sendo a fonte.
 *
 * Existe para o app abrir com duplo clique no index.html, sem servidor: o
 * fetch() do carregarRef() não funciona em file://, e sem isto toda tela que
 * depende de cadastro viria vazia na máquina de quem está testando.
 */
window.__DADOS_EMBUTIDOS = """


ASSETS = ["assets/css/style.css", "assets/js/dados.js", "assets/js/app.js"]


def versionar_assets():
    """Carimba ?v=<hash do conteúdo> nas tags de CSS e JS de todas as páginas.

    Sem isto o navegador guarda app.js, dados.js e style.css e continua servindo
    a cópia velha: a URL nunca muda, então ele nem pergunta se mudou. Foi o que
    fez a tela aparecer desatualizada mesmo com o disco certo.

    O carimbo vem do conteúdo, não da hora: só muda quando o arquivo muda, então
    o cache continua valendo enquanto nada mexer. Funciona igual em file://.
    """
    h = hashlib.sha256()
    for rel in ASSETS:
        caminho = os.path.join(RAIZ, rel)
        if os.path.exists(caminho):
            h.update(io.open(caminho, "rb").read())
    versao = h.hexdigest()[:10]

    # O ?v= só resolve se o navegador reler o HTML: uma página cacheada aponta
    # para a versão velha dos assets e o carimbo nunca chega. Sem Cache-Control
    # no servidor, o Chrome decide sozinho quanto tempo confia na cópia local.
    META = ('<meta http-equiv="Cache-Control" content="no-cache" />\n'
            '<meta http-equiv="Pragma" content="no-cache" />\n')

    tocadas = 0
    for pagina in sorted(glob.glob(os.path.join(RAIZ, "*.html"))):
        texto = io.open(pagina, encoding="utf-8").read()
        novo = texto
        for rel in ASSETS:
            novo = re.sub(r'(["\'])' + re.escape(rel) + r'(\?v=[0-9a-f]+)?\1',
                          lambda m: f'{m.group(1)}{rel}?v={versao}{m.group(1)}', novo)
        if 'http-equiv="Cache-Control"' not in novo:
            novo = novo.replace('<meta charset="UTF-8" />\n', '<meta charset="UTF-8" />\n' + META, 1)
        if novo != texto:
            io.open(pagina, "w", encoding="utf-8", newline="").write(novo)
            tocadas += 1

    print(f"versão dos assets: {versao} — {tocadas} página(s) carimbada(s)")
    return versao


def main():
    dados, total = {}, 0
    for caminho in sorted(glob.glob(os.path.join(REF, "*.json"))):
        nome = os.path.basename(caminho)
        with io.open(caminho, encoding="utf-8") as fh:
            dados[nome] = json.load(fh)
        total += os.path.getsize(caminho)

    corpo = json.dumps(dados, ensure_ascii=False, separators=(",", ":"))
    with io.open(DESTINO, "w", encoding="utf-8", newline="") as fh:
        fh.write(CABECALHO + corpo + ";\n")

    tamanho = os.path.getsize(DESTINO)
    print(f"dados.js  {len(dados)} arquivos · {tamanho/1024:.0f} KB "
          f"(os JSON somam {total/1024:.0f} KB; aqui vão sem indentação)")

    # depois de reescrever o dados.js, para o hash já pegar a versão nova
    versionar_assets()


if __name__ == "__main__":
    main()
