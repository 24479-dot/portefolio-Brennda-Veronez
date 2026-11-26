
// ==================================================
// V23 — MINDAR
// ESTABILIZAÇÃO DA POSIÇÃO E OTIMIZAÇÃO
// ==================================================

const TOTAL_FRAMES = 220;
const FPS = 20;
const FRAME_DURATION = 1000 / FPS;

const FRAME_FOLDER = "./portfolio_frames_png/";

// Otimização do processamento

const CANVAS_WIDTH = 880;
const CANVAS_HEIGHT = 1000;

const BUFFER_SIZE = 12;
const MAX_DOWNLOADS = 4;

// Estabilização inicial

const TEMPO_ESTABILIZACAO = 250;
const MIN_AMOSTRAS = 5;

let cameraPreparada = false;
let experienciaIniciada = false;
let carregamentoConcluido = false;
let marcadorEncontrado = false;
let posicaoBloqueada = false;

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
    ) {
        return;
    }

    const componente =
        $("animacao-envelope")
            ?.components?.["sequencia-envelope"];

    if (!componente) return;

    const primeiroFramePronto =
        componente.frames.get(1)?.ready;

    let framesProntos = 0;

    for (let i = 1; i <= 4; i++) {

        if (componente.frames.get(i)?.ready) {

            framesProntos++;

        }

    }

    const progresso =
        10 +
        (cameraPreparada ? 60 : 0) +
        29 * framesProntos / 4;

    atualizarProgresso(

        progresso,

        cameraPreparada
            ? "A preparar a animação..."
            : "A iniciar a câmara e o reconhecimento..."

    );

    if (cameraPreparada && primeiroFramePronto) {

        carregamentoConcluido = true;
        window.arPronto = true;

        clearTimeout(window.limiteAR);

        atualizarProgresso(
            100,
            "Experiência preparada!"
        );

        setTimeout(() => {

            if (window.arFalhou) return;

            $("carregamento-ar").hidden = true;

            if (marcadorEncontrado) {

                componente.prepararBloqueio();

            }

        }, 100);

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
// CONFIGURAÇÃO DA CÂMARA
// ==================================================

async function configurarFoco(scene) {

    try {

        const sistema =
            scene.systems["mindar-image-system"];

        const video =
            sistema.video ||
            document.querySelector("body > video");

        if (!video?.srcObject) return;

        const track =
            video.srcObject.getVideoTracks()[0];

        if (!track) return;

        const capacidades =
            track.getCapabilities?.() || {};

        if (
            capacidades.focusMode?.includes("continuous")
        ) {

            await track.applyConstraints({

                ...track.getConstraints(),

                advanced: [

                    ...(track.getConstraints().advanced || []),

                    {
                        focusMode: "continuous"
                    }

                ]

            });

        }

        console.log(
            "Configuração da câmara:",
            track.getSettings()
        );

    } catch (erro) {

        console.warn(
            "Ajuste de foco indisponível:",
            erro
        );

    }

}


// ==================================================
// VERIFICAR A-FRAME
// ==================================================

if (!window.AFRAME) {

    window.mostrarErroAR(
        "Não foi possível carregar a biblioteca de realidade aumentada."
    );

} else {


// ==================================================
// COMPONENTE DA ANIMAÇÃO
// ==================================================

    AFRAME.registerComponent("sequencia-envelope", {

        init: function () {

            this.currentFrame = 1;

            this.playing = false;

            this.frames = new Map();

            this.downloadsAtivos = 0;

            this.janelaPretendida = new Set();

            this.tempoInicial = null;

            this.ultimoFrameDesenhado = null;

            this.aEstabilizar = false;

            this.inicioEstabilizacao = null;

            this.amostras = [];

            this.ultimoTempoAmostra = 0;

            this.meshEstavel = null;


            // ======================================
            // TEXTURA OTIMIZADA
            // ======================================

            this.canvas =
                document.createElement("canvas");

            this.canvas.width = CANVAS_WIDTH;

            this.canvas.height = CANVAS_HEIGHT;

            this.ctx =
                this.canvas.getContext("2d");

            this.ctx.imageSmoothingEnabled = true;

            this.ctx.imageSmoothingQuality = "medium";

            const THREE = AFRAME.THREE;

            this.texture =
                new THREE.CanvasTexture(this.canvas);

            this.texture.colorSpace =
                THREE.SRGBColorSpace;

            this.texture.generateMipmaps = false;

            this.texture.minFilter =
                THREE.LinearFilter;

            this.texture.magFilter =
                THREE.LinearFilter;

            this.material =
                new THREE.MeshBasicMaterial({

                    map: this.texture,

                    transparent: true,

                    depthWrite: false,

                    side: THREE.DoubleSide

                });


            this.applyMaterial = () => {

                const mesh =
                    this.el.getObject3D("mesh");

                if (mesh) {

                    mesh.material = this.material;

                }

            };

            this.el.addEventListener(
                "object3dset",
                this.applyMaterial
            );

            this.applyMaterial();

        },


        // ==========================================
        // CARREGAR FRAMES
        // ==========================================

        loadFrame: function (number) {

            if (
                this.frames.has(number) ||
                this.downloadsAtivos >= MAX_DOWNLOADS ||
                window.arFalhou
            ) {

                return;

            }

            const image = new Image();

            image.decoding = "async";

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

                frame.ready = true;

                frame.loading = false;

                verificarCarregamento();

                this.processarDownloads();

            };


            image.onerror = () => {

                this.downloadsAtivos--;

                frame.loading = false;

                frame.failed = true;

                console.warn(
                    "Não foi possível carregar o frame:",
                    number
                );

                if (number === 1 && experienciaIniciada) {

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
        // PROCESSAR DOWNLOADS
        // ==========================================

        processarDownloads: function () {

            if (window.arFalhou) return;

            for (const number of this.janelaPretendida) {

                if (
                    this.downloadsAtivos >= MAX_DOWNLOADS
                ) {

                    break;

                }

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

            // Preservar o primeiro frame para o loop

            manter.add(1);

            this.janelaPretendida = manter;


            for (const [number, frame] of this.frames) {

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

            if (!frame?.ready) {

                return false;

            }

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
        // PREPARAR ESTABILIZAÇÃO
        // ==========================================

        prepararBloqueio: function () {

            if (
                posicaoBloqueada ||
                this.aEstabilizar ||
                window.arFalhou
            ) {

                return;

            }

            this.aEstabilizar = true;

            this.inicioEstabilizacao = null;

            this.amostras = [];

            this.ultimoTempoAmostra = 0;

            this.preloadFrames(1);

            this.el.setAttribute(
                "visible",
                false
            );

        },


        // ==========================================
        // CANCELAR ESTABILIZAÇÃO INICIAL
        // ==========================================

        cancelarBloqueio: function () {

            if (posicaoBloqueada) return;

            this.aEstabilizar = false;

            this.inicioEstabilizacao = null;

            this.amostras = [];

        },


        // ==========================================
        // RECOLHER POSIÇÕES DO MINDAR
        // ==========================================

        recolherPosicao: function (time) {

            if (
                !marcadorEncontrado ||
                !this.aEstabilizar
            ) {

                return;

            }

            if (
                time - this.ultimoTempoAmostra < 40
            ) {

                return;

            }

            this.ultimoTempoAmostra = time;

            const mesh =
                this.el.getObject3D("mesh");

            if (!mesh) return;

            const THREE = AFRAME.THREE;

            mesh.updateWorldMatrix(true, false);

            const posicao = new THREE.Vector3();

            const rotacao = new THREE.Quaternion();

            const escala = new THREE.Vector3();

            mesh.matrixWorld.decompose(
                posicao,
                rotacao,
                escala
            );

            if (

                !Number.isFinite(posicao.x) ||
                !Number.isFinite(posicao.y) ||
                !Number.isFinite(posicao.z) ||
                !Number.isFinite(escala.x) ||
                escala.x === 0

            ) {

                return;

            }

            if (this.inicioEstabilizacao === null) {

                this.inicioEstabilizacao = time;

            }

            this.amostras.push({

                posicao,

                rotacao,

                escala

            });

            if (this.amostras.length > 12) {

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
        // BLOQUEAR POSIÇÃO, ROTAÇÃO E ESCALA
        // ==========================================

        bloquearPosicao: function () {

            if (
                posicaoBloqueada ||
                !this.amostras.length ||
                !this.frames.get(1)?.ready
            ) {

                return;

            }

            const THREE = AFRAME.THREE;

            const original =
                this.el.getObject3D("mesh");

            if (!original) return;


            const mediana = valores => {

                const ordenados =
                    [...valores].sort((a, b) => a - b);

                const meio =
                    Math.floor(ordenados.length / 2);

                return ordenados.length % 2
                    ? ordenados[meio]
                    : (
                        ordenados[meio - 1] +
                        ordenados[meio]
                    ) / 2;

            };


            // Posição estável

            const posicao =
                new THREE.Vector3(

                    mediana(
                        this.amostras.map(
                            a => a.posicao.x
                        )
                    ),

                    mediana(
                        this.amostras.map(
                            a => a.posicao.y
                        )
                    ),

                    mediana(
                        this.amostras.map(
                            a => a.posicao.z
                        )
                    )

                );


            // Escala estável

            const escala =
                new THREE.Vector3(

                    mediana(
                        this.amostras.map(
                            a => a.escala.x
                        )
                    ),

                    mediana(
                        this.amostras.map(
                            a => a.escala.y
                        )
                    ),

                    mediana(
                        this.amostras.map(
                            a => a.escala.z
                        )
                    )

                );


            // Suavizar a rotação inicial

            const rotacao =
                this.amostras[0].rotacao.clone();

            for (
                let i = 1;
                i < this.amostras.length;
                i++
            ) {

                rotacao.slerp(
                    this.amostras[i].rotacao,
                    1 / (i + 1)
                );

            }


            // Criar uma representação independente
            // das oscilações posteriores do marcador

            this.meshEstavel =
                new THREE.Mesh(

                    original.geometry.clone(),

                    this.material

                );


            const matrizMundo =
                new THREE.Matrix4().compose(

                    posicao,

                    rotacao,

                    escala

                );


            const raiz =
                this.el.sceneEl.object3D;

            raiz.updateWorldMatrix(true, false);


            const inversa =
                raiz.matrixWorld.clone().invert();


            this.meshEstavel.matrix.multiplyMatrices(

                inversa,

                matrizMundo

            );


            this.meshEstavel.matrixAutoUpdate = false;

            this.meshEstavel.matrixWorldNeedsUpdate = true;

            this.meshEstavel.frustumCulled = false;

            this.meshEstavel.visible = true;


            this.drawFrame(1);

            raiz.add(this.meshEstavel);


            // Ocultar a representação original

            this.el.setAttribute(
                "visible",
                false
            );


            // Bloquear definitivamente a posição virtual

            posicaoBloqueada = true;

            this.aEstabilizar = false;

            this.playing = true;

            this.tempoInicial = null;

            this.currentFrame = 1;


            document.body.classList.add(
                "alvo-encontrado"
            );


            $("estado").textContent =
                "Selo reconhecido!";


            console.log(
                "V23 — Posição virtual bloqueada."
            );

        },


        // ==========================================
        // REPRODUZIR A ANIMAÇÃO
        // ==========================================

        tick: function (time) {

            if (window.arFalhou) {

                if (this.meshEstavel) {

                    this.meshEstavel.visible = false;

                }

                return;

            }


            // Estabilizar após deteção do selo

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
            ) {

                return;

            }


            if (this.tempoInicial === null) {

                this.tempoInicial = time;

            }


            // Manter a duração prevista da animação,
            // mesmo quando o dispositivo perde frames.

            const tempoDecorrido =
                time - this.tempoInicial;


            const framePretendido =

                Math.floor(
                    tempoDecorrido / FRAME_DURATION
                ) % TOTAL_FRAMES + 1;


            if (
                framePretendido === this.currentFrame &&
                this.ultimoFrameDesenhado === framePretendido
            ) {

                return;

            }


            this.currentFrame = framePretendido;

            this.preloadFrames(framePretendido);


            // Se o frame ainda não estiver disponível,
            // manter temporariamente o último visível.

            this.drawFrame(framePretendido);

        },


        // ==========================================
        // LIBERTAR RECURSOS
        // ==========================================

        remove: function () {

            this.playing = false;

            this.aEstabilizar = false;

            if (this.meshEstavel) {

                this.meshEstavel.parent?.remove(
                    this.meshEstavel
                );

                this.meshEstavel.geometry.dispose();

            }

            this.el.removeEventListener(
                "object3dset",
                this.applyMaterial
            );

            this.texture.dispose();

            this.material.dispose();

            this.frames.clear();

        }

    });


// ==================================================
// INICIALIZAÇÃO DA EXPERIÊNCIA
// ==================================================

    document.addEventListener("DOMContentLoaded", () => {

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
// INICIAR EXPERIÊNCIA
// ==================================================

        botao.addEventListener("click", async () => {

            if (
                experienciaIniciada ||
                window.arFalhou
            ) {

                return;

            }


            if (!window.isSecureContext) {

                window.mostrarErroAR(
                    "A câmara necessita de uma ligação HTTPS."
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


            // Manter proteção contra bloqueios

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
                        "MindAR não está disponível."
                    );

                }


                // Iniciar MindAR imediatamente

                const arranque = sistema.start();


                // Recuperar eventual falha no pré-carregamento

                if (
                    componente().frames.get(1)?.failed
                ) {

                    componente().frames.delete(1);

                }


                // Carregar apenas os frames iniciais

                componente().preloadFrames(1, 4);


                verificarCarregamento();


                await arranque;


            } catch (erro) {

                console.error(erro);

                window.mostrarErroAR(

                    erro.name === "NotAllowedError"

                        ? "O acesso à câmara não foi autorizado."

                        : "Não foi possível iniciar a câmara ou o MindAR."

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


            verificarCarregamento();

        });


// ==================================================
// SELO RECONHECIDO
// ==================================================

        marcador.addEventListener("targetFound", () => {

            if (window.arFalhou) return;

            marcadorEncontrado = true;


            if (posicaoBloqueada) {

                return;

            }


            estado.textContent =
                "A estabilizar a experiência...";


            if (
                carregamentoConcluido &&
                $("carregamento-ar").hidden
            ) {

                componente().prepararBloqueio();

            }

        });


// ==================================================
// PERDA TEMPORÁRIA DO SELO
// ==================================================

        marcador.addEventListener("targetLost", () => {

            marcadorEncontrado = false;


            // Após o bloqueio, não interromper
            // nem reiniciar a animação.

            if (posicaoBloqueada) {

                return;

            }


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
                "Não foi possível inicializar a câmara. Verifica as permissões e experimenta novamente."
            );

        });


// ==================================================
// PRÉ-CARREGAMENTO ANTES DO CLIQUE
// ==================================================

        function prepararBotao() {

            if (window.arFalhou) return;

            clearTimeout(window.limiteAR);


            botao.disabled = false;

            botao.textContent =
                "Iniciar experiência";


            // Começar a preparar os primeiros frames
            // antes de o utilizador carregar no botão.

            componente()?.preloadFrames(1, 3);

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


// ==================================================
// LIBERTAR A CÂMARA AO SAIR
// ==================================================

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

}
