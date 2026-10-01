/**
 * O nome de exibição de um usuário: o que vem antes do @ no e-mail
 * corporativo — "emerson.nakamura" em vez do endereço inteiro.
 *
 * É derivado do e-mail, não cadastrado à parte: não precisa de coluna nova
 * em lugar nenhum, e nunca fica desatualizado em relação a ele. Qualquer
 * tela que hoje mostra o e-mail cru como "quem fez isso" pode trocar por
 * este nome — é o mesmo dado, só sem o `@dominio` que ninguém lê.
 */
export function nomeDoUsuario(email) {
  if (!email) return null
  const [nome] = email.split('@')
  return nome || null
}
