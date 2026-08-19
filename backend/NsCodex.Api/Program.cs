using System.Text;
using System.Threading.RateLimiting;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.HttpOverrides;
using Microsoft.AspNetCore.RateLimiting;
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
builder.Services.AddScoped<ISecoesDaPessoa, SecoesDaPessoa>();
// Singleton: guarda o cache de 30s das flags e vive além de um request.
builder.Services.AddSingleton<IPlataformaConfig, PlataformaConfig>();

// O interceptor declara ao Postgres quem está agindo em toda conexão aberta.
// É o que faz a RLS e a auditoria funcionarem sem nenhuma rota lembrar de nada.
builder.Services.AddScoped<ContextoDaSessaoInterceptor>();
builder.Services.AddDbContext<AppDbContext>((sp, o) =>
    o.UseNpgsql(conn, npg => npg.CommandTimeout(30))
     .AddInterceptors(sp.GetRequiredService<ContextoDaSessaoInterceptor>()));

// ----- Rate limiting -----
// Portado da nsView. Antes disso, toda leitura era ilimitada — e o
// /api/ref/contas já devolve 424 linhas por chamada.
//
// Particionado por USUÁRIO (claim `sub`), não por IP: o escritório sai por NAT
// compartilhado, então partição por IP puniria todo mundo pelo comportamento de
// um. Sem identidade (antes do login) cai no IP, que é o melhor disponível ali.
//
// ⚠ Depende de ctx.User já estar populado, ou seja, o UseRateLimiter TEM de vir
// depois do UseAuthentication. Está assim no pipeline abaixo; se alguém subir o
// limiter na ordem, tudo silenciosamente vira partição por IP.
static string ChavePorUsuario(HttpContext ctx) =>
    ctx.User.FindFirst("sub")?.Value
    ?? ctx.User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value
    ?? ctx.Connection.RemoteIpAddress?.ToString()
    ?? "sem-identidade";

builder.Services.AddRateLimiter(o =>
{
    o.RejectionStatusCode = StatusCodes.Status429TooManyRequests;

    // 429 com Retry-After: é o que um cliente automatizado sabe respeitar — o
    // header manda ele recuar sozinho. Fila seria pior: esconderia a saturação e
    // viraria latência inexplicável para o humano do outro lado do mesmo banco.
    o.OnRejected = async (ctx, ct) =>
    {
        if (ctx.Lease.TryGetMetadata(MetadataName.RetryAfter, out var espera))
            ctx.HttpContext.Response.Headers.RetryAfter = ((int)espera.TotalSeconds).ToString();
        await ctx.HttpContext.Response.WriteAsJsonAsync(
            new { mensagem = "Limite de requisições excedido. Aguarde e tente novamente." }, ct);
    };

    // Teto geral, em TODA rota. Global em vez de anotação espalhada por
    // controller: dono único, e não há como esquecer de anotar um endpoint novo.
    // Uma tela carrega ~5-10 requests; 600/min são 10/s sustentados por pessoa,
    // que nenhuma sessão humana alcança.
    o.GlobalLimiter = PartitionedRateLimiter.Create<HttpContext, string>(ctx =>
        RateLimitPartition.GetFixedWindowLimiter(ChavePorUsuario(ctx),
            _ => new FixedWindowRateLimiterOptions
            { PermitLimit = 600, Window = TimeSpan.FromMinutes(1), QueueLimit = 0 }));

    // Anti-força-bruta no login. Generoso de propósito: vários usuários saem pelo
    // MESMO IP público, então um limite apertado barraria gente de verdade numa
    // segunda de manhã. O SSO é assinado pela Microsoft — não dá para adivinhar
    // por tentativa — então isto é teto de volume, não de adivinhação.
    o.AddPolicy("auth", ctx =>
        RateLimitPartition.GetFixedWindowLimiter(
            ctx.Connection.RemoteIpAddress?.ToString() ?? "sem-ip",
            _ => new FixedWindowRateLimiterOptions
            { PermitLimit = 30, Window = TimeSpan.FromMinutes(5), QueueLimit = 0 }));

    // Endpoints que devolvem catálogo inteiro numa request — o eixo caro. Para
    // humano é correto e barato (troca filtro no cliente, não refaz a chamada);
    // para consumidor automatizado é o contrário. O global roda ANTES e os dois
    // encadeiam: este é teto adicional, não substituto.
    o.AddPolicy("cubo", ctx =>
        RateLimitPartition.GetFixedWindowLimiter(ChavePorUsuario(ctx),
            _ => new FixedWindowRateLimiterOptions
            { PermitLimit = 60, Window = TimeSpan.FromMinutes(1), QueueLimit = 0 }));
});

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
// Depois do UseAuthentication de propósito: a partição usa a claim "sub".
app.UseRateLimiter();
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
