namespace NsCodex.Application.Dtos;

/// <summary>O id_token que o popup do Entra devolve no navegador.</summary>
public sealed class SsoLoginRequest
{
    public string IdToken { get; init; } = "";
}

public sealed class LoginResponse
{
    public string Token { get; init; } = "";
    public DateTime ExpiraEm { get; init; }
    public EuDto Eu { get; init; } = new();
}

/// <summary>Quem sou eu — o que a tela precisa para se desenhar. Não é
/// autorização: toda decisão é revalidada no servidor a cada request.</summary>
public sealed class EuDto
{
    public long Id { get; init; }
    public string Login { get; init; } = "";
    public string Nome { get; init; } = "";
    public string? Email { get; init; }
    public string Perfil { get; init; } = "";
}

/// <summary>
/// Config pública da tela de login. Traz TenantId e ClientId porque é a tela
/// que monta a URL de autorização do Entra — e os dois são identificadores
/// públicos, não segredo. Publicá-los evita ter de repetir a configuração no
/// front e sair de sincronia com o servidor.
/// </summary>
public sealed class AuthConfigDto
{
    public bool SsoDisponivel { get; init; }
    public string? TenantId { get; init; }
    public string? ClientId { get; init; }
}
