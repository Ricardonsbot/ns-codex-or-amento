namespace NsCodex.Domain.Enums;

/// <summary>
/// Os quatro perfis do CHECK de `cadastro.pessoa.perfil`. A grafia em minúscula
/// é a que vai gravada e a que a RLS lê em `app_perfil()` — se divergir, as
/// políticas param de reconhecer admin e aprovador, e o sintoma é "some tudo".
/// </summary>
public enum Perfil
{
    Operacional,
    Aprovador,
    Lider,
    Admin
}

public static class PerfilExtensions
{
    public static string ParaBanco(this Perfil p) => p switch
    {
        Perfil.Operacional => "operacional",
        Perfil.Aprovador   => "aprovador",
        Perfil.Lider       => "lider",
        Perfil.Admin       => "admin",
        _ => throw new ArgumentOutOfRangeException(nameof(p))
    };

    /// <summary>Lê a forma do banco. Devolve null para valor desconhecido — o que
    /// só acontece se alguém inserir à revelia do CHECK, e aí é melhor não ter
    /// perfil do que ter o errado.</summary>
    public static Perfil? DoBanco(string? valor) => valor?.Trim().ToLowerInvariant() switch
    {
        "operacional" => Perfil.Operacional,
        "aprovador"   => Perfil.Aprovador,
        "lider"       => Perfil.Lider,
        "admin"       => Perfil.Admin,
        _ => null
    };
}
