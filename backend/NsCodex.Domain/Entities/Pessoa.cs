using NsCodex.Domain.Enums;

namespace NsCodex.Domain.Entities;

/// <summary>
/// Uma pessoa (`cadastro.pessoa`).
///
/// ⚠ NÃO TEM SENHA, e é de propósito — o comentário do 01-cadastro.sql já dizia
/// que a autenticação vem do login corporativo. Quem valida quem é quem é o
/// Entra ID; esta tabela responde outra pergunta: essa pessoa tem acesso, e com
/// que perfil.
/// </summary>
public class Pessoa
{
    public long Id { get; set; }
    public string Login { get; set; } = "";
    public string Nome { get; set; } = "";
    public string? Email { get; set; }
    public string PerfilBruto { get; set; } = "operacional";
    public bool Ativo { get; set; } = true;

    public Perfil? Perfil => PerfilExtensions.DoBanco(PerfilBruto);
}
