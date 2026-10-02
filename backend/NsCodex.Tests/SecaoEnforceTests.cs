using NsCodex.Domain.Acesso;

namespace NsCodex.Tests;

/// <summary>
/// A decisão de seção é função pura — testada sem banco e sem HTTP. É a mesma
/// função que o gate dos endpoints usa e que o menu vai usar; se ela estiver
/// certa aqui, os dois concordam por construção.
/// </summary>
public class SecaoEnforceTests
{
    private static HashSet<string> Secoes(params string[] s) => new(s, StringComparer.OrdinalIgnoreCase);

    // Fiscalização desligada é NO-OP: existe para destravar a operação sem
    // deploy. Se ela barrasse alguma coisa, não serviria para o que foi feita.
    [Theory]
    [InlineData(true,  false)]
    [InlineData(false, false)]
    public void Fiscalizacao_desligada_libera_qualquer_um(bool autenticado, bool admin)
        => Assert.True(SecaoEnforce.Permite(false, autenticado, admin, Secoes(), "auditoria"));

    [Fact]
    public void Sem_autenticacao_nao_passa()
        => Assert.False(SecaoEnforce.Permite(true, false, false, Secoes("auditoria"), "auditoria"));

    // Admin passa em tudo. A alternativa — conceder as seis seções a cada admin —
    // só cria a chance de esquecer uma.
    [Fact]
    public void Admin_passa_sem_ter_a_secao()
        => Assert.True(SecaoEnforce.Permite(true, true, true, Secoes(), "auditoria"));

    [Fact]
    public void Com_a_secao_passa()
        => Assert.True(SecaoEnforce.Permite(true, true, false, Secoes("cadastro", "orcamento"), "orcamento"));

    // Default-deny de verdade: ter UMA seção não dá as outras.
    [Fact]
    public void Sem_a_secao_nao_passa()
        => Assert.False(SecaoEnforce.Permite(true, true, false, Secoes("cadastro"), "auditoria"));

    [Fact]
    public void Sem_secao_nenhuma_nao_passa()
        => Assert.False(SecaoEnforce.Permite(true, true, false, Secoes(), "cadastro"));

    // O código da seção vem do banco de um lado e de um literal em C# do outro.
    // Diferença de caixa entre os dois viraria 403 para quem tem acesso.
    [Theory]
    [InlineData("CADASTRO")]
    [InlineData("Cadastro")]
    public void Caixa_do_codigo_nao_decide_acesso(string comoVeioDoBanco)
        => Assert.True(SecaoEnforce.Permite(true, true, false, Secoes(comoVeioDoBanco), "cadastro"));

    // Seção que ninguém concedeu não vira acesso por acaso — inclusive uma que
    // não exista no catálogo.
    [Fact]
    public void Secao_desconhecida_nao_passa()
        => Assert.False(SecaoEnforce.Permite(true, true, false, Secoes("cadastro"), "secao-que-nao-existe"));
}
