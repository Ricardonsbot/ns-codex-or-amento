@echo off
REM Abre o NS Codex no navegador padrao.
REM
REM O duplo clique no index.html ja funciona sozinho: os cadastros vao
REM embutidos em assets/js/dados.js justamente para o app nao precisar de
REM servidor. Este atalho existe para quem prefere um icone com nome claro.
REM
REM Se houver Python, sobe ferramentas/servidor.py, que manda no-store em toda
REM resposta. Assim o navegador nunca serve copia velha: editou, salvou, F5,
REM apareceu. Sem isso o Chrome decide sozinho por quanto tempo confia no que
REM ja tem, e a tela abre desatualizada mesmo com os arquivos certos na pasta.

cd /d "%~dp0"

where python >nul 2>nul
if %errorlevel%==0 goto servidor

echo Abrindo direto do disco...
start "" "index.html"
goto fim

:servidor
echo Subindo servidor local sem cache na porta 8081...
start "" http://127.0.0.1:8081/index.html
python ferramentas\servidor.py 8081

:fim
