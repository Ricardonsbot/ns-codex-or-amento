namespace NsCodex.Application.Abstractions;

/// <summary>O que o BANCO acha desta sessão. Existe para fechar a distância entre
/// "o token diz que sou a Ana" e "o Postgres está filtrando como se eu fosse a
/// Ana" — que são coisas diferentes, e cuja divergência é silenciosa.</summary>
public interface ISessaoDiagnostico
{
    Task<SessaoNoBanco> LerAsync(CancellationToken ct);
}

public sealed record SessaoNoBanco(
    string RoleDaConexao,
    string PessoaIdDeclarada,
    string PerfilDeclarado,
    long LancamentosVisiveis);
