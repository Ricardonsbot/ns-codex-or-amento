using System.Text.Json.Serialization;

namespace NsCodex.Application.Dtos;

/// <summary>
/// O CONTRATO DE LEITURA: uma conta no formato de Referencias/contas.json.
///
/// Esta é a decisão que barateia a migração inteira (BACKEND.md §2). Se
/// GET /api/ref/contas devolver o mesmo que o arquivo devolve hoje, o
/// `carregarRef()` do app.js muda uma linha — a URL — e as 19 telas passam a ler
/// do banco sem mais nada mudar. Por isso os nomes aqui são camelCase e iguais aos
/// do JSON, e NÃO os nomes das colunas.
///
/// ⚠ Quatro campos do JSON (pacote, subpacote, caixa, linhaPLDetalhe) ainda não
/// têm coluna em cadastro.conta — vão nulos até o schema ganhar as colunas ou
/// alguém decidir que saem do contrato. Ver ESQUELETO.md §"O que falta".
/// </summary>
public sealed class ContaRefDto
{
    [JsonPropertyName("conta")]          public string Conta { get; init; } = "";
    [JsonPropertyName("nome")]           public string Nome { get; init; } = "";
    [JsonPropertyName("linhaPL")]        public string? LinhaPl { get; init; }
    [JsonPropertyName("categoria")]      public string? Categoria { get; init; }
    [JsonPropertyName("pacote")]         public string? Pacote { get; init; }
    [JsonPropertyName("subpacote")]      public string? Subpacote { get; init; }
    [JsonPropertyName("caixa")]          public string? Caixa { get; init; }
    [JsonPropertyName("linhaPLDetalhe")] public string? LinhaPlDetalhe { get; init; }
}
