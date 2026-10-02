namespace NsCodex.Infrastructure.Auth;

public class JwtSettings
{
    public string Issuer { get; set; } = "NsCodex";
    public string Audience { get; set; } = "NsCodex";
    public string SecretKey { get; set; } = string.Empty;

    /// <summary>Oito horas: um dia de trabalho. Quem orça passa a tarde na mesma
    /// tela, e expirar no meio de uma grade com centenas de linhas é como se
    /// perde trabalho.</summary>
    public int ExpiracaoMinutos { get; set; } = 480;
}
