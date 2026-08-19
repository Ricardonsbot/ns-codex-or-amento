using Microsoft.EntityFrameworkCore;
using NsCodex.Domain.Entities;

namespace NsCodex.Infrastructure.Persistence;

/// <summary>
/// Contexto de leitura/escrita do banco do NS Codex.
///
/// ⚠ DATABASE-FIRST, de propósito. O schema mora em banco/*.sql e contém coisas
/// que o EF não sabe modelar: Row Level Security, políticas, gatilhos de versão
/// fechada, trilha append-only, índices parciais. Se o EF gerasse o schema, tudo
/// isso se perderia — e é justamente o que faz o DELETE de outra empresa devolver
/// zero linha (ver o teste T2 da Fase 0).
///
/// Portanto: NUNCA rodar `dotnet ef migrations add`. Schema evolui por SQL
/// numerado; aqui só se mapeia o que já existe.
/// </summary>
public class AppDbContext : DbContext
{
    public AppDbContext(DbContextOptions<AppDbContext> options) : base(options) { }

    public DbSet<Conta> Contas => Set<Conta>();
    public DbSet<LinhaPl> LinhasPl => Set<LinhaPl>();
    public DbSet<Pessoa> Pessoas => Set<Pessoa>();

    protected override void OnModelCreating(ModelBuilder mb)
    {
        mb.Entity<Pessoa>(e =>
        {
            e.ToTable("pessoa", "cadastro");
            e.HasKey(x => x.Id);
            e.Property(x => x.Id).HasColumnName("id");
            e.Property(x => x.Login).HasColumnName("login");
            e.Property(x => x.Nome).HasColumnName("nome");
            e.Property(x => x.Email).HasColumnName("email");
            e.Property(x => x.PerfilBruto).HasColumnName("perfil");
            e.Property(x => x.Ativo).HasColumnName("ativo");
            e.Ignore(x => x.Perfil);
        });

        mb.Entity<LinhaPl>(e =>
        {
            e.ToTable("linha_pl", "cadastro");
            e.HasKey(x => x.Id);
            e.Property(x => x.Id).HasColumnName("id");
            e.Property(x => x.Nome).HasColumnName("nome");
            e.Property(x => x.Ordem).HasColumnName("ordem");
            e.Property(x => x.Sinal).HasColumnName("sinal");
        });

        mb.Entity<Conta>(e =>
        {
            e.ToTable("conta", "cadastro");
            e.HasKey(x => x.Id);
            e.Property(x => x.Id).HasColumnName("id");
            e.Property(x => x.LinhaPlId).HasColumnName("linha_pl_id");
            e.Property(x => x.Codigo).HasColumnName("codigo");
            e.Property(x => x.Descricao).HasColumnName("descricao");
            e.Property(x => x.CategoriaContabil).HasColumnName("categoria");
            e.Property(x => x.Natureza).HasColumnName("natureza");
            e.Property(x => x.Ativo).HasColumnName("ativo");

            // LinhaPl vem de cadastro.linha_pl por join — não é coluna de conta.
            // Ignorado no mapeamento e preenchido pelo repositório.
            e.Ignore(x => x.LinhaPl);
            e.Ignore(x => x.CategoriaLancamento);
        });
    }
}
