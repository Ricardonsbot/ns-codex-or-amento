using Microsoft.AspNetCore.Mvc;
using NsCodex.Application.Abstractions;
using NsCodex.Application.Dtos;

namespace NsCodex.Api.Controllers;

/// <summary>
/// Os catálogos que hoje moram em Referencias/*.json, servidos do banco NO MESMO
/// FORMATO. É o contrato que faz o `carregarRef()` do app.js mudar uma linha só.
///
/// Controller FINO de propósito: recebe, chama, devolve. A regra fica no Domain e
/// a consulta no Infrastructure — é onde a nsView escorregou (services de 2.000
/// linhas dentro do Infrastructure) e onde dá para não escorregar começando agora.
/// </summary>
[ApiController]
[Route("api/ref")]
public class RefController : ControllerBase
{
    private readonly IContaRepository _contas;
    public RefController(IContaRepository contas) => _contas = contas;

    [HttpGet("contas")]
    public async Task<ActionResult<IEnumerable<ContaRefDto>>> Contas(CancellationToken ct)
    {
        var contas = await _contas.ListarAsync(ct);
        return Ok(contas.Select(c => new ContaRefDto
        {
            Conta     = c.Codigo,
            Nome      = c.Descricao,
            LinhaPl   = c.LinhaPl,
            Categoria = c.CategoriaContabil
            // pacote, subpacote, caixa e linhaPLDetalhe seguem nulos: ainda não há
            // coluna para eles em cadastro.conta. Ver ESQUELETO.md §"O que falta".
        }));
    }
}
