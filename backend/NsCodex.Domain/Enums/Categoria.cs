namespace NsCodex.Domain.Enums;

/// <summary>
/// As três categorias de lançamento. Os nomes em minúscula são os mesmos gravados
/// no banco (CHECK de `lancamento.categoria` e de `pacote_categoria.categoria`) e
/// os mesmos que as telas já usam — não traduzir na borda.
/// </summary>
public enum Categoria
{
    Receita,
    Despesa,
    Capex
}

public static class CategoriaExtensions
{
    /// <summary>Forma gravada no banco: minúscula, sem acento.</summary>
    public static string ParaBanco(this Categoria c) => c switch
    {
        Categoria.Receita => "receita",
        Categoria.Despesa => "despesa",
        Categoria.Capex   => "capex",
        _ => throw new ArgumentOutOfRangeException(nameof(c))
    };
}
