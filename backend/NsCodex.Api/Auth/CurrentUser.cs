using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using NsCodex.Application.Abstractions;
using NsCodex.Domain.Enums;
using NsCodex.Infrastructure.Auth;

namespace NsCodex.Api.Auth;

/// <summary>Lê o JWT do request. Só leitura de claim — nenhuma decisão de
/// permissão mora aqui: quem decide o que a pessoa vê é a RLS.</summary>
public class CurrentUser : ICurrentUser
{
    public long? PessoaId { get; }
    public string? Login { get; }
    public string? Nome { get; }
    public string? Email { get; }
    public Perfil? Perfil { get; }

    public bool EstaAutenticado => PessoaId.HasValue;
    public bool EhAdmin => Perfil == Domain.Enums.Perfil.Admin;

    public CurrentUser(IHttpContextAccessor acessor)
    {
        var u = acessor.HttpContext?.User;
        if (u?.Identity?.IsAuthenticated != true) return;

        // `sub` é o id da pessoa. O handler do ASP.NET renomeia `sub` para
        // NameIdentifier ao montar o principal, então procurar só por "sub"
        // devolve null em produção e funciona no teste — daí os dois.
        var sub = u.FindFirst(JwtRegisteredClaimNames.Sub)?.Value
                  ?? u.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        if (long.TryParse(sub, out var id)) PessoaId = id;

        Login  = u.FindFirst(PermissaoClaims.ClaimLogin)?.Value;
        Nome   = u.FindFirst(PermissaoClaims.ClaimNome)?.Value;
        Email  = u.FindFirst(JwtRegisteredClaimNames.Email)?.Value
                 ?? u.FindFirst(ClaimTypes.Email)?.Value;
        Perfil = PerfilExtensions.DoBanco(u.FindFirst(PermissaoClaims.ClaimPerfil)?.Value);
    }
}
