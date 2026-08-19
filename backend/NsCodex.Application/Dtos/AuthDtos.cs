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

/// <summary>Config pública da tela de login: diz se dá para entrar.</summary>
public sealed class AuthConfigDto
{
    public bool SsoDisponivel { get; init; }
}
