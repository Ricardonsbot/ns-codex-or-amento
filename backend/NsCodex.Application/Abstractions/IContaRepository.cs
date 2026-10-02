using NsCodex.Domain.Entities;

namespace NsCodex.Application.Abstractions;

/// <summary>
/// Contrato de leitura do plano de contas. Declarado no Application e implementado
/// no Infrastructure — é o que mantém a dependência apontando só para dentro e o
/// que permite ao Domain e ao Application não conhecerem EF Core nem Postgres.
/// </summary>
public interface IContaRepository
{
    Task<IReadOnlyList<Conta>> ListarAsync(CancellationToken ct);
}
