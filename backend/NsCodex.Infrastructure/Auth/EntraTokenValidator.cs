using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using Microsoft.Extensions.Options;
using Microsoft.IdentityModel.Protocols;
using Microsoft.IdentityModel.Protocols.OpenIdConnect;
using Microsoft.IdentityModel.Tokens;

namespace NsCodex.Infrastructure.Auth;

/// <summary>
/// Valida um id_token do Entra ID e devolve os e-mails que ele afirma.
///
/// As chaves de assinatura da Microsoft giram, então o ConfigurationManager
/// busca e CACHEIA o documento OIDC com refresh automático — por isso este
/// validador é singleton. Sem cache, cada login viraria uma ida à Microsoft.
///
/// Não se confia em NADA além de assinatura + issuer + audience + validade. O
/// que a pessoa pode fazer não vem do token da Microsoft: vem de
/// `cadastro.pessoa` e da RLS.
/// </summary>
public class EntraTokenValidator
{
    private readonly EntraSettings _settings;
    private readonly ConfigurationManager<OpenIdConnectConfiguration>? _config;
    private readonly JwtSecurityTokenHandler _handler = new();

    public EntraTokenValidator(IOptions<EntraSettings> opts)
    {
        _settings = opts.Value;
        if (_settings.Habilitado)
            _config = new ConfigurationManager<OpenIdConnectConfiguration>(
                _settings.MetadataAddress, new OpenIdConnectConfigurationRetriever());
    }

    public bool Habilitado => _settings.Habilitado;
    public string TenantId => _settings.TenantId;
    public string ClientId => _settings.ClientId;

    /// <summary>
    /// TODOS os identificadores de e-mail do token, em minúsculas e sem repetir.
    /// Lista vazia quer dizer token inválido — nunca "válido mas anônimo".
    ///
    /// Devolve vários e não um só porque para conta CONVIDADA o
    /// `preferred_username` vem como "user_dominio.com#EXT#@tenant..." e o e-mail
    /// de verdade só aparece no claim `email`. Quem chama casa contra qualquer um.
    /// </summary>
    public async Task<IReadOnlyList<string>> ValidarEmailsAsync(string idToken, CancellationToken ct)
    {
        if (_config is null || string.IsNullOrWhiteSpace(idToken)) return [];

        OpenIdConnectConfiguration config;
        try { config = await _config.GetConfigurationAsync(ct); }
        catch { return []; }

        var parametros = new TokenValidationParameters
        {
            ValidateIssuer = true,
            ValidIssuer = _settings.Issuer,
            ValidateAudience = true,
            ValidAudience = _settings.ClientId,
            ValidateLifetime = true,
            ValidateIssuerSigningKey = true,
            IssuerSigningKeys = config.SigningKeys,
            ClockSkew = TimeSpan.FromMinutes(2)
        };

        try
        {
            var principal = _handler.ValidateToken(idToken, parametros, out _);
            string?[] brutos =
            [
                principal.FindFirst("preferred_username")?.Value,
                principal.FindFirst(ClaimTypes.Email)?.Value,   // o handler mapeia "email" para cá
                principal.FindFirst("email")?.Value,
                principal.FindFirst("upn")?.Value
            ];
            return brutos
                .Where(x => !string.IsNullOrWhiteSpace(x))
                .Select(x => x!.Trim().ToLowerInvariant())
                .Distinct()
                .ToList();
        }
        catch { return []; }
    }
}
