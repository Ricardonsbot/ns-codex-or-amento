using System.IdentityModel.Tokens.Jwt;
using Microsoft.Extensions.Options;
using NsCodex.Domain.Entities;
using NsCodex.Domain.Enums;
using NsCodex.Infrastructure.Auth;

namespace NsCodex.Tests;

public class PerfilTests
{
    [Theory]
    [InlineData("operacional", Perfil.Operacional)]
    [InlineData("aprovador",   Perfil.Aprovador)]
    [InlineData("lider",       Perfil.Lider)]
    [InlineData("admin",       Perfil.Admin)]
    [InlineData("  ADMIN  ",   Perfil.Admin)]
    public void Le_a_forma_do_banco(string bruto, Perfil esperado)
        => Assert.Equal(esperado, PerfilExtensions.DoBanco(bruto));

    // Valor fora do CHECK do banco não vira "operacional" por conveniência:
    // adivinhar o perfil de alguém é a pior hora para ser prestativo.
    [Theory]
    [InlineData("gerente")]
    [InlineData("")]
    [InlineData(null)]
    public void Valor_desconhecido_nao_vira_perfil(string? bruto)
        => Assert.Null(PerfilExtensions.DoBanco(bruto));

    // A string tem de bater EXATAMENTE com o CHECK de cadastro.pessoa e com o que
    // app_perfil() compara na RLS. "Admin" em vez de "admin" faz o aprovador
    // deixar de enxergar tudo, sem erro nenhum.
    [Fact]
    public void Grafia_gravada_e_a_do_banco()
    {
        Assert.Equal("operacional", Perfil.Operacional.ParaBanco());
        Assert.Equal("aprovador",   Perfil.Aprovador.ParaBanco());
        Assert.Equal("lider",       Perfil.Lider.ParaBanco());
        Assert.Equal("admin",       Perfil.Admin.ParaBanco());
    }

    [Fact]
    public void Ida_e_volta_fecha_para_todos_os_perfis()
    {
        foreach (var p in Enum.GetValues<Perfil>())
            Assert.Equal(p, PerfilExtensions.DoBanco(p.ParaBanco()));
    }
}

public class PermissaoClaimsTests
{
    private static Pessoa Ana() => new()
    {
        Id = 42, Login = "ana.alfa", Nome = "Ana Alfa",
        Email = "ana@nstech.com.br", PerfilBruto = "operacional", Ativo = true
    };

    [Fact]
    public void Monta_as_claims_que_o_resto_do_sistema_le()
    {
        var claims = PermissaoClaims.Montar(Ana());
        string? v(string t) => claims.FirstOrDefault(c => c.Type == t)?.Value;

        Assert.Equal("42",                v(JwtRegisteredClaimNames.Sub));
        Assert.Equal("ana.alfa",          v(PermissaoClaims.ClaimLogin));
        Assert.Equal("Ana Alfa",          v(PermissaoClaims.ClaimNome));
        Assert.Equal("operacional",       v(PermissaoClaims.ClaimPerfil));
        Assert.Equal("ana@nstech.com.br", v(JwtRegisteredClaimNames.Email));
        Assert.Equal(PermissaoClaims.VersaoAtual, v(PermissaoClaims.ClaimVersao));
    }

    // O token NÃO carrega a lista de empresas: quem deriva escopo é a RLS, a
    // partir de pessoa_empresa. Duplicar aqui criaria uma verdade que envelhece —
    // tirar alguém de uma empresa não teria efeito até o token expirar.
    [Fact]
    public void Nao_carrega_escopo_de_empresa()
    {
        var claims = PermissaoClaims.Montar(Ana());
        Assert.DoesNotContain(claims, c => c.Type.Contains("empresa"));
    }

    [Fact]
    public void Pessoa_sem_email_nao_gera_claim_vazia()
    {
        var p = Ana(); p.Email = null;
        Assert.DoesNotContain(PermissaoClaims.Montar(p), c => c.Type == JwtRegisteredClaimNames.Email);
    }
}

public class JwtTokenServiceTests
{
    private static JwtTokenService Servico() => new(Options.Create(new JwtSettings
    {
        Issuer = "NsCodex", Audience = "NsCodex",
        SecretKey = "chave-de-teste-com-mais-de-32-caracteres-ok",
        ExpiracaoMinutos = 480
    }));

    [Fact]
    public void Token_sai_assinado_e_com_as_claims_dentro()
    {
        var (token, expira) = Servico().Criar(new Pessoa
        {
            Id = 7, Login = "bruno.beta", Nome = "Bruno Beta", PerfilBruto = "admin"
        });

        var lido = new JwtSecurityTokenHandler().ReadJwtToken(token);
        Assert.Equal("NsCodex", lido.Issuer);
        Assert.Contains("NsCodex", lido.Audiences);
        Assert.Equal("7",     lido.Claims.First(c => c.Type == JwtRegisteredClaimNames.Sub).Value);
        Assert.Equal("admin", lido.Claims.First(c => c.Type == PermissaoClaims.ClaimPerfil).Value);
        Assert.True(expira > DateTime.UtcNow.AddMinutes(470));
    }

    // Oito horas é decisão: quem orça passa a tarde na mesma tela, e expirar no
    // meio de uma grade com centenas de linhas é como se perde trabalho.
    [Fact]
    public void Validade_padrao_e_de_oito_horas()
    {
        var (_, expira) = Servico().Criar(new Pessoa { Id = 1, Login = "x", Nome = "X" });
        Assert.InRange((expira - DateTime.UtcNow).TotalMinutes, 479, 480);
    }
}
