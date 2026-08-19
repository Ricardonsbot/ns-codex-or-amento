using System.IdentityModel.Tokens.Jwt;
using System.Text;
using Microsoft.Extensions.Options;
using Microsoft.IdentityModel.Tokens;
using NsCodex.Domain.Entities;

namespace NsCodex.Infrastructure.Auth;

/// <summary>Assina o token da aplicação. O que as claims significam mora em
/// <see cref="PermissaoClaims"/>; aqui só se assina e se data.</summary>
public class JwtTokenService
{
    private readonly JwtSettings _settings;
    public JwtTokenService(IOptions<JwtSettings> opts) => _settings = opts.Value;

    public (string Token, DateTime ExpiraEm) Criar(Pessoa pessoa)
    {
        var expira = DateTime.UtcNow.AddMinutes(_settings.ExpiracaoMinutos);
        var chave = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(_settings.SecretKey));

        var token = new JwtSecurityToken(
            issuer: _settings.Issuer,
            audience: _settings.Audience,
            claims: PermissaoClaims.Montar(pessoa),
            expires: expira,
            signingCredentials: new SigningCredentials(chave, SecurityAlgorithms.HmacSha256));

        return (new JwtSecurityTokenHandler().WriteToken(token), expira);
    }
}
