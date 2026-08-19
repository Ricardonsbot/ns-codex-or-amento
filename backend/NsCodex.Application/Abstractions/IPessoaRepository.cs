using NsCodex.Domain.Entities;

namespace NsCodex.Application.Abstractions;

public interface IPessoaRepository
{
    /// <summary>Pessoa ATIVA cujo e-mail ou login case com um dos identificadores
    /// do token. Recebe a lista inteira porque o Entra devolve mais de um: para
    /// convidado, o `preferred_username` vem como "user_dominio.com#EXT#@tenant"
    /// e o e-mail real só aparece no claim `email`.</summary>
    Task<Pessoa?> PorIdentificadoresAsync(IReadOnlyList<string> identificadores, CancellationToken ct);
}
