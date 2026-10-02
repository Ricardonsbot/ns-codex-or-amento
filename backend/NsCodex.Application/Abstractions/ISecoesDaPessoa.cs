namespace NsCodex.Application.Abstractions;

/// <summary>
/// As seções que uma pessoa alcança, lidas do banco a cada request.
///
/// NÃO vai no token, pela mesma razão que a lista de empresas não vai: uma cópia
/// no JWT envelhece, e revogar uma seção só valeria quando o token expirasse,
/// oito horas depois.
/// </summary>
public interface ISecoesDaPessoa
{
    Task<IReadOnlySet<string>> DeAsync(long pessoaId, CancellationToken ct);
}
