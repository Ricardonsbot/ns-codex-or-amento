using System.Data.Common;
using Microsoft.EntityFrameworkCore.Diagnostics;
using NsCodex.Application.Abstractions;
using NsCodex.Domain.Enums;

namespace NsCodex.Infrastructure.Persistence;

/// <summary>
/// Declara ao Postgres QUEM está agindo, em toda conexão aberta.
///
/// Esta classe é a dobradiça do sistema inteiro. As políticas de RLS
/// (banco/07-permissoes.sql) decidem o que a pessoa vê lendo `app.pessoa_id` e
/// `app.perfil` da sessão; a auditoria (banco/05) grava a autoria lendo
/// `app.pessoa_login` e `app.pessoa_nome` por gatilho. Sem estas quatro
/// variáveis, a sessão é anônima: enxerga zero lançamento e grava evento sem
/// autor. Com elas, a permissão e a trilha acontecem sozinhas, sem nenhuma rota
/// precisar lembrar de nada — que era o ponto de pôr a regra no banco.
///
/// POR QUE NUM INTERCEPTOR, E NÃO EM CADA SERVIÇO: porque "lembrar de chamar" é
/// exatamente o modo de falha que a versão Flask deste domínio já demonstrou —
/// três rotas de exclusão esqueceram da checagem de empresa. Aqui não há o que
/// esquecer: quem abre conexão declara.
///
/// SOBRE POOL: `set_config(..., is_local => false)` vale pela sessão, não pela
/// transação. Isso seria vazamento de identidade entre requests se a conexão
/// voltasse ao pool suja — mas o Npgsql emite `DISCARD ALL` ao devolver a
/// conexão, o que zera GUCs. Mesmo assim o Reset abaixo existe: depender de um
/// default de biblioteca para uma propriedade de segurança é barato de evitar.
/// </summary>
public sealed class ContextoDaSessaoInterceptor : DbConnectionInterceptor
{
    private readonly ICurrentUser _usuario;
    public ContextoDaSessaoInterceptor(ICurrentUser usuario) => _usuario = usuario;

    public override async Task ConnectionOpenedAsync(
        DbConnection conexao, ConnectionEndEventData dados, CancellationToken ct = default)
    {
        if (!_usuario.EstaAutenticado) return;   // sessão anônima: não declara nada, e a RLS fecha

        await using var cmd = conexao.CreateCommand();
        cmd.CommandText = """
            SELECT set_config('app.pessoa_id',    @pessoa_id,    false),
                   set_config('app.pessoa_login', @pessoa_login, false),
                   set_config('app.pessoa_nome',  @pessoa_nome,  false),
                   set_config('app.perfil',       @perfil,       false);
            """;
        Parametro(cmd, "pessoa_id",    _usuario.PessoaId?.ToString() ?? "");
        Parametro(cmd, "pessoa_login", _usuario.Login ?? "");
        Parametro(cmd, "pessoa_nome",  _usuario.Nome ?? "");
        Parametro(cmd, "perfil",       _usuario.Perfil?.ParaBanco() ?? "");
        await cmd.ExecuteNonQueryAsync(ct);
    }

    public override async ValueTask<InterceptionResult> ConnectionClosingAsync(
        DbConnection conexao, ConnectionEventData dados, InterceptionResult resultado)
    {
        if (conexao.State == System.Data.ConnectionState.Open)
        {
            try
            {
                await using var cmd = conexao.CreateCommand();
                cmd.CommandText = "RESET app.pessoa_id; RESET app.pessoa_login; "
                                + "RESET app.pessoa_nome; RESET app.perfil;";
                await cmd.ExecuteNonQueryAsync();
            }
            catch
            {
                // Conexão em vias de fechar não deve derrubar o request. O
                // DISCARD ALL do Npgsql cobre este caso de qualquer forma.
            }
        }
        return resultado;
    }

    private static void Parametro(DbCommand cmd, string nome, string valor)
    {
        var p = cmd.CreateParameter();
        p.ParameterName = nome;
        p.Value = valor;
        cmd.Parameters.Add(p);
    }
}
