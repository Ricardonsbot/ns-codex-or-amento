using NsCodex.Domain.Contas;
using NsCodex.Domain.Enums;

namespace NsCodex.Tests;

/// <summary>
/// A tradução linha do P&L → categoria é regra de Domain: função pura, testada sem
/// banco. Os casos vêm do plano de contas real (Referencias/contas.json).
/// </summary>
public class CategoriaDaContaTests
{
    [Theory]
    [InlineData("Capex > Benfeitorias e outros", Categoria.Capex)]
    [InlineData("Capex > Equipamentos",          Categoria.Capex)]
    [InlineData("Despesas > Pessoal",            Categoria.Despesa)]
    [InlineData("Receita > Serviços",            Categoria.Receita)]
    public void Deriva_a_categoria_do_prefixo(string linhaPl, Categoria esperada)
        => Assert.Equal(esperada, CategoriaDaConta.De(linhaPl));

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("   ")]
    public void Conta_sem_linha_de_pl_nao_tem_categoria(string? linhaPl)
        => Assert.Null(CategoriaDaConta.De(linhaPl));

    // O separador " >" faz parte do casamento. Sem ele, "Receitas Financeiras"
    // entraria como Receita — e o CONTEXTO.md registra que trocar catálogo já
    // deixou linha órfã três vezes. Este teste é a trava.
    [Theory]
    [InlineData("Receitas Financeiras")]
    [InlineData("Despesas Financeiras")]
    [InlineData("Outras contas")]
    public void Prefixo_solto_sem_separador_nao_casa(string linhaPl)
        => Assert.Null(CategoriaDaConta.De(linhaPl));

    // A grafia é a do plano de contas: "Despesas" no plural, "Receita" no singular.
    // Trocar isso quebra a derivação inteira em silêncio.
    [Fact]
    public void Grafia_do_plano_de_contas_e_a_que_vale()
    {
        Assert.Null(CategoriaDaConta.De("Despesa > Pessoal"));    // singular não existe
        Assert.Null(CategoriaDaConta.De("Receitas > Serviços"));  // plural não existe
    }
}
