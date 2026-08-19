using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using NsCodex.Domain.Entities;
using NsCodex.Domain.Enums;

namespace NsCodex.Infrastructure.Auth;

/// <summary>
/// Dono único de "quem é esta pessoa, expresso como claims".
///
/// Na nsView o equivalente carrega o escopo inteiro (famílias, seções, empresas
/// de People) porque lá o filtro de linha vive no service. Aqui o token é curto
/// de propósito: o escopo é derivado pelo banco, em `app_empresas_visiveis()`, a
/// partir de `app.pessoa_id`. Menos claim, uma verdade só, e tirar alguém de uma
/// empresa vale no request seguinte em vez de esperar o token expirar.
/// </summary>
public static class PermissaoClaims
{
    /// <summary>Versão do formato das claims. Serve para reconhecer token antigo
    /// depois de uma virada de permissão — sem isso, a distinção entre "não tem
    /// acesso" e "tem token velho" some.</summary>
    public const string ClaimVersao = "perm_v";
    public const string VersaoAtual = "1";

    public const string ClaimLogin  = "login";
    public const string ClaimNome   = "nome";
    public const string ClaimPerfil = "perfil";

    public static List<Claim> Montar(Pessoa pessoa)
    {
        var claims = new List<Claim>
        {
            new(JwtRegisteredClaimNames.Sub, pessoa.Id.ToString()),
            new(ClaimLogin, pessoa.Login),
            new(ClaimNome, pessoa.Nome),
            // A forma do banco, minúscula — a mesma string que a RLS compara em
            // app_perfil(). Gravar "Admin" aqui e "admin" lá é o tipo de
            // divergência que só aparece quando um aprovador não enxerga nada.
            new(ClaimPerfil, (pessoa.Perfil ?? Perfil.Operacional).ParaBanco()),
            new(ClaimVersao, VersaoAtual)
        };

        if (!string.IsNullOrWhiteSpace(pessoa.Email))
            claims.Add(new Claim(JwtRegisteredClaimNames.Email, pessoa.Email));

        return claims;
    }
}
