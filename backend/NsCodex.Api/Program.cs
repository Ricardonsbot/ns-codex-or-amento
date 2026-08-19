using Microsoft.EntityFrameworkCore;
using NsCodex.Application.Abstractions;
using NsCodex.Infrastructure.Persistence;

var builder = WebApplication.CreateBuilder(args);

// ----- Config -----
// Connection string: DATABASE_URL (env) > ConnectionStrings:Default. Sem fallback para
// SQLite: o schema usa RLS, políticas e gatilhos que só existem no Postgres — um
// fallback que "sobe" mas não vale as regras seria pior do que não subir (ver o ramo
// SQLite morto da nsView, que o rodar-local.md dela avisa que quebra).
var conn = Environment.GetEnvironmentVariable("DATABASE_URL")
           ?? builder.Configuration.GetConnectionString("Default")
           ?? throw new InvalidOperationException(
               "DATABASE_URL ausente. Ex.: postgres://postgres:senha@localhost:5433/orcamento_dev");

if (conn.StartsWith("postgres://") || conn.StartsWith("postgresql://"))
    conn = UriParaKvp(conn);

builder.Services.AddDbContext<AppDbContext>(o => o.UseNpgsql(conn, npg => npg.CommandTimeout(30)));
builder.Services.AddScoped<IContaRepository, ContaRepository>();

builder.Services.AddControllers();

// Origens do front em desenvolvimento: o servidor do protótipo (8081). Em produção o
// front sai do mesmo nginx que a API e isto não se usa.
var corsOrigins = (Environment.GetEnvironmentVariable("CORS_ORIGINS")
                   ?? "http://localhost:8081,http://127.0.0.1:8081")
    .Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);
builder.Services.AddCors(o => o.AddDefaultPolicy(p =>
    p.WithOrigins(corsOrigins).AllowAnyHeader().AllowAnyMethod()));

var app = builder.Build();

app.UseCors();
app.MapControllers();

// Health sem banco de propósito: responde mesmo com o Postgres fora, e é o que o
// nginx e o deploy consultam para saber se o processo subiu.
app.MapGet("/health", () => Results.Ok(new { status = "ok", em = DateTime.UtcNow }));

app.Run();

static string UriParaKvp(string uri)
{
    var u = new Uri(uri);
    var userInfo = u.UserInfo.Split(':', 2);
    var user = Uri.UnescapeDataString(userInfo[0]);
    var pass = userInfo.Length > 1 ? Uri.UnescapeDataString(userInfo[1]) : string.Empty;
    var db = u.AbsolutePath.TrimStart('/');
    var port = u.Port > 0 ? u.Port : 5432;
    return $"Host={u.Host};Port={port};Database={db};Username={user};Password={pass}";
}
