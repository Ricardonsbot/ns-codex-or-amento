using System.Data.Common;
using Microsoft.EntityFrameworkCore;
using NsCodex.Application.Abstractions;

namespace NsCodex.Infrastructure.Persistence;

public class SessaoDiagnostico : ISessaoDiagnostico
{
    private readonly AppDbContext _db;
    public SessaoDiagnostico(AppDbContext db) => _db = db;

    /// <summary>
    /// Pergunta ao Postgres, na conexão deste request: quem eu sou, o que declarei
    /// e quantos lançamentos enxergo. A contagem passa pela política de RLS, então
    /// ela responde a única pergunta que importa — a permissão está valendo?
    /// </summary>
    public async Task<SessaoNoBanco> LerAsync(CancellationToken ct)
    {
        var conexao = _db.Database.GetDbConnection();
        await _db.Database.OpenConnectionAsync(ct);   // dispara o interceptor
        try
        {
            await using var cmd = conexao.CreateCommand();
            cmd.CommandText = """
                SELECT current_user,
                       current_setting('app.pessoa_id', true),
                       current_setting('app.perfil', true),
                       (SELECT count(*) FROM orcamento.lancamento);
                """;
            await using var r = await cmd.ExecuteReaderAsync(ct);
            await r.ReadAsync(ct);
            return new SessaoNoBanco(
                r.GetString(0),
                r.IsDBNull(1) ? "(não declarado)" : r.GetString(1),
                r.IsDBNull(2) ? "(não declarado)" : r.GetString(2),
                r.GetInt64(3));
        }
        finally
        {
            await _db.Database.CloseConnectionAsync();
        }
    }
}
