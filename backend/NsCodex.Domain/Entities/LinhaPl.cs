namespace NsCodex.Domain.Entities;

/// <summary>Uma linha do P&L (`cadastro.linha_pl`). `Ordem` dá a sequência na tela e
/// `Sinal` diz se soma ou subtrai no bridge Revenue → Expenses → EBITDA → Capex.</summary>
public class LinhaPl
{
    public long Id { get; set; }
    public string Nome { get; set; } = "";
    public int Ordem { get; set; }
    public short Sinal { get; set; } = 1;
}
