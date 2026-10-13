// CPF no front: máscara de digitação, validação (mesma regra do servidor) e mascaramento para exibição.
// O CPF completo nunca é exibido: a tela mostra só ***.456.789-** (ver integracao/cpf.py no servidor).

export function digitos(valor) {
  return String(valor || '').replace(/\D/g, '');
}

export function mascaraDigitacao(valor) {
  const d = digitos(valor).slice(0, 11);
  if (d.length > 9) return d.replace(/(\d{3})(\d{3})(\d{3})(\d{1,2})/, '$1.$2.$3-$4');
  if (d.length > 6) return d.replace(/(\d{3})(\d{3})(\d{1,3})/, '$1.$2.$3');
  if (d.length > 3) return d.replace(/(\d{3})(\d{1,3})/, '$1.$2');
  return d;
}

export function valido(valor) {
  const d = digitos(valor);
  if (d.length !== 11 || /^(\d)\1{10}$/.test(d)) return false;
  for (const tamanho of [9, 10]) {
    let soma = 0;
    for (let i = 0; i < tamanho; i += 1) soma += Number(d[i]) * (tamanho + 1 - i);
    const dv = ((soma * 10) % 11) % 10;
    if (dv !== Number(d[tamanho])) return false;
  }
  return true;
}

export function mascarar(valor) {
  const d = digitos(valor);
  if (d.length !== 11) return '***.***.***-**';
  return `***.${d.slice(3, 6)}.${d.slice(6, 9)}-**`;
}
