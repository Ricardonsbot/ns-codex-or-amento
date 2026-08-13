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
import io
import json
import os
import glob

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
    for nome in dados:
        print(f"   {nome}")


if __name__ == "__main__":
    main()
