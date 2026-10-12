// Logo do StartMe. Os arquivos em public/ são recortes do SVG oficial
// (design-reference/logo/StartMe_logo_vetorizada.svg): só mudam o viewBox, o desenho é o mesmo.
//
//   simbolo  M com seta, quadrado. Cabe em chips e tiles pequenos.
//   completo símbolo + "StartMe" embaixo. Só vale a partir de ~96 px de altura; abaixo disso
//            o texto fica ilegível.
//
// O texto "Start" do logo é azul-escuro (#042D5C), a cor do cabeçalho do app, e a ponta
// esquerda do símbolo também some sobre esse azul. Sobre fundo azul, use um chip branco.
const ARQUIVOS = {
  simbolo: 'logo-startme-simbolo.svg',
  completo: 'logo-startme.svg',
};

/** `titulo` vazio (padrão) marca o logo como decorativo; passe "StartMe" quando ele for a única identificação. */
export default function Logo({ variante = 'simbolo', size = 32, titulo = '', className = '' }) {
  const altura = size;
  const largura = variante === 'completo' ? Math.round(size * (387 / 392)) : size;
  return (
    <img
      src={`${import.meta.env.BASE_URL}${ARQUIVOS[variante]}`}
      alt={titulo}
      width={largura}
      height={altura}
      draggable={false}
      className={className}
    />
  );
}
