namespace NsCodex.Domain.Acesso;

/// <summary>
/// "Esta pessoa alcança esta seção?" — a decisão, isolada de HTTP e de banco.
///
/// Mora aqui e não dentro do filtro do ASP.NET porque tem DOIS consumidores: o
/// gate dos endpoints e, quando existir, o que decide o que aparece no menu. Se
/// cada um tivesse a sua cópia, o menu ofereceria tela que a rota recusa — que é
/// a forma mais irritante de errar permissão.
/// </summary>
public static class SecaoEnforce
{
    public static bool Permite(
        bool fiscalizando,
        bool autenticado,
        bool ehAdmin,
        IReadOnlySet<string> secoesDaPessoa,
        string secaoExigida)
    {
        // Fiscalização desligada: o filtro é no-op. Existe para destravar a
        // operação sem deploy — o modo de falha que isso evita é alguém dar
        // admin para todo mundo às 22h de domingo.
        if (!fiscalizando) return true;

        if (!autenticado) return false;

        // Admin passa em tudo. É o mesmo desenho da nsView, e a alternativa —
        // conceder as seis seções a cada admin — só cria a chance de esquecer uma.
        if (ehAdmin) return true;

        return secoesDaPessoa.Contains(secaoExigida);
    }
}
