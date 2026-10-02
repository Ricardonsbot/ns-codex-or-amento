using Microsoft.EntityFrameworkCore;
using NsCodex.Application.Abstractions;
using NsCodex.Domain.Entities;

namespace NsCodex.Infrastructure.Persistence;

public class PessoaRepository : IPessoaRepository
{
    private readonly AppDbContext _db;
    public PessoaRepository(AppDbContext db) => _db = db;

    /// <summary>
    /// DEFAULT-DENY: só encontra quem já está cadastrado e ativo. Não
    /// auto-provisiona a partir do SSO — ter conta no tenant da NSTECH não é o
    /// mesmo que ter acesso ao orçamento, e um sistema que cria a pessoa sozinha
    /// no primeiro login transforma "todo mundo da empresa" em usuário.
    /// </summary>
    public async Task<Pessoa?> PorIdentificadoresAsync(IReadOnlyList<string> ids, CancellationToken ct)
    {
        if (ids.Count == 0) return null;

        return await _db.Pessoas.AsNoTracking()
            .Where(p => p.Ativo)
            .Where(p => (p.Email != null && ids.Contains(p.Email.ToLower()))
                        || ids.Contains(p.Login.ToLower()))
            .FirstOrDefaultAsync(ct);
    }
}
