namespace NsCodex.Application.Abstractions;

/// <summary>Flags de operação que mudam sem deploy (tabela config_plataforma).</summary>
public interface IPlataformaConfig
{
    /// <summary>Fiscalizar a seção nos endpoints. Lido do banco, com cache curto.</summary>
    Task<bool> RbacSecaoEnforceAsync(CancellationToken ct);
}
