using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Filters;
using NsCodex.Application.Abstractions;
using NsCodex.Domain.Acesso;

namespace NsCodex.Api.Auth;

/// <summary>
/// Segunda camada de RBAC: barra o ENDPOINT por seção. Ortogonal à RLS, que
/// filtra LINHA por empresa. Uso: [RequerSecao("cadastro")].
///
/// Por que as duas camadas: a RLS responde "quais lançamentos são seus"; ela não
/// tem como responder "você pode abrir a tela de auditoria". Sem esta, qualquer
/// pessoa autenticada alcança qualquer rota que exista.
/// </summary>
public sealed class RequerSecaoAttribute : TypeFilterAttribute
{
    public RequerSecaoAttribute(string secao) : base(typeof(RequerSecaoFilter))
        => Arguments = [secao];
}

public sealed class RequerSecaoFilter : IAsyncAuthorizationFilter
{
    private readonly string _secao;
    private readonly ICurrentUser _usuario;
    private readonly ISecoesDaPessoa _secoes;
    private readonly IPlataformaConfig _config;

    public RequerSecaoFilter(string secao, ICurrentUser usuario,
                             ISecoesDaPessoa secoes, IPlataformaConfig config)
    {
        _secao = secao; _usuario = usuario; _secoes = secoes; _config = config;
    }

    public async Task OnAuthorizationAsync(AuthorizationFilterContext contexto)
    {
        var ct = contexto.HttpContext.RequestAborted;
        var fiscalizando = await _config.RbacSecaoEnforceAsync(ct);

        // Não-autenticado é 401 e não 403: são coisas diferentes para quem está
        // do outro lado — "faça login" contra "você não tem acesso a isto".
        if (fiscalizando && !_usuario.EstaAutenticado)
        {
            contexto.Result = new UnauthorizedResult();
            return;
        }

        var minhas = _usuario.PessoaId is long id && fiscalizando && !_usuario.EhAdmin
            ? await _secoes.DeAsync(id, ct)
            : new HashSet<string>();

        if (SecaoEnforce.Permite(fiscalizando, _usuario.EstaAutenticado,
                                 _usuario.EhAdmin, minhas, _secao))
            return;

        contexto.Result = new ObjectResult(new
        {
            mensagem = $"Seu acesso não inclui a seção '{_secao}'. Fale com o admin."
        })
        { StatusCode = StatusCodes.Status403Forbidden };
    }
}
