using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using NsCodex.Application.Abstractions;

namespace NsCodex.Infrastructure.Persistence;

/// <summary>
/// Lê config_plataforma com cache de 30 segundos.
///
/// A janela de 30s é a decisão: sem cache, toda request faria uma consulta a uma
/// tabela de uma linha; com cache longo, mudar a flag exigiria reiniciar — e aí
/// ela deixaria de ser o freio de emergência que justifica existir. Trinta
/// segundos é curto o bastante para quem está apagando incêndio e longo o
/// bastante para não pesar.
///
/// Singleton com escopo próprio para consultar: o DbContext é scoped e este
/// serviço vive além de um request.
/// </summary>
public class PlataformaConfig : IPlataformaConfig
{
    private static readonly TimeSpan Validade = TimeSpan.FromSeconds(30);

    private readonly IServiceScopeFactory _escopos;
    private readonly SemaphoreSlim _trava = new(1, 1);
    private Dictionary<string, string> _cache = new();
    private DateTime _lido = DateTime.MinValue;

    public PlataformaConfig(IServiceScopeFactory escopos) => _escopos = escopos;

    public async Task<bool> RbacSecaoEnforceAsync(CancellationToken ct)
    {
        var valor = await LerAsync("rbac_secao_enforce", ct);
        // Ausente = FISCALIZANDO. O default de uma flag de segurança é o lado
        // seguro: se a linha sumir da tabela, o sistema tranca em vez de abrir.
        return valor is null || valor.Equals("true", StringComparison.OrdinalIgnoreCase);
    }

    private async Task<string?> LerAsync(string chave, CancellationToken ct)
    {
        if (DateTime.UtcNow - _lido < Validade)
            return _cache.GetValueOrDefault(chave);

        await _trava.WaitAsync(ct);
        try
        {
            if (DateTime.UtcNow - _lido < Validade)
                return _cache.GetValueOrDefault(chave);

            using var escopo = _escopos.CreateScope();
            var db = escopo.ServiceProvider.GetRequiredService<AppDbContext>();
            var linhas = await db.Database
                .SqlQuery<ConfigLinha>($"SELECT chave, valor FROM cadastro.config_plataforma")
                .ToListAsync(ct);

            _cache = linhas.ToDictionary(l => l.Chave, l => l.Valor);
            _lido = DateTime.UtcNow;
            return _cache.GetValueOrDefault(chave);
        }
        finally { _trava.Release(); }
    }

    private sealed record ConfigLinha(string Chave, string Valor);
}
