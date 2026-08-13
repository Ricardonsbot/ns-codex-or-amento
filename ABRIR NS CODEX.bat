@echo off
REM Abre o NS Codex no navegador padrao.
REM
REM O duplo clique no index.html ja funciona: os cadastros vao embutidos em
REM assets/js/dados.js justamente para o app nao precisar de servidor.
REM Este atalho existe so para quem prefere um icone com nome claro, e para
REM quem tem Python instalado ganhar tambem a leitura dos JSON direto de
REM Referencias/ (util para quem for editar cadastro durante o teste).

cd /d "%~dp0"

where python >nul 2>nul
if %errorlevel%==0 goto servidor

echo Abrindo direto do disco...
start "" "index.html"
goto fim

:servidor
echo Subindo servidor local na porta 8081...
start "" http://127.0.0.1:8081/index.html
python -m http.server 8081

:fim
