using NsCodex.Domain.Enums;

namespace NsCodex.Domain.Entities;

/// <summary>
/// Uma conta do plano de contas (`cadastro.conta`).
///
/// O schema é escrito à mão em banco/01-cadastro.sql e continua sendo a verdade —
/// esta classe MAPEIA, não define. Nenhuma migration do EF sai daqui (ver
/// ARQUITETURA-NSVIEW.md §5).
/// </summary>
public class Conta
{
    public long Id { get; set; }
    public long? LinhaPlId { get; set; }
    public string Codigo { get; set; } = "";
    public string Descricao { get; set; } = "";

    /// <summary>
    /// A coluna `categoria` do banco NÃO é receita/despesa/capex — é o rótulo fino
    /// do plano de contas ("Benfeitorias e outros", "Equipamentos"), igual ao campo
    /// `categoria` de Referencias/contas.json. A categoria do lançamento é derivada
    /// da linha do P&L; ver <see cref="CategoriaLancamento"/>.
    /// </summary>
    public string? CategoriaContabil { get; set; }

    public string Natureza { get; set; } = "D";
    public bool Ativo { get; set; } = true;

    /// <summary>Nome da linha do P&L (`cadastro.linha_pl.nome`), carregado por join.</summary>
    public string? LinhaPl { get; set; }

    /// <summary>Categoria do lançamento, derivada da linha do P&L. Null = conta sem mapeamento.</summary>
    public Categoria? CategoriaLancamento => Contas.CategoriaDaConta.De(LinhaPl);
}
