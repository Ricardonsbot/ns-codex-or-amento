using System.Text;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.HttpOverrides;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using NsCodex.Api.Auth;
using NsCodex.Application.Abstractions;
using NsCodex.Infrastructure.Auth;
using NsCodex.Infrastructure.Persistence;

var builder = WebApplication.CreateBuilder(args);

// ----- Banco -----
// DATABASE_URL (env) > ConnectionStrings:Default. Sem fallback para SQLite: o
// schema usa RLS, políticas e gatilhos que só existem no Postgres — um fallback
// que "sobe" mas não vale as regras é pior do que não subir.
//
// ⚠ A credencial aqui é a da APLICAÇÃO (nscodex_app), que não é dona das tabelas.
// Com credencial de dona ou de superusuário, a RLS é ignorada e as políticas
// viram decoração. Ver infra/sql/roles.sql.
var conn = Environment.GetEnvironmentVariable("DATABASE_URL")
           ?? builder.Configuration.GetConnectionString("Default")
           ?? throw new InvalidOperationException(
               "DATABASE_URL ausente. Ex.: postgres://nscodex_app:senha@localhost:5432/nscodex");

if (conn.StartsWith("postgres://") || conn.StartsWith("postgresql://"))
    conn = UriParaKvp(conn);

// ----- JWT -----
var jwtSection = builder.Configuration.GetSection("Jwt");
var jwt = jwtSection.Get<JwtSettings>() ?? new JwtSettings();
var segredoEnv = Environment.GetEnvironmentVariable("JWT_SECRET");
if (!string.IsNullOrWhiteSpace(segredoEnv)) jwt.SecretKey = segredoEnv;

const string segredoDev = "dev-nao-use-em-producao-troque-por-32-ou-mais-caracteres";
if (string.IsNullOrWhiteSpace(jwt.SecretKey)) jwt.SecretKey = segredoDev;

// Fail-fast: em produção NUNCA assinar com o segredo de desenvolvimento (que é
// público, está aqui no arquivo) nem com chave curta. Aborta o boot alto em vez
// de degradar em silêncio — um token assinado com chave conhecida é um token que
// qualquer um forja.
if (!builder.Environment.IsDevelopment()
    && (jwt.SecretKey == segredoDev || jwt.SecretKey.Length < 32))
    throw new InvalidOperationException(
        "JWT_SECRET ausente ou fraco em produção. Defina JWT_SECRET com 32+ caracteres "
        + "no .env — boot abortado para não assinar token com chave de desenvolvimento.");

builder.Services.Configure<JwtSettings>(o =>
{
    o.Issuer = jwt.Issuer; o.Audience = jwt.Audience;
    o.SecretKey = jwt.SecretKey; o.ExpiracaoMinutos = jwt.ExpiracaoMinutos;
});

// ----- Entra ID -----
// TenantId/ClientId são públicos (ficam no appsettings), com override por env.
var entra = builder.Configuration.GetSection("Entra").Get<EntraSettings>() ?? new EntraSettings();
entra.TenantId = Environment.GetEnvironmentVariable("ENTRA_TENANT_ID") ?? entra.TenantId;
entra.ClientId = Environment.GetEnvironmentVariable("ENTRA_CLIENT_ID") ?? entra.ClientId;
builder.Services.Configure<EntraSettings>(o => { o.TenantId = entra.TenantId; o.ClientId = entra.ClientId; });
builder.Services.AddSingleton<EntraTokenValidator>();

// Sem Entra não há NENHUM caminho de entrada — não existe login por senha aqui.
// Isso é seguro (nada abre sozinho), mas é uma parada total, e uma parada total
// silenciosa vira meia hora de gente perguntando "o site caiu?". Então grita.
if (!entra.Habilitado)
    Console.Error.WriteLine(
        "[AVISO] Entra ID DESLIGADO (ENTRA_TENANT_ID/ENTRA_CLIENT_ID ausentes): "
        + "ninguém consegue entrar. Em produção isto é configuração errada.");

builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(o =>
    {
        o.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuer = true,
            ValidateAudience = true,
            ValidateLifetime = true,
            ValidateIssuerSigningKey = true,
            ValidIssuer = jwt.Issuer,
            ValidAudience = jwt.Audience,
            IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwt.SecretKey)),
            ClockSkew = TimeSpan.FromMinutes(1)
        };
    });
builder.Services.AddAuthorization();

// ----- DI -----
builder.Services.AddHttpContextAccessor();
builder.Services.AddScoped<ICurrentUser, CurrentUser>();
builder.Services.AddScoped<JwtTokenService>();
builder.Services.AddScoped<IContaRepository, ContaRepository>();
builder.Services.AddScoped<IPessoaRepository, PessoaRepository>();
builder.Services.AddScoped<ISessaoDiagnostico, SessaoDiagnostico>();

// O interceptor declara ao Postgres quem está agindo em toda conexão aberta.
// É o que faz a RLS e a auditoria funcionarem sem nenhuma rota lembrar de nada.
builder.Services.AddScoped<ContextoDaSessaoInterceptor>();
builder.Services.AddDbContext<AppDbContext>((sp, o) =>
    o.UseNpgsql(conn, npg => npg.CommandTimeout(30))
     .AddInterceptors(sp.GetRequiredService<ContextoDaSessaoInterceptor>()));

builder.Services.AddControllers();

var corsOrigins = (Environment.GetEnvironmentVariable("CORS_ORIGINS")
                   ?? "http://localhost:8081,http://127.0.0.1:8081")
    .Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);
builder.Services.AddCors(o => o.AddDefaultPolicy(p =>
    p.WithOrigins(corsOrigins).AllowAnyHeader().AllowAnyMethod()));

var app = builder.Build();

// Atrás do nginx o IP do cliente chega como 127.0.0.1. Confia só no proxy em
// loopback, nunca num X-Forwarded-For forjado por quem chama.
app.UseForwardedHeaders(new ForwardedHeadersOptions
{
    ForwardedHeaders = ForwardedHeaders.XForwardedFor | ForwardedHeaders.XForwardedProto,
    KnownProxies = { System.Net.IPAddress.Loopback, System.Net.IPAddress.IPv6Loopback }
});

app.UseCors();
app.UseAuthentication();
app.UseAuthorization();
app.MapControllers();

// Health sem banco e sem auth: responde mesmo com o Postgres fora, e é o que o
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

// Deixa o Program alcançável pelos testes.
public partial class Program { }
