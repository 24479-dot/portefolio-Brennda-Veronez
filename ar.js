
// ==========================================
// V16 — OTIMIZAÇÃO DA CÂMARA MINDAR
// ==========================================

const CONFIG_CAMERA = {

    width: 1920,

    height: 1080,

    facingMode: "environment",

    focusMode: "continuous",

    zoom: 1

};


// ==========================================
// CONFIGURAR A CÂMARA ANTES DO MINDAR
// ==========================================

function otimizarCameraMindAR() {

    const media = navigator.mediaDevices;

    if (!media?.getUserMedia) return;

    const getUserMediaOriginal =
        media.getUserMedia.bind(media);


    media.getUserMedia = async function (constraints) {

        if (!constraints?.video) {

            return getUserMediaOriginal(constraints);

        }


        const videoOriginal =

            typeof constraints.video === "object"

                ? { ...constraints.video }

                : {};


        let stream;


        // Solicitar uma imagem de maior resolução

        try {

            stream = await getUserMediaOriginal({

                ...constraints,

                video: {

                    ...videoOriginal,

                    facingMode: {

                        ideal: CONFIG_CAMERA.facingMode

                    },

                    width: {

                        ideal: CONFIG_CAMERA.width

                    },

                    height: {

                        ideal: CONFIG_CAMERA.height

                    }

                }

            });

        } catch (erro) {

            if (
                erro.name === "NotAllowedError" ||
                erro.name === "SecurityError"
            ) {

                throw erro;

            }

            console.warn(

                "A utilizar a configuração original da câmara.",

                erro

            );


            stream = await getUserMediaOriginal(

                constraints

            );

        }


        // Obter a câmara selecionada

        const track = stream.getVideoTracks()[0];


        if (track) {

            await configurarNitidez(track);

        }


        return stream;

    };

}


// ==========================================
// CONFIGURAR FOCO E ZOOM
// ==========================================

async function configurarNitidez(track) {

    let capacidades = {};


    try {

        capacidades =
            track.getCapabilities?.() || {};

    } catch (erro) {

        console.warn(

            "Não foi possível consultar as capacidades da câmara.",

            erro

        );

    }


    // FOCAGEM AUTOMÁTICA CONTÍNUA

    if (

        capacidades.focusMode?.includes("continuous")

    ) {

        try {

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

            console.log(

                "Foco contínuo solicitado."

            );

        } catch (erro) {

            console.warn(

                "Foco contínuo indisponível.",

                erro

            );

        }

    }


    // ZOOM NATURAL — 1X

    if (

        capacidades.zoom &&

        capacidades.zoom.min <= 1 &&

        capacidades.zoom.max >= 1

    ) {

        try {

            const atuais = track.getConstraints();

            await track.applyConstraints({

                ...atuais,

                advanced: [

                    ...(atuais.advanced || []),

                    {

                        zoom: 1

                    }

                ]

            });

        } catch (erro) {

            console.warn(

                "Não foi possível ajustar o zoom.",

                erro

            );

        }

    }


    // DIAGNÓSTICO DA CÂMARA

    const dados = track.getSettings();


    console.group("MINDAR — DIAGNÓSTICO DA CÂMARA");

    console.log("Câmara:", track.label);

    console.log("Resolução:", dados.width, "x", dados.height);

    console.log("FPS:", dados.frameRate);

    console.log("Foco:", dados.focusMode || "Não disponibilizado");

    console.log("Zoom:", dados.zoom ?? "Não disponibilizado");

    console.log("Capacidades:", capacidades);

    console.groupEnd();


    window.diagnosticoCamera = {

        camera: track.label,

        width: dados.width,

        height: dados.height,

        fps: dados.frameRate,

        focusMode: dados.focusMode,

        zoom: dados.zoom,

        capabilities: capacidades

    };

}


// Aplicar antes de iniciar o MindAR

otimizarCameraMindAR();


// ==========================================
// CONFIGURAÇÕES GERAIS DA ANIMAÇÃO
// ==========================================

const TOTAL_FRAMES = 220;

const FPS = 20;

const FRAME_DURATION = 1000 / FPS;

const FRAME_FOLDER = "./portfolio_frames_png/";

const BUFFER_SIZE = 8;


let cameraPreparada = false;

let experienciaIniciada = false;

let carregamentoConcluido = false;

let marcadorEncontrado = false;


const $ = id => document.getElementById(id);


// ==========================================
// CARREGAMENTO — MANTIDO
// ==========================================

function atualizarProgresso(valor, mensagem) {

    valor = Math.max(

        0,

        Math.min(100, valor)

    );


    $("percentagem").textContent =

        Math.round(valor) + "%";


    $("barra-progresso").style.width =

        valor + "%";


    $("circulo-progresso").style.strokeDashoffset =

        326.7256 * (1 - valor / 100);


    $("texto-carregamento").textContent =

        mensagem;

}


// ==========================================
// VERIFICAR CARREGAMENTO — MANTIDO
// ==========================================

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


    const primeiroFramePronto =

        componente?.frames.get(1)?.ready;


    let framesProntos = 0;


    for (let i = 1; i <= BUFFER_SIZE; i++) {

        if (componente?.frames.get(i)?.ready) {

            framesProntos++;

        }

    }


    const progresso =

        10 +

        (cameraPreparada ? 60 : 0) +

        29 * framesProntos / BUFFER_SIZE;


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

                componente.start();

            }

        }, 500);

    }

}


// ==========================================
// CAMINHO DOS PNG
// ==========================================

function framePath(number) {

    return FRAME_FOLDER +

        "frame_" +

        String(number).padStart(4, "0") +

        ".png";

}


// ==========================================
// DIAGNÓSTICO APÓS INICIALIZAÇÃO
// ==========================================

function verificarCameraMindAR(scene) {

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


        console.log(

            "Resolução efetiva do vídeo MindAR:",

            video.videoWidth,

            "x",

            video.videoHeight

        );


        console.log(

            "Configurações efetivas:",

            track.getSettings()

        );

    } catch (erro) {

        console.warn(

            "Diagnóstico da câmara indisponível.",

            erro

        );

    }

}


// ==========================================
// VERIFICAR BIBLIOTECAS
// ==========================================

if (!window.AFRAME) {

    window.mostrarErroAR(

        "Não foi possível carregar a biblioteca de realidade aumentada."

    );

} else {


// ==========================================
// COMPONENTE DA ANIMAÇÃO — MANTIDO
// ==========================================

    AFRAME.registerComponent("sequencia-envelope", {

        init: function () {

            this.currentFrame = 1;

            this.playing = false;

            this.lastTime = null;

            this.frames = new Map();


            this.canvas =

                document.createElement("canvas");


            this.canvas.width = 1100;

            this.canvas.height = 1250;


            this.ctx =

                this.canvas.getContext("2d");


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


        // ==================================
        // CARREGAR IMAGENS
        // ==================================

        loadFrame: function (number) {

            if (

                this.frames.has(number) ||

                window.arFalhou

            ) {

                return;

            }


            const image = new Image();


            const frame = {

                image: image,

                ready: false

            };


            this.frames.set(number, frame);


            image.onload = () => {

                frame.ready = true;

                verificarCarregamento();

            };


            image.onerror = () => {

                if (this.frames.get(number) !== frame) {

                    return;

                }


                this.frames.delete(number);


                window.mostrarErroAR(

                    "Não foi possível carregar a imagem " +

                    number +

                    " da animação."

                );

            };


            image.src = framePath(number);

        },


        // ==================================
        // PRÉ-CARREGAMENTO
        // ==================================

        preloadFrames: function (start) {

            for (let i = 0; i < BUFFER_SIZE; i++) {

                const number =

                    ((start - 1 + i) %

                        TOTAL_FRAMES) + 1;


                this.loadFrame(number);

            }

        },


        // ==================================
        // DESENHAR IMAGEM
        // ==================================

        drawFrame: function (number) {

            const frame = this.frames.get(number);


            if (!frame?.ready) {

                return false;

            }


            this.ctx.clearRect(

                0,

                0,

                1100,

                1250

            );


            this.ctx.drawImage(

                frame.image,

                0,

                0

            );


            this.texture.needsUpdate = true;


            return true;

        },


        // ==================================
        // INICIAR ANIMAÇÃO
        // ==================================

        start: function () {

            this.currentFrame = 1;

            this.lastTime = null;

            this.playing = true;


            this.preloadFrames(1);


            this.el.setAttribute(

                "visible",

                this.drawFrame(1)

            );

        },


        // ==================================
        // PARAR ANIMAÇÃO
        // ==================================

        stop: function () {

            this.playing = false;

            this.lastTime = null;


            this.el.setAttribute(

                "visible",

                false

            );

        },


        // ==================================
        // REPRODUÇÃO DOS 220 FRAMES
        // ==================================

        tick: function (time) {

            if (

                !this.playing ||

                !carregamentoConcluido ||

                window.arFalhou

            ) {

                return;

            }


            if (this.lastTime === null) {

                this.lastTime = time - FRAME_DURATION;

            }


            if (

                time - this.lastTime < FRAME_DURATION

            ) {

                return;

            }


            if (!this.drawFrame(this.currentFrame)) {

                this.loadFrame(this.currentFrame);

                return;

            }


            this.el.setAttribute("visible", true);


            this.lastTime += FRAME_DURATION;


            if (time - this.lastTime > FRAME_DURATION) {

                this.lastTime = time;

            }


            this.frames.delete(this.currentFrame);


            this.currentFrame =

                this.currentFrame % TOTAL_FRAMES + 1;


            const manter = new Set(

                Array.from(

                    { length: BUFFER_SIZE },

                    (_, i) =>

                        (this.currentFrame - 1 + i) %

                        TOTAL_FRAMES + 1

                )

            );


            for (const number of this.frames.keys()) {

                if (!manter.has(number)) {

                    this.frames.delete(number);

                }

            }


            this.preloadFrames(this.currentFrame);

        }

    });


// ==========================================
// INICIALIZAÇÃO DA EXPERIÊNCIA — MANTIDA
// ==========================================

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


// ==========================================
// BOTÃO INICIAR EXPERIÊNCIA
// ==========================================

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


            if (!navigator.mediaDevices?.getUserMedia) {

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

                        "MindAR não está disponível."

                    );

                }


                const arranque = sistema.start();


                animacao.components[

                    "sequencia-envelope"

                ].preloadFrames(1);


                atualizarProgresso(

                    10,

                    "A preparar o reconhecimento..."

                );


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


// ==========================================
// CÂMARA PREPARADA
// ==========================================

        scene.addEventListener("arReady", () => {

            if (window.arFalhou) {

                try {

                    scene.systems[

                        "mindar-image-system"

                    ].stop();

                } catch (e) {}

                return;

            }


            cameraPreparada = true;


            estado.textContent =

                "Aponta a câmara para o envelope completo.";


            verificarCameraMindAR(scene);


            verificarCarregamento();

        });


// ==========================================
// ENVELOPE RECONHECIDO
// ==========================================

        marcador.addEventListener("targetFound", () => {

            if (window.arFalhou) return;


            marcadorEncontrado = true;


            document.body.classList.add(

                "alvo-encontrado"

            );


            estado.textContent =

                "Envelope reconhecido!";


            if (

                carregamentoConcluido &&

                $("carregamento-ar").hidden

            ) {

                animacao.components[

                    "sequencia-envelope"

                ].start();

            }

        });


// ==========================================
// PERDA DO MARCADOR
// ==========================================

        marcador.addEventListener("targetLost", () => {

            marcadorEncontrado = false;


            document.body.classList.remove(

                "alvo-encontrado"

            );


            estado.textContent =

                "Volta a apontar para o envelope.";


            animacao.components[

                "sequencia-envelope"

            ]?.stop();

        });


// ==========================================
// ECRÃ DE ERRO — MANTIDO
// ==========================================

        scene.addEventListener("arError", () => {

            window.mostrarErroAR(

                "Não foi possível inicializar a câmara. Verifica as permissões e experimenta novamente."

            );

        });


// ==========================================
// ATIVAR BOTÃO INICIAL
// ==========================================

        function prepararBotao() {

            if (window.arFalhou) return;


            clearTimeout(window.limiteAR);


            botao.disabled = false;


            botao.textContent =

                "Iniciar experiência";

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


// ==========================================
// LIBERTAR CÂMARA AO SAIR
// ==========================================

        window.addEventListener("pagehide", () => {

            try {

                scene.systems[

                    "mindar-image-system"

                ].stop();

            } catch (e) {}


            document.querySelectorAll("video")

                .forEach(video => {

                    video.srcObject?.getTracks()

                        .forEach(track => track.stop());

                });

        });

    });

}
