using NsCodex.Domain.Enums;

namespace NsCodex.Application.Abstractions;

/// <summary>
/// Quem está agindo neste request, lido das claims do JWT.
///
/// Note o que NÃO está aqui: a lista de empresas que a pessoa alcança. Isso é
/// deliberado e é a diferença principal em relação à nsView, que carrega o
/// escopo (`familia_fpa`) dentro do token porque filtra as linhas no service.
/// Aqui quem filtra é o banco, por Row Level Security, e ele deriva as empresas
/// de `pessoa_empresa` a partir de `app.pessoa_id`. Duplicar essa lista na claim
/// criaria uma segunda verdade que envelhece: tirar alguém de uma empresa não
/// teria efeito até o token expirar.
/// </summary>
public interface ICurrentUser
{
    long? PessoaId { get; }
    string? Login { get; }
    string? Nome { get; }
    string? Email { get; }
    Perfil? Perfil { get; }

    bool EstaAutenticado { get; }
    bool EhAdmin { get; }
}
