'use strict';

/* ==============================================================
   INTERAÇÕES DO PORTFÓLIO
   1. Mede o menu fixo.
   2. Destaca o link da secção visível.
   3. Reduz o texto apenas quando ele não cabe no respetivo cartão.
   As cores, posições e tamanhos principais ficam em style.css.
   ============================================================== */

const menuFixo = document.querySelector('.menu-fixo');
const linksDoMenu = [...document.querySelectorAll('.menu-fixo a')];
const secoesDoPortfolio = [...document.querySelectorAll('.secao-portfolio')];

/* 1. ALTURA DO MENU
   O CSS usa esta medida para deixar o conteúdo abaixo do menu. */
function atualizarAlturaDoMenu() {
  const alturaDoMenu = menuFixo.getBoundingClientRect().height;
  const tamanhoDaFonteBase = Number.parseFloat(
    getComputedStyle(document.documentElement).fontSize
  );
  const alturaEmRem = alturaDoMenu / tamanhoDaFonteBase;

  document.documentElement.style.setProperty('--altura-menu', `${alturaEmRem}rem`);
}

/* 2. LINK DA SECÇÃO VISÍVEL
   As quatro partes da galeria correspondem ao link Trabalhos. */
function destacarSecaoVisivel(entradas) {
  for (const entrada of entradas) {
    if (!entrada.isIntersecting) continue;

    const secaoVisivel = entrada.target;
    const identificador = secaoVisivel.classList.contains('secao-galeria')
      ? 'trabalhos'
      : secaoVisivel.id;

    for (const link of linksDoMenu) {
      if (link.hash === `#${identificador}`) {
        link.setAttribute('aria-current', 'location');
      } else {
        link.removeAttribute('aria-current');
      }
    }
  }
}

function acompanharSecoes() {
  if (!('IntersectionObserver' in window)) return;

  const observadorDasSecoes = new IntersectionObserver(destacarSecaoVisivel, {
    rootMargin: '-35% 0% -35% 0%',
    threshold: 0
  });

  for (const secao of secoesDoPortfolio) {
    observadorDasSecoes.observe(secao);
  }
}

/* 3. TEXTO DENTRO DOS CARTÕES
   Começa pelo tamanho definido no CSS. Se necessário, reduz um pouco
   de cada vez até o conteúdo caber dentro das margens do cartão. */
function ajustarTextosDosCartoes() {
  const textosDosCartoes = document.querySelectorAll('.conteudo-caixa');
  const tamanhoDaFonteBase = Number.parseFloat(
    getComputedStyle(document.documentElement).fontSize
  );

  for (const caixaDeTexto of textosDosCartoes) {
    caixaDeTexto.style.removeProperty('font-size');
    let tamanhoDoTexto = Number.parseFloat(getComputedStyle(caixaDeTexto).fontSize);

    for (let tentativa = 0; tentativa < 60; tentativa += 1) {
      const alturaCabe = caixaDeTexto.scrollHeight <= caixaDeTexto.clientHeight + 1;
      const larguraCabe = caixaDeTexto.scrollWidth <= caixaDeTexto.clientWidth + 1;

      if (alturaCabe && larguraCabe) break;

      tamanhoDoTexto *= 0.96;
      caixaDeTexto.style.fontSize = `${tamanhoDoTexto / tamanhoDaFonteBase}rem`;
    }
  }
}

/* INÍCIO
   Executa os ajustes ao abrir a página e quando a janela muda de tamanho. */
function atualizarPagina() {
  atualizarAlturaDoMenu();
  ajustarTextosDosCartoes();
}

atualizarAlturaDoMenu();
acompanharSecoes();

document.fonts.ready.then(ajustarTextosDosCartoes);
window.addEventListener('load', ajustarTextosDosCartoes, { once: true });
window.addEventListener('resize', atualizarPagina, { passive: true });

if ('ResizeObserver' in window) {
  const observadorDoMenu = new ResizeObserver(atualizarAlturaDoMenu);
  observadorDoMenu.observe(menuFixo);
}
