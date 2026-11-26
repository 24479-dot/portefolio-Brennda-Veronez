
"use strict";

// ==================================================
// V29 — MINDAR
// CENTRALIZAÇÃO E ENQUADRAMENTO AUTOMÁTICO
// ==================================================

const TOTAL_FRAMES = 220;
const FPS = 25;
const FRAME_DURATION = 1000 / FPS;

const FRAME_FOLDER = "./portfolio_frames_png/";

const CANVAS_WIDTH = 880;
const CANVAS_HEIGHT = 1000;

const INITIAL_BUFFER = 12;
const BUFFER_SIZE = 24;
const MAX_DOWNLOADS = 6;

const TEMPO_ESTABILIZACAO = 300;
const MIN_AMOSTRAS = 5;

// ==================================================
// CONFIGURAÇÃO DO ENQUADRAMENTO
// ==================================================

const MARGEM_LATERAL = 0.05;
const MARGEM_SUPERIOR = 0.12;
const MARGEM_INFERIOR = 0.05;

let cameraPreparada = false;
let experienciaIniciada = false;
let carregamentoConcluido = false;
let marcadorEncontrado = false;
let posicaoBloqueada = false;

let instanteReconhecimento = null;

const $ = id => document.getElementById(id);


// ==================================================
// CARREGAMENTO
// ==================================================

function atualizarProgresso(valor, mensagem) {

    valor = Math.max(0, Math.min(100, valor));

    $("percentagem").textContent =
        Math.round(valor) + "%";

    $("barra-progresso").style.width =
        valor + "%";

    $("circulo-progresso").style.strokeDashoffset =
        326.7256 * (1 - valor / 100);

    $("texto-carregamento").textContent =
        mensagem;

}


function verificarCarregamento() {

    if (
        !experienciaIniciada ||
        carregamentoConcluido ||
        window.arFalhou
    ) return;

    const componente =
        $("animacao-envelope")
            ?.components?.["sequencia-envelope"];

    if (!componente) return;

    let prontos = 0;

    for (let i = 1; i <= INITIAL_BUFFER; i++) {

        if (componente.frames.get(i)?.ready) {

            prontos++;

        }

    }

    const progresso =
        10 +
        (cameraPreparada ? 60 : 0) +
        29 * prontos / INITIAL_BUFFER;

    atualizarProgresso(

        progresso,

        cameraPreparada
            ? "A preparar a animação..."
            : "A iniciar a câmara..."

    );

    if (
        cameraPreparada &&
        componente.frames.get(1)?.ready
    ) {

        carregamentoConcluido = true;
        window.arPronto = true;

        clearTimeout(window.limiteAR);

        atualizarProgresso(
            100,
            "Experiência preparada!"
        );

        $("carregamento-ar").hidden = true;

        if (marcadorEncontrado) {

            componente.prepararBloqueio();

        }

    }

}


// ==================================================
// CAMINHO DOS FRAMES PNG
// ==================================================

function framePath(number) {

    return FRAME_FOLDER +
        "frame_" +
        String(number).padStart(4, "0") +
        ".png";

}


// ==================================================
// CONFIGURAÇÃO DA CÂMARA
// ==================================================

async function configurarFoco(scene) {

    try {

        const sistema =
            scene.systems["mindar-image-system"];

        const video =
            sistema.video ||
            document.querySelector("body > video");

        const track =
            video?.srcObject?.getVideoTracks()[0];

        if (!track) return;

        const capacidades =
            track.getCapabilities?.() || {};

        if (
            capacidades.focusMode?.includes("continuous")
        ) {

            const atuais =
                track.getConstraints();

            await track.applyConstraints({

                ...atuais,

                advanced: [

                    ...(atuais.advanced || []),

                    {
                        focusMode: "continuous"
                    }

                ]

            });

        }

        console.log(
            "V29 — Câmara:",
            track.getSettings()
        );

    } catch (erro) {

        console.warn(
            "Ajuste de foco indisponível.",
            erro
        );

    }

}


// ==================================================
// ENQUADRAMENTO AUTOMÁTICO
// ==================================================

function ajustarEnquadramento(larguraOriginal) {

    const viewport = window.visualViewport;

    const larguraEcra =
        viewport?.width || window.innerWidth;

    const alturaEcra =
        viewport?.height || window.innerHeight;

    const offsetX =
        viewport?.offsetLeft || 0;

    const offsetY =
        viewport?.offsetTop || 0;

    const proporcao =
        CANVAS_WIDTH / CANVAS_HEIGHT;


    // Margens de segurança.

    const margemX =
        larguraEcra * MARGEM_LATERAL;

    let margemTopo =
        alturaEcra * MARGEM_SUPERIOR;

    const margemFundo =
        alturaEcra * MARGEM_INFERIOR;


    // Evitar sobreposição com os botões superiores.

    const botaoVoltar =
        document.querySelector(".voltar");

    const botaoCamera =
        $("camera-abrir");

    for (const botao of [botaoVoltar, botaoCamera]) {

        if (!botao || botao.hidden) continue;

        const rect =
            botao.getBoundingClientRect();

        margemTopo = Math.max(

            margemTopo,

            rect.bottom - offsetY + 12

        );

    }


    // Área disponível para toda a animação.

    const larguraDisponivel =
        Math.max(1, larguraEcra - margemX * 2);

    const alturaDisponivel =
        Math.max(

            1,

            alturaEcra -
            margemTopo -
            margemFundo

        );


    // Reduzir apenas quando necessário.
    // Preservar sempre a proporção original.

    const larguraFinal =
        Math.min(

            larguraOriginal,

            larguraDisponivel,

            alturaDisponivel * proporcao

        );

    const alturaFinal =
        larguraFinal / proporcao;


    // Centralização horizontal.

    const esquerda =
        offsetX +
        (larguraEcra - larguraFinal) / 2;


    // Centralização vertical dentro da área útil.

    const topo =
        offsetY +
        margemTopo +
        (alturaDisponivel - alturaFinal) / 2;


    return {

        left: esquerda,

        top: topo,

        width: larguraFinal,

        height: alturaFinal

    };

}


// ==================================================
// COMPONENTE DA ANIMAÇÃO
// ==================================================

if (!window.AFRAME) {

    window.mostrarErroAR(
        "Não foi possível carregar o A-Frame."
    );

} else {

    AFRAME.registerComponent("sequencia-envelope", {

        init: function () {

            this.frames = new Map();

            this.downloadsAtivos = 0;

            this.janelaPretendida = new Set();

            this.playing = false;

            this.aEstabilizar = false;

            this.amostras = [];

            this.inicioEstabilizacao = null;

            this.ultimoTempoAmostra = 0;

            this.tempoInicial = null;

            this.ultimoFrameDesenhado = null;

            this.ultimoFramePedido = null;

            this.camada = null;

            this.removido = false;


            // Canvas transparente.

            this.canvas =
                document.createElement("canvas");

            this.canvas.width =
                CANVAS_WIDTH;

            this.canvas.height =
                CANVAS_HEIGHT;

            this.ctx =
                this.canvas.getContext("2d", {

                    alpha: true

                });

            this.ctx.imageSmoothingEnabled = true;

            this.ctx.imageSmoothingQuality = "medium";


            this.el.setAttribute(
                "visible",
                false
            );


            // Pré-carregamento imediato.

            this.preloadFrames(
                1,
                INITIAL_BUFFER
            );

        },


        // ==========================================
        // CARREGAR FRAME
        // ==========================================

        loadFrame: function (number) {

            if (
                this.frames.has(number) ||
                this.downloadsAtivos >= MAX_DOWNLOADS ||
                window.arFalhou ||
                this.removido
            ) return;

            const image = new Image();

            image.decoding = "async";

            if (number === 1) {

                image.fetchPriority = "high";

            }

            const frame = {

                image,

                ready: false,

                loading: true,

                failed: false

            };

            this.frames.set(number, frame);

            this.downloadsAtivos++;


            image.onload = () => {

                this.downloadsAtivos--;

                frame.loading = false;

                frame.ready = true;

                if (this.removido) return;

                if (
                    !this.janelaPretendida.has(number)
                ) {

                    this.frames.delete(number);

                }

                verificarCarregamento();

                this.processarDownloads();

            };


            image.onerror = () => {

                this.downloadsAtivos--;

                frame.loading = false;

                frame.failed = true;

                if (this.removido) return;

                console.warn(
                    "Frame indisponível:",
                    number
                );

                if (
                    number === 1 &&
                    experienciaIniciada
                ) {

                    window.mostrarErroAR(
                        "Não foi possível carregar a primeira imagem da animação."
                    );

                    return;

                }

                this.processarDownloads();

            };


            image.src = framePath(number);

        },


        // ==========================================
        // DOWNLOADS SIMULTÂNEOS
        // ==========================================

        processarDownloads: function () {

            if (
                window.arFalhou ||
                this.removido
            ) return;

            for (
                const number of this.janelaPretendida
            ) {

                if (
                    this.downloadsAtivos >= MAX_DOWNLOADS
                ) break;

                if (!this.frames.has(number)) {

                    this.loadFrame(number);

                }

            }

        },


        // ==========================================
        // PRÉ-CARREGAMENTO
        // ==========================================

        preloadFrames: function (
            start,
            quantidade = BUFFER_SIZE
        ) {

            const manter = new Set();

            for (let i = 0; i < quantidade; i++) {

                const number =
                    ((start - 1 + i) % TOTAL_FRAMES) + 1;

                manter.add(number);

            }

            manter.add(1);

            this.janelaPretendida = manter;

            for (
                const [number, frame] of this.frames
            ) {

                if (
                    !manter.has(number) &&
                    !frame.loading
                ) {

                    this.frames.delete(number);

                }

            }

            this.processarDownloads();

        },


        // ==========================================
        // DESENHAR FRAME
        // ==========================================

        drawFrame: function (number) {

            const frame =
                this.frames.get(number);

            if (!frame?.ready) return false;

            if (
                this.ultimoFrameDesenhado === number
            ) {

                return true;

            }

            this.ctx.clearRect(

                0,
                0,
                CANVAS_WIDTH,
                CANVAS_HEIGHT

            );

            this.ctx.drawImage(

                frame.image,

                0,
                0,

                CANVAS_WIDTH,
                CANVAS_HEIGHT

            );

            this.ultimoFrameDesenhado = number;

            return true;

        },


        // ==========================================
        // CRIAR CAMADA FIXA E CENTRALIZADA
        // ==========================================

        criarCamada: function (rect) {

            this.camada?.remove();

            const camada =
                document.createElement("div");

            camada.id =
                "animacao-fixa-v29";

            Object.assign(camada.style, {

                position: "fixed",

                left: rect.left + "px",

                top: rect.top + "px",

                width: rect.width + "px",

                height: rect.height + "px",

                transform: "none",

                transformOrigin: "center center",

                pointerEvents: "none",

                background: "transparent",

                overflow: "visible",

                zIndex: "5",

                opacity: "1",

                transition: "none",

                animation: "none",

                margin: "0",

                padding: "0",

                boxSizing: "border-box"

            });


            Object.assign(this.canvas.style, {

                display: "block",

                width: "100%",

                height: "100%",

                maxWidth: "100%",

                maxHeight: "100%",

                objectFit: "contain",

                background: "transparent",

                pointerEvents: "none",

                transform: "none"

            });


            camada.appendChild(this.canvas);

            document.body.appendChild(camada);

            this.camada = camada;

        },


        // ==========================================
        // PREPARAR ESTABILIZAÇÃO
        // ==========================================

        prepararBloqueio: function () {

            if (
                posicaoBloqueada ||
                this.aEstabilizar ||
                window.arFalhou
            ) return;

            this.aEstabilizar = true;

            this.amostras = [];

            this.inicioEstabilizacao = null;

            this.ultimoTempoAmostra = 0;

            this.preloadFrames(
                1,
                BUFFER_SIZE
            );

        },


        cancelarBloqueio: function () {

            if (posicaoBloqueada) return;

            this.aEstabilizar = false;

            this.amostras = [];

            this.inicioEstabilizacao = null;

        },


        // ==========================================
        // CALCULAR DIMENSÕES ATRAVÉS DO MINDAR
        // ==========================================

        calcularPosicao: function () {

            const THREE =
                AFRAME.THREE;

            const scene =
                this.el.sceneEl;

            const camera =
                scene.camera;

            const mesh =
                this.el.getObject3D("mesh");

            if (
                !camera ||
                !mesh ||
                !scene.canvas
            ) return null;


            camera.updateMatrixWorld(true);

            mesh.updateWorldMatrix(true, false);

            const geometria =
                mesh.geometry;

            if (!geometria.boundingBox) {

                geometria.computeBoundingBox();

            }

            const caixa =
                geometria.boundingBox;

            const centro =
                caixa.getCenter(
                    new THREE.Vector3()
                );

            const esquerda =
                new THREE.Vector3(

                    caixa.min.x,
                    centro.y,
                    centro.z

                );

            const direita =
                new THREE.Vector3(

                    caixa.max.x,
                    centro.y,
                    centro.z

                );

            const superior =
                new THREE.Vector3(

                    centro.x,
                    caixa.max.y,
                    centro.z

                );

            const inferior =
                new THREE.Vector3(

                    centro.x,
                    caixa.min.y,
                    centro.z

                );

            const canvasRect =
                scene.canvas.getBoundingClientRect();


            function projetar(ponto) {

                ponto.applyMatrix4(
                    mesh.matrixWorld
                );

                ponto.project(camera);

                return {

                    x:
                        canvasRect.left +

                        (ponto.x + 1) *
                        canvasRect.width / 2,

                    y:
                        canvasRect.top +

                        (1 - ponto.y) *
                        canvasRect.height / 2

                };

            }


            const c = projetar(centro);

            const e = projetar(esquerda);

            const d = projetar(direita);

            const s = projetar(superior);

            const i = projetar(inferior);


            const larguraProjetada =
                Math.hypot(

                    d.x - e.x,

                    d.y - e.y

                );


            const alturaProjetada =
                Math.hypot(

                    i.x - s.x,

                    i.y - s.y

                );


            const proporcao =
                CANVAS_WIDTH / CANVAS_HEIGHT;

            const largura =
                Math.min(

                    larguraProjetada,

                    alturaProjetada * proporcao

                );

            const altura =
                largura / proporcao;


            if (

                !Number.isFinite(c.x) ||

                !Number.isFinite(c.y) ||

                !Number.isFinite(largura) ||

                !Number.isFinite(altura) ||

                largura < 10 ||

                altura < 10 ||

                largura > window.innerWidth * 5

            ) return null;


            return {

                centerX: c.x,

                centerY: c.y,

                width: largura,

                height: altura

            };

        },


        // ==========================================
        // RECOLHER AMOSTRAS
        // ==========================================

        recolherPosicao: function (time) {

            if (
                !marcadorEncontrado ||
                !this.aEstabilizar
            ) return;

            if (
                time - this.ultimoTempoAmostra < 40
            ) return;

            this.ultimoTempoAmostra = time;

            const posicao =
                this.calcularPosicao();

            if (!posicao) return;

            if (
                this.inicioEstabilizacao === null
            ) {

                this.inicioEstabilizacao = time;

            }

            this.amostras.push(posicao);

            if (
                this.amostras.length > 12
            ) {

                this.amostras.shift();

            }

            if (

                this.amostras.length >= MIN_AMOSTRAS &&

                time - this.inicioEstabilizacao
                    >= TEMPO_ESTABILIZACAO

            ) {

                this.bloquearPosicao();

            }

        },


        // ==========================================
        // CENTRALIZAR E BLOQUEAR A ANIMAÇÃO
        // ==========================================

        bloquearPosicao: function () {

            if (

                posicaoBloqueada ||

                !this.amostras.length ||

                !this.frames.get(1)?.ready

            ) return;


            function mediana(valores) {

                const ordenados =
                    [...valores].sort(
                        (a, b) => a - b
                    );

                const meio =
                    Math.floor(
                        ordenados.length / 2
                    );

                if (ordenados.length % 2) {

                    return ordenados[meio];

                }

                return (

                    ordenados[meio - 1] +

                    ordenados[meio]

                ) / 2;

            }


            // Calcular a escala reconhecida pelo MindAR.

            const larguraOriginal =
                mediana(

                    this.amostras.map(
                        a => a.width
                    )

                );


            // Ajustar automaticamente ao ecrã.
            // Nenhuma parte do canvas ficará fora
            // da área de segurança inicial.

            const rect =
                ajustarEnquadramento(
                    larguraOriginal
                );


            this.drawFrame(1);

            this.criarCamada(rect);


            // Bloquear definitivamente.

            posicaoBloqueada = true;

            this.aEstabilizar = false;

            this.playing = true;

            this.tempoInicial = null;

            this.ultimoFramePedido = null;

            this.el.setAttribute(
                "visible",
                false
            );

            document.body.classList.add(
                "alvo-encontrado"
            );

            $("estado").textContent =
                "Selo reconhecido!";


            if (instanteReconhecimento !== null) {

                const segundos =

                    (
                        performance.now() -
                        instanteReconhecimento
                    ) / 1000;

                window.tempoArranqueAR =
                    segundos;

                console.log(

                    "V29 — Tempo de arranque:",

                    segundos.toFixed(2) + " segundos"

                );

            }


            console.log(

                "V29 — Enquadramento final:",

                rect

            );

        },


        // ==========================================
        // REPRODUÇÃO A 25 FPS
        // ==========================================

        tick: function (time) {

            if (window.arFalhou) {

                if (this.camada) {

                    this.camada.hidden = true;

                }

                return;

            }

            if (

                this.aEstabilizar &&

                carregamentoConcluido

            ) {

                this.recolherPosicao(time);

            }

            if (

                !this.playing ||

                !posicaoBloqueada ||

                !carregamentoConcluido

            ) return;


            if (this.tempoInicial === null) {

                this.tempoInicial = time;

            }

            const decorrido =
                time - this.tempoInicial;

            const framePretendido =

                Math.floor(

                    decorrido / FRAME_DURATION

                ) % TOTAL_FRAMES + 1;


            if (

                framePretendido !==
                this.ultimoFramePedido

            ) {

                this.ultimoFramePedido =
                    framePretendido;

                this.preloadFrames(
                    framePretendido
                );

            }


            if (

                framePretendido !==
                this.ultimoFrameDesenhado

            ) {

                this.drawFrame(
                    framePretendido
                );

            }


            // Não atualizar posição, rotação ou escala.
            // A animação permanece fixa no ecrã.

        },


        // ==========================================
        // LIBERTAR RECURSOS
        // ==========================================

        remove: function () {

            this.removido = true;

            this.playing = false;

            this.aEstabilizar = false;

            this.camada?.remove();

            this.frames.clear();

            this.janelaPretendida.clear();

        }

    });

}


// ==================================================
// INICIALIZAÇÃO
// ==================================================

document.addEventListener("DOMContentLoaded", () => {

    if (!window.AFRAME) return;

    const scene =
        document.querySelector("a-scene");

    const marcador =
        $("marcador");

    const animacao =
        $("animacao-envelope");

    const estado =
        $("estado");

    const botao =
        $("iniciar-experiencia");

    const componente = () =>

        animacao.components["sequencia-envelope"];


// ==================================================
// BOTÃO INICIAR
// ==================================================

    botao.addEventListener("click", async () => {

        if (
            experienciaIniciada ||
            window.arFalhou
        ) return;

        if (!window.isSecureContext) {

            window.mostrarErroAR(
                "A experiência necessita de HTTPS."
            );

            return;

        }

        if (
            !navigator.mediaDevices?.getUserMedia
        ) {

            window.mostrarErroAR(
                "Este navegador não disponibiliza acesso à câmara."
            );

            return;

        }

        experienciaIniciada = true;

        botao.disabled = true;

        $("inicio-ar").hidden = true;

        $("carregamento-ar").hidden = false;

        atualizarProgresso(

            0,

            "A iniciar a câmara..."

        );

        clearTimeout(window.limiteAR);

        window.limiteAR = setTimeout(() => {

            if (!window.arPronto) {

                window.mostrarErroAR(
                    "A experiência demorou demasiado tempo a carregar."
                );

            }

        }, 90000);


        try {

            const sistema =
                scene.systems["mindar-image-system"];

            if (!sistema) {

                throw new Error(
                    "MindAR indisponível."
                );

            }

            const arranque =
                sistema.start();

            if (
                componente().frames.get(1)?.failed
            ) {

                componente().frames.delete(1);

            }

            componente().preloadFrames(

                1,

                INITIAL_BUFFER

            );

            verificarCarregamento();

            await arranque;

        } catch (erro) {

            console.error(erro);

            window.mostrarErroAR(

                erro.name === "NotAllowedError"

                    ? "O acesso à câmara não foi autorizado."

                    : "Não foi possível iniciar o MindAR."

            );

        }

    });


// ==================================================
// MINDAR PREPARADO
// ==================================================

    scene.addEventListener("arReady", () => {

        if (window.arFalhou) {

            try {

                scene.systems[
                    "mindar-image-system"
                ].stop();

            } catch (erro) {}

            return;

        }

        cameraPreparada = true;

        estado.textContent =
            "Aponta a câmara para o selo dourado.";

        configurarFoco(scene);

        componente()?.preloadFrames(

            1,

            BUFFER_SIZE

        );

        verificarCarregamento();

    });


// ==================================================
// SELO RECONHECIDO
// ==================================================

    marcador.addEventListener("targetFound", () => {

        if (window.arFalhou) return;

        marcadorEncontrado = true;

        if (posicaoBloqueada) return;

        instanteReconhecimento =
            performance.now();

        estado.textContent =
            "A preparar a animação...";

        if (

            carregamentoConcluido &&

            $("carregamento-ar").hidden

        ) {

            componente()?.prepararBloqueio();

        }

    });


// ==================================================
// PERDA DO SELO
// ==================================================

    marcador.addEventListener("targetLost", () => {

        marcadorEncontrado = false;

        if (posicaoBloqueada) return;

        componente()?.cancelarBloqueio();

        document.body.classList.remove(
            "alvo-encontrado"
        );

        estado.textContent =
            "Volta a apontar para o selo dourado.";

    });


// ==================================================
// ERRO MINDAR
// ==================================================

    scene.addEventListener("arError", () => {

        window.mostrarErroAR(
            "Não foi possível inicializar a câmara. Verifica as permissões."
        );

    });


// ==================================================
// PRÉ-CARREGAMENTO
// ==================================================

    function prepararBotao() {

        if (window.arFalhou) return;

        clearTimeout(window.limiteAR);

        botao.disabled = false;

        botao.textContent =
            "Iniciar experiência";

        componente()?.preloadFrames(

            1,

            INITIAL_BUFFER

        );

    }

    if (scene.hasLoaded) {

        prepararBotao();

    } else {

        scene.addEventListener(

            "loaded",

            prepararBotao,

            { once: true }

        );

    }



// LIBERTAR A CÂMARA

    window.addEventListener("pagehide", () => {

        try {

            scene.systems[
                "mindar-image-system"
            ].stop();

        } catch (erro) {}

        document.querySelectorAll("video")
            .forEach(video => {

                video.srcObject?.getTracks()
                    .forEach(track => track.stop());

            });

    });

});
