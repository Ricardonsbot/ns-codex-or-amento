using NsCodex.Domain.Enums;

namespace NsCodex.Domain.Contas;

/// <summary>
/// Traduz a linha do P&L da conta na categoria do lançamento.
///
/// Porte fiel do `categoriaDaConta()` de assets/js/app.js — e, como lá, este é o
/// ÚNICO lugar onde a tradução existe. A lista de sugestão, o preenchimento
/// automático e a conferência da importação leem daqui: se cada um tivesse a sua,
/// uma aceitaria o que a outra recusa.
///
/// Mora no Domain de propósito. Na nsView a regra equivalente vive junto do EF, no
/// Infrastructure, e por isso não dá para exercitá-la sem subir contexto de banco.
/// Aqui é função pura sobre texto: o teste roda em milissegundos e não pede
/// Postgres nenhum.
/// </summary>
public static class CategoriaDaConta
{
    // O prefixo é o da linha do P&L no plano de contas real ("Despesas > Pessoal",
    // "Capex > Equipamentos"). O separador " >" faz parte do casamento: sem ele,
    // uma linha chamada "Receitas Financeiras" casaria com "Receita".
    private static readonly (string Prefixo, Categoria Categoria)[] Prefixos =
    [
        ("Receita",  Categoria.Receita),
        ("Despesas", Categoria.Despesa),
        ("Capex",    Categoria.Capex)
    ];

    /// <summary>
    /// Categoria da conta, ou null quando a linha do P&L não casa com nenhum prefixo
    /// conhecido — que é o caso das contas ainda sem mapeamento de P&L (o
    /// `01-cadastro.sql` deixa `linha_pl_id` nulo de propósito, porque a carga dos
    /// 630 códigos traz conta sem linha). Null aqui é dado incompleto, não erro.
    /// </summary>
    public static Categoria? De(string? linhaPl)
    {
        if (string.IsNullOrWhiteSpace(linhaPl)) return null;

        foreach (var (prefixo, categoria) in Prefixos)
            if (linhaPl.StartsWith(prefixo + " >", StringComparison.Ordinal))
                return categoria;

        return null;
    }
}
