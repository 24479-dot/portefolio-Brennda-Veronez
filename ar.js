
"use strict";

// ==================================================
// V31 - MINDAR
// TRACKING DINAMICO ESTABILIZADO
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

// ==================================================
// CONFIGURACAO DA ESTABILIZACAO
// ==================================================

const SUAVIZACAO_POSICAO = 0.12;
const SUAVIZACAO_ROTACAO = 0.10;
const SUAVIZACAO_ESCALA = 0.10;

const ZONA_MORTA_POSICAO = 0.002;
const ZONA_MORTA_ROTACAO = 0.006;
const ZONA_MORTA_ESCALA = 0.003;

let cameraPreparada = false;
let experienciaIniciada = false;
let carregamentoConcluido = false;
let marcadorEncontrado = false;
let instanteReconhecimento = null;

const $ = id => document.getElementById(id);

// ==================================================
// CARREGAMENTO
// ==================================================

function atualizarProgresso(valor, mensagem) {

    valor = Math.max(0, Math.min(100, valor));

    $("percentagem").textContent = Math.round(valor) + "%";

    $("barra-progresso").style.width = valor + "%";

    $("circulo-progresso").style.strokeDashoffset =
        326.7256 * (1 - valor / 100);

    $("texto-carregamento").textContent = mensagem;

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
            componente.startAnimation();
        }

    }

}

// ==================================================
// CAMINHO DOS FRAMES
// ==================================================

function framePath(number) {

    return FRAME_FOLDER +
        "frame_" +
        String(number).padStart(4, "0") +
        ".png";

}

// ==================================================
// CONFIGURACAO DA CAMARA
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

            const atuais = track.getConstraints();

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
            "V31 - Camara:",
            track.getSettings()
        );

    } catch (erro) {

        console.warn(
            "Foco automatico indisponivel.",
            erro
        );

    }

}

// ==================================================
// COMPONENTE DA ANIMACAO
// ==================================================

if (!window.AFRAME) {

    window.mostrarErroAR(
        "Não foi possível carregar o A-Frame."
    );

} else {

    AFRAME.registerComponent("sequencia-envelope", {

        init: function () {

            const THREE = AFRAME.THREE;

            this.frames = new Map();

            this.downloadsAtivos = 0;

            this.janelaPretendida = new Set();

            this.playing = false;
            this.removido = false;
            this.trackingInicializado = false;

            this.tempoInicial = null;
            this.ultimoFrameDesenhado = null;
            this.ultimoFramePedido = null;

            // Variaveis de tracking.

            this.posicaoAtual = new THREE.Vector3();

            this.rotacaoAtual = new THREE.Quaternion();

            this.escalaAtual = new THREE.Vector3(1, 1, 1);

            this.posicaoTarget = new THREE.Vector3();

            this.rotacaoTarget = new THREE.Quaternion();

            this.escalaTarget = new THREE.Vector3();

            this.matrizLocal = new THREE.Matrix4();

            this.matrizInversa = new THREE.Matrix4();

            this.diferencaEscala = new THREE.Vector3();

            // Canvas transparente.

            this.canvas = document.createElement("canvas");

            this.canvas.width = CANVAS_WIDTH;

            this.canvas.height = CANVAS_HEIGHT;

            this.ctx = this.canvas.getContext("2d", {
                alpha: true
            });

            this.ctx.imageSmoothingEnabled = true;

            this.ctx.imageSmoothingQuality = "medium";

            // Textura da animacao.

            this.texture = new THREE.CanvasTexture(
                this.canvas
            );

            this.texture.colorSpace =
                THREE.SRGBColorSpace;

            this.texture.generateMipmaps = false;

            this.texture.minFilter = THREE.LinearFilter;

            this.texture.magFilter = THREE.LinearFilter;

            this.material = new THREE.MeshBasicMaterial({

                map: this.texture,

                transparent: true,

                depthWrite: false,

                side: THREE.DoubleSide

            });

            this.applyMaterial = () => {

                const mesh = this.el.getObject3D("mesh");

                if (
                    mesh &&
                    mesh.material !== this.material
                ) {

                    mesh.material = this.material;

                }

            };

            this.el.addEventListener(
                "object3dset",
                this.applyMaterial
            );

            this.applyMaterial();

            this.el.setAttribute("visible", false);

            // Pre-carregamento inicial.

            this.preloadFrames(1, INITIAL_BUFFER);

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

                image: image,

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
                    "Frame indisponivel:",
                    number
                );

                if (
                    number === 1 &&
                    experienciaIniciada
                ) {

                    window.mostrarErroAR(
                        "Não foi possível carregar a primeira imagem."
                    );

                    return;

                }

                this.processarDownloads();

            };

            image.src = framePath(number);

        },

        // ==========================================
        // GESTAO DOS DOWNLOADS
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
        // PRE-CARREGAMENTO
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

            const frame = this.frames.get(number);

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

            this.texture.needsUpdate = true;

            this.ultimoFrameDesenhado = number;

            return true;

        },

        // ==========================================
        // TRACKING DINAMICO ESTABILIZADO
        // ==========================================

        atualizarTracking: function (delta) {

            if (!marcadorEncontrado) return false;

            const marcador = $("marcador");

            const ancora = $("ancora-suavizada");

            if (!marcador || !ancora) return false;

            const origem = marcador.object3D;

            const destino = ancora.object3D;

            origem.updateWorldMatrix(true, false);

            if (destino.parent) {

                destino.parent.updateWorldMatrix(
                    true,
                    false
                );

                this.matrizInversa
                    .copy(destino.parent.matrixWorld)
                    .invert();

                this.matrizLocal.multiplyMatrices(
                    this.matrizInversa,
                    origem.matrixWorld
                );

            } else {

                this.matrizLocal.copy(
                    origem.matrixWorld
                );

            }

            this.matrizLocal.decompose(

                this.posicaoTarget,

                this.rotacaoTarget,

                this.escalaTarget

            );

            const valoresValidos = [

                this.posicaoTarget.x,
                this.posicaoTarget.y,
                this.posicaoTarget.z,

                this.rotacaoTarget.x,
                this.rotacaoTarget.y,
                this.rotacaoTarget.z,
                this.rotacaoTarget.w,

                this.escalaTarget.x,
                this.escalaTarget.y,
                this.escalaTarget.z

            ].every(Number.isFinite);

            if (
                !valoresValidos ||
                Math.abs(this.escalaTarget.x) < 0.000001
            ) return false;

            // Primeira deteccao.

            if (!this.trackingInicializado) {

                this.posicaoAtual.copy(
                    this.posicaoTarget
                );

                this.rotacaoAtual.copy(
                    this.rotacaoTarget
                );

                this.escalaAtual.copy(
                    this.escalaTarget
                );

                this.trackingInicializado = true;

            } else {

                // Suavizacao independente dos FPS.

                const dt = Math.max(
                    1,
                    Math.min(delta || 16.67, 100)
                );

                const fatorPosicao =
                    1 - Math.pow(
                        1 - SUAVIZACAO_POSICAO,
                        dt / 16.67
                    );

                const fatorRotacao =
                    1 - Math.pow(
                        1 - SUAVIZACAO_ROTACAO,
                        dt / 16.67
                    );

                const fatorEscala =
                    1 - Math.pow(
                        1 - SUAVIZACAO_ESCALA,
                        dt / 16.67
                    );

                // Reduzir vibracoes de posicao.

                if (
                    this.posicaoAtual.distanceTo(
                        this.posicaoTarget
                    ) > ZONA_MORTA_POSICAO
                ) {

                    this.posicaoAtual.lerp(
                        this.posicaoTarget,
                        fatorPosicao
                    );

                }

                // Reduzir vibracoes de rotacao.

                if (
                    this.rotacaoAtual.angleTo(
                        this.rotacaoTarget
                    ) > ZONA_MORTA_ROTACAO
                ) {

                    this.rotacaoAtual.slerp(
                        this.rotacaoTarget,
                        fatorRotacao
                    );

                }

                // Reduzir vibracoes de escala.

                this.diferencaEscala
                    .copy(this.escalaTarget)
                    .sub(this.escalaAtual);

                if (
                    this.diferencaEscala.length() >
                    ZONA_MORTA_ESCALA
                ) {

                    this.escalaAtual.lerp(
                        this.escalaTarget,
                        fatorEscala
                    );

                }

            }

            destino.position.copy(
                this.posicaoAtual
            );

            destino.quaternion.copy(
                this.rotacaoAtual
            );

            destino.scale.copy(
                this.escalaAtual
            );

            destino.updateMatrix();

            destino.matrixWorldNeedsUpdate = true;

            return true;

        },

        // ==========================================
        // INICIAR ANIMACAO
        // ==========================================

        startAnimation: function () {

            if (
                this.playing ||
                !marcadorEncontrado ||
                !carregamentoConcluido ||
                window.arFalhou ||
                !this.frames.get(1)?.ready
            ) return;

            this.trackingInicializado = false;

            this.playing = true;

            this.tempoInicial = null;

            this.ultimoFramePedido = null;

            this.ultimoFrameDesenhado = null;

            this.preloadFrames(1);

            this.drawFrame(1);

        },

        // ==========================================
        // PARAR E OCULTAR ANIMACAO
        // ==========================================

        stopAnimation: function () {

            this.playing = false;

            this.trackingInicializado = false;

            this.tempoInicial = null;

            this.ultimoFramePedido = null;

            this.ultimoFrameDesenhado = null;

            this.el.setAttribute(
                "visible",
                false
            );

            $("ancora-suavizada")?.setAttribute(
                "visible",
                false
            );

            this.preloadFrames(
                1,
                INITIAL_BUFFER
            );

        },

        // ==========================================
        // ATUALIZACAO EM TEMPO REAL
        // ==========================================

        tick: function (time, delta) {

            const ancora = $("ancora-suavizada");

            const marcador = $("marcador");

            if (
                window.arFalhou ||
                !marcadorEncontrado ||
                !marcador?.object3D.visible ||
                !carregamentoConcluido ||
                !this.playing
            ) {

                if (ancora) {
                    ancora.object3D.visible = false;
                }

                return;

            }

            // Atualizar o tracking.

            if (!this.atualizarTracking(delta)) {

                if (ancora) {
                    ancora.object3D.visible = false;
                }

                return;

            }

            ancora.setAttribute("visible", true);

            ancora.object3D.visible = true;

            this.el.setAttribute("visible", true);

            if (this.tempoInicial === null) {

                this.tempoInicial = time;

                document.body.classList.add(
                    "alvo-encontrado"
                );

                $("estado").textContent =
                    "Selo reconhecido!";

                if (instanteReconhecimento !== null) {

                    window.tempoArranqueAR = (
                        performance.now() -
                        instanteReconhecimento
                    ) / 1000;

                    console.log(
                        "V31 - Tempo de arranque:",
                        window.tempoArranqueAR.toFixed(2),
                        "segundos"
                    );

                }

            }

            // Reproducao a 25 FPS.

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

        },

        // ==========================================
        // LIBERTAR RECURSOS
        // ==========================================

        remove: function () {

            this.removido = true;

            this.playing = false;

            this.el.removeEventListener(
                "object3dset",
                this.applyMaterial
            );

            this.texture.dispose();

            this.material.dispose();

            this.frames.clear();

            this.janelaPretendida.clear();

        }

    });

}

// ==================================================
// INICIALIZACAO
// ==================================================

document.addEventListener("DOMContentLoaded", () => {

    if (!window.AFRAME) return;

    const scene = document.querySelector("a-scene");

    const marcador = $("marcador");

    const ancora = $("ancora-suavizada");

    const animacao = $("animacao-envelope");

    const estado = $("estado");

    const botao = $("iniciar-experiencia");

    if (
        !scene ||
        !marcador ||
        !ancora ||
        !animacao ||
        !botao
    ) {

        window.mostrarErroAR(
            "Verifica se o ficheiro ar.html corresponde à V30."
        );

        return;

    }

    const componente = () =>
        animacao.components["sequencia-envelope"];

    // ==============================================
    // BOTAO INICIAR
    // ==============================================

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

        if (!navigator.mediaDevices?.getUserMedia) {

            window.mostrarErroAR(
                "Este navegador não permite acesso à câmara."
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
                    "MindAR indisponivel."
                );

            }

            const arranque = sistema.start();

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

    // ==============================================
    // MINDAR PREPARADO
    // ==============================================

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

    // ==============================================
    // TARGET RECONHECIDO
    // ==============================================

    marcador.addEventListener("targetFound", () => {

        if (
            window.arFalhou ||
            marcadorEncontrado
        ) return;

        marcadorEncontrado = true;

        instanteReconhecimento = performance.now();

        estado.textContent =
            "Selo reconhecido!";

        if (carregamentoConcluido) {

            componente()?.startAnimation();

        }

    });

    // ==============================================
    // TARGET PERDIDO
    // ==============================================

    marcador.addEventListener("targetLost", () => {

        marcadorEncontrado = false;

        instanteReconhecimento = null;

        ancora.setAttribute("visible", false);

        ancora.object3D.visible = false;

        animacao.setAttribute("visible", false);

        componente()?.stopAnimation();

        document.body.classList.remove(
            "alvo-encontrado"
        );

        estado.textContent =
            "Volta a apontar para o selo dourado.";

        console.log(
            "V31 - Target perdido. Animacao ocultada."
        );

    });

    // ==============================================
    // ERRO MINDAR
    // ==============================================

    scene.addEventListener("arError", () => {

        window.mostrarErroAR(
            "Não foi possível inicializar a câmara."
        );

    });

    // ==============================================
    // PREPARAR EXPERIENCIA
    // ==============================================

    function prepararBotao() {

        if (window.arFalhou) return;

        clearTimeout(window.limiteAR);

        botao.disabled = false;

        botao.textContent = "Iniciar experiência";

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

    // ==============================================
    // LIBERTAR CAMARA
    // ==============================================

    window.addEventListener("pagehide", () => {

        marcadorEncontrado = false;

        componente()?.stopAnimation();

        try {

            scene.systems[
                "mindar-image-system"
            ].stop();

        } catch (erro) {}

        document.querySelectorAll("video").forEach(video => {

            video.srcObject?.getTracks().forEach(track => {

                track.stop();

            });

        });

    });

});
