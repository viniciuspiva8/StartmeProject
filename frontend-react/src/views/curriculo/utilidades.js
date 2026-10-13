
export function pendenciasDoCurriculo(cv) {
  const p = [];
  if (!cv.contato?.email || !cv.contato?.telefone) p.push('Preencher e-mail e telefone');
  if (!cv.resumo?.trim()) p.push('Escrever um resumo de duas ou três frases');
  if (!cv.certificacoes?.length) p.push('Adicionar uma certificação');
  if (!cv.atividades?.length) p.push('Adicionar uma atividade acadêmica ou voluntariado');
  if (!cv.idiomas?.length) p.push('Adicionar um idioma');
  return p;
}

export const separarHabilidades = (texto) => texto.split(/[,;]/).map((x) => x.trim()).filter(Boolean);
