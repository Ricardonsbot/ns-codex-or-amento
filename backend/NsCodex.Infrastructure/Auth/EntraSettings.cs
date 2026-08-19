namespace NsCodex.Infrastructure.Auth;

/// <summary>
/// Login SSO Microsoft (Entra ID). TenantId e ClientId são identificadores
/// PÚBLICOS do app registration — não são segredo, ficam no appsettings e podem
/// ser sobrescritos por env (ENTRA_TENANT_ID / ENTRA_CLIENT_ID).
///
/// Sem os dois, o SSO fica desligado — e como o NS Codex não tem login por senha
/// (`cadastro.pessoa` não tem coluna de senha, de propósito), desligado significa
/// que NINGUÉM entra. Ver o aviso de boot no Program.cs.
/// </summary>
public class EntraSettings
{
    public string TenantId { get; set; } = string.Empty;
    public string ClientId { get; set; } = string.Empty;

    public bool Habilitado => !string.IsNullOrWhiteSpace(TenantId) && !string.IsNullOrWhiteSpace(ClientId);

    /// <summary>Emissor esperado do id_token v2 (traz o GUID do tenant — single-tenant).</summary>
    public string Issuer => $"https://login.microsoftonline.com/{TenantId}/v2.0";

    /// <summary>Documento OIDC de onde saem as chaves de assinatura (JWKS).</summary>
    public string MetadataAddress => $"https://login.microsoftonline.com/{TenantId}/v2.0/.well-known/openid-configuration";
}
