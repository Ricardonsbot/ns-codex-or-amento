using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using NsCodex.Application.Abstractions;
using NsCodex.Application.Dtos;
using NsCodex.Domain.Enums;
using NsCodex.Infrastructure.Auth;

namespace NsCodex.Api.Controllers;

/// <summary>
/// Entrada na plataforma. Um caminho só: SSO Microsoft.
///
/// Não existe login por senha porque `cadastro.pessoa` não tem coluna de senha —
/// decisão registrada no 01-cadastro.sql, e mantida. A consequência é honesta e
/// precisa ser dita: se o Entra estiver mal configurado ou fora do ar, ninguém
/// entra. Não há break-glass. Criar um exigiria coluna de senha, e uma conta de
/// emergência com senha é uma porta permanente para poupar um problema raro.
/// </summary>
[ApiController]
[Route("api/auth")]
public class AuthController : ControllerBase
{
    private readonly IPessoaRepository _pessoas;
    private readonly EntraTokenValidator _entra;
    private readonly JwtTokenService _jwt;
    private readonly ICurrentUser _eu;
    private readonly ILogger<AuthController> _log;

    public AuthController(IPessoaRepository pessoas, EntraTokenValidator entra,
                          JwtTokenService jwt, ICurrentUser eu, ILogger<AuthController> log)
    {
        _pessoas = pessoas; _entra = entra; _jwt = jwt; _eu = eu; _log = log;
    }

    /// <summary>Config pública: a tela de login pergunta antes de desenhar o botão.</summary>
    [HttpGet("config")]
    [AllowAnonymous]
    public ActionResult<AuthConfigDto> Config()
        => Ok(new AuthConfigDto
        {
            SsoDisponivel = _entra.Habilitado,
            TenantId = _entra.Habilitado ? _entra.TenantId : null,
            ClientId = _entra.Habilitado ? _entra.ClientId : null
        });

    [HttpPost("sso")]
    [AllowAnonymous]
    [EnableRateLimiting("auth")]
    public async Task<ActionResult<LoginResponse>> Sso([FromBody] SsoLoginRequest req, CancellationToken ct)
    {
        if (!_entra.Habilitado)
            return StatusCode(503, new { mensagem = "Login Microsoft não está configurado." });
        if (string.IsNullOrWhiteSpace(req.IdToken))
            return BadRequest(new { mensagem = "Token ausente." });

        var emails = await _entra.ValidarEmailsAsync(req.IdToken, ct);
        if (emails.Count == 0)
            return Unauthorized(new { mensagem = "Não foi possível validar sua conta Microsoft." });

        var pessoa = await _pessoas.PorIdentificadoresAsync(emails, ct);
        if (pessoa is null)
        {
            // Loga o e-mail para o admin conseguir cadastrar quem pediu acesso —
            // sem isso a pessoa reclama "não entro" e ninguém sabe com qual conta.
            var exibir = emails.FirstOrDefault(e => e.Contains('@') && !e.Contains("#ext#")) ?? emails[0];
            _log.LogInformation("SSO recusado: {Email} não está em cadastro.pessoa (ou está inativa)", exibir);
            return Unauthorized(new { mensagem = $"A conta {exibir} ainda não tem acesso. Fale com o admin." });
        }

        // Perfil ilegível é recusa, não default para operacional: um valor fora
        // do CHECK significa banco mexido à mão, e adivinhar o perfil de alguém
        // é a pior hora para ser prestativo.
        if (pessoa.Perfil is null)
        {
            _log.LogWarning("Pessoa {Id} com perfil inválido no banco: '{Perfil}'", pessoa.Id, pessoa.PerfilBruto);
            return Unauthorized(new { mensagem = "Seu cadastro está inconsistente. Fale com o admin." });
        }

        var (token, expira) = _jwt.Criar(pessoa);
        return Ok(new LoginResponse
        {
            Token = token,
            ExpiraEm = expira,
            Eu = Montar(pessoa.Id, pessoa.Login, pessoa.Nome, pessoa.Email, pessoa.Perfil.Value)
        });
    }

    /// <summary>Quem sou eu, segundo o token que estou usando agora.</summary>
    [HttpGet("eu")]
    [Authorize]
    public ActionResult<EuDto> Eu()
        => Ok(Montar(_eu.PessoaId ?? 0, _eu.Login ?? "", _eu.Nome ?? "", _eu.Email,
                     _eu.Perfil ?? Perfil.Operacional));

    /// <summary>
    /// O que o BANCO acha desta sessão. Diagnóstico, não dado de negócio: serve
    /// para responder "a RLS está valendo para mim agora?" sem abrir psql. A
    /// contagem de lançamentos passa pela política, então um número diferente do
    /// esperado é sintoma de contexto de sessão não declarado.
    /// </summary>
    [HttpGet("sessao")]
    [Authorize]
    public async Task<ActionResult> Sessao([FromServices] ISessaoDiagnostico diag, CancellationToken ct)
        => Ok(await diag.LerAsync(ct));

    private static EuDto Montar(long id, string login, string nome, string? email, Perfil perfil)
        => new() { Id = id, Login = login, Nome = nome, Email = email, Perfil = perfil.ParaBanco() };
}
