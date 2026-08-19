using Microsoft.EntityFrameworkCore;
using NsCodex.Application.Abstractions;

namespace NsCodex.Infrastructure.Persistence;

/// <summary>
/// Seções da pessoa, do banco. Scoped: uma consulta por request, no máximo —
/// vários endpoints podem perguntar, mas o resultado é o mesmo dentro do request.
/// </summary>
public class SecoesDaPessoa : ISecoesDaPessoa
{
    private readonly AppDbContext _db;
    private long? _pessoaLida;
    private IReadOnlySet<string> _cache = new HashSet<string>();

    public SecoesDaPessoa(AppDbContext db) => _db = db;

    public async Task<IReadOnlySet<string>> DeAsync(long pessoaId, CancellationToken ct)
    {
        if (_pessoaLida == pessoaId) return _cache;

        var linhas = await _db.Database
            .SqlQuery<string>($"SELECT secao FROM cadastro.pessoa_secao WHERE pessoa_id = {pessoaId}")
            .ToListAsync(ct);

        _cache = linhas.ToHashSet(StringComparer.OrdinalIgnoreCase);
        _pessoaLida = pessoaId;
        return _cache;
    }
}
