using Microsoft.EntityFrameworkCore;
using NsCodex.Application.Abstractions;
using NsCodex.Domain.Entities;

namespace NsCodex.Infrastructure.Persistence;

/// <summary>
/// Leitura do plano de contas. A linha do P&L entra por LEFT JOIN porque
/// `linha_pl_id` é opcional no schema: a carga dos 630 códigos traz conta ainda
/// sem mapeamento, e essas contas precisam aparecer na lista assim mesmo — só sem
/// categoria derivada.
/// </summary>
public class ContaRepository : IContaRepository
{
    private readonly AppDbContext _db;
    public ContaRepository(AppDbContext db) => _db = db;

    public async Task<IReadOnlyList<Conta>> ListarAsync(CancellationToken ct)
    {
        var linhas = await (
            from c in _db.Contas.AsNoTracking()
            join lp in _db.LinhasPl.AsNoTracking() on c.LinhaPlId equals lp.Id into j
            from lp in j.DefaultIfEmpty()
            where c.Ativo
            orderby c.Codigo
            select new { Conta = c, LinhaPlNome = lp != null ? lp.Nome : null }
        ).ToListAsync(ct);

        foreach (var l in linhas) l.Conta.LinhaPl = l.LinhaPlNome;
        return linhas.Select(l => l.Conta).ToList();
    }
}
