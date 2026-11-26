
// ==========================================
// SELEÇÃO DA CÂMARA
// ==========================================

let cameraEscolhida = "";

try {

    cameraEscolhida =
        sessionStorage.getItem(
            "brennda-camera-v13"
        ) || "";

} catch (e) {}


const media = navigator.mediaDevices;


if (media?.getUserMedia && cameraEscolhida) {

    const original =
        media.getUserMedia.bind(media);

    media.getUserMedia = async constraints => {

        if (!constraints?.video) {

            return original(constraints);

        }

        const video =
            typeof constraints.video === "object"
                ? { ...constraints.video }
                : {};

        delete video.facingMode;

        try {

            return await original({

                ...constraints,

                video: {

                    ...video,

                    deviceId: {
                        exact: cameraEscolhida
                    }

                }

            });

        } catch (e) {

            console.warn(
                "Câmara selecionada indisponível",
                e
            );

            try {

                sessionStorage.removeItem(
                    "brennda-camera-v13"
                );

            } catch (e2) {}

            return original(constraints);

        }

    };

}


// ==========================================
// CONFIGURAÇÕES E FOCAGEM DA CÂMARA
// ==========================================

async function configurarControlosCamera(scene) {

    const lista =
        document.getElementById("camera-lista");

    const info =
        document.getElementById("camera-info");

    const track =
        scene.systems["mindar-image-system"]
            ?.video
            ?.srcObject
            ?.getVideoTracks()[0];

    if (!track) return;


    const dados = track.getSettings();

    info.textContent =
        `${track.label || "Câmara ativa"} | ` +
        `${dados.width || "?"} × ${dados.height || "?"}`;


    // LISTAR CÂMARAS DISPONÍVEIS

    try {

        const cameras =
            (await media.enumerateDevices())
                .filter(dispositivo =>

                    dispositivo.kind === "videoinput" &&
                    dispositivo.deviceId

                );

        lista.replaceChildren();

        cameras.forEach((camera, index) => {

            const opcao =
                document.createElement("option");

            opcao.value = camera.deviceId;

            opcao.textContent =
                camera.label || `Câmara ${index + 1}`;

            lista.append(opcao);

        });

        lista.value = dados.deviceId || "";

        document.getElementById(
            "camera-trocar"
        ).disabled = !cameras.length;

    } catch (e) {

        info.textContent +=
            " | Não foi possível listar as câmaras.";

    }


    // TROCAR DE CÂMARA

    document.getElementById(
        "camera-trocar"
    ).onclick = () => {

        if (!lista.value) return;

        try {

            sessionStorage.setItem(
                "brennda-camera-v13",
                lista.value
            );

        } catch (e) {

            info.textContent =
                "Não foi possível guardar a escolha neste navegador.";

            return;

        }

        try {

            scene.systems[
                "mindar-image-system"
            ].stop();

        } catch (e) {}

        location.reload();

    };


    // ATIVAR FOCAGEM AUTOMÁTICA CONTÍNUA

    document.getElementById(
        "camera-foco"
    ).onclick = async () => {

        try {

            const capacidades =
                track.getCapabilities?.() || {};

            if (!capacidades.focusMode?.includes(
                "continuous"
            )) {

                info.textContent =
                    "Esta lente não disponibiliza foco contínuo ao navegador.";

                return;

            }


            await track.applyConstraints({

                ...track.getConstraints(),

                advanced: [

                    ...(track.getConstraints().advanced || []),

                    {
                        focusMode: "continuous"
                    }

                ]

            });


            info.textContent =
                track.getSettings().focusMode === "continuous"

                    ? "Foco contínuo ativo."

                    : "Foco solicitado; o navegador não confirmou o ajuste.";

        } catch (e) {

            info.textContent =
                "Não foi possível ajustar o foco desta lente.";

        }

    };

}


// ==========================================
// CONFIGURAÇÕES DA ANIMAÇÃO
// ==========================================

const TOTAL_FRAMES = 220;

const FPS = 20;

const FRAME_DURATION = 1000 / FPS;

const FRAME_FOLDER = "./portfolio_frames_png/";

const BUFFER_SIZE = 24;


let cameraPreparada = false;

let carregamentoConcluido = false;


const $ = id => document.getElementById(id);


// ==========================================
// CONTROLO DO CARREGAMENTO
// ==========================================

function atualizarProgresso(valor, mensagem) {

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
// VERIFICAR CARREGAMENTO
// ==========================================

function verificarCarregamento() {

    if (carregamentoConcluido || window.arFalhou) {

        return;

    }

    const componente =
        $("animacao-envelope")
            ?.components?.["sequencia-envelope"];

    let framesProntos = 0;


    for (let i = 1; i <= BUFFER_SIZE; i++) {

        if (componente?.frames.get(i)?.ready) {

            framesProntos++;

        }

    }


    const progresso =

        10 +

        (cameraPreparada ? 45 : 0) +

        45 * framesProntos / BUFFER_SIZE;


    if (
        cameraPreparada &&
        framesProntos === BUFFER_SIZE
    ) {

        carregamentoConcluido = true;

        window.arPronto = true;

        clearTimeout(window.limiteAR);


        atualizarProgresso(
            100,
            "Experiência preparada!"
        );


        setTimeout(() => {

            $("carregamento-ar")
                .classList.add("oculto");

        }, 600);


    } else {

        atualizarProgresso(

            Math.min(progresso, 99),

            cameraPreparada

                ? "A carregar a animação..."

                : "A preparar a câmara e o reconhecimento..."

        );

    }

}


// ==========================================
// CAMINHO DOS FRAMES
// ==========================================

function framePath(number) {

    return FRAME_FOLDER +

        "frame_" +

        String(number).padStart(4, "0") +

        ".png";

}


// ==========================================
// VERIFICAR BIBLIOTECA
// ==========================================

if (!window.AFRAME) {

    window.mostrarErroAR(
        "Não foi possível carregar a biblioteca de realidade aumentada."
    );

} else {


// ==========================================
// COMPONENTE DA ANIMAÇÃO
// ==========================================

    AFRAME.registerComponent("sequencia-envelope", {

        init: function () {

            this.currentFrame = 1;

            this.playing = false;

            this.lastTime = 0;

            this.frames = new Map();


            this.canvas =
                document.createElement("canvas");

            this.canvas.width = 1100;

            this.canvas.height = 1250;


            this.ctx =
                this.canvas.getContext("2d");


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

            this.preloadFrames(1);

        },


        // CARREGAR FRAME

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
                    "Não foi possível carregar a animação."
                );

            };


            image.src = framePath(number);

        },


        // PRÉ-CARREGAMENTO

        preloadFrames: function (start) {

            for (let i = 0; i < BUFFER_SIZE; i++) {

                const number =
                    ((start - 1 + i) % TOTAL_FRAMES) + 1;

                this.loadFrame(number);

            }

        },


        // DESENHAR FRAME

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


        // INICIAR ANIMAÇÃO

        start: function () {

            this.currentFrame = 1;

            this.lastTime = 0;

            this.playing = true;


            this.preloadFrames(1);


            this.ctx.clearRect(

                0,

                0,

                1100,

                1250

            );


            this.texture.needsUpdate = true;

            this.el.setAttribute("visible", false);

        },


        // PARAR ANIMAÇÃO

        stop: function () {

            this.playing = false;

            this.el.setAttribute("visible", false);

        },


        // REPRODUÇÃO DA ANIMAÇÃO

        tick: function (time) {

            if (

                !this.playing ||

                !carregamentoConcluido ||

                window.arFalhou

            ) {

                return;

            }


            if (time - this.lastTime < FRAME_DURATION) {

                return;

            }


            if (!this.drawFrame(this.currentFrame)) {

                this.loadFrame(this.currentFrame);

                return;

            }


            this.el.setAttribute("visible", true);


            this.lastTime = time;


            this.frames.delete(this.currentFrame);


            this.currentFrame =
                this.currentFrame % TOTAL_FRAMES + 1;


            const nextFrame =

                ((this.currentFrame - 1 +

                    BUFFER_SIZE - 1) % TOTAL_FRAMES) + 1;


            this.loadFrame(nextFrame);


            // CONTROLAR CONSUMO DE MEMÓRIA

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

        }

    });


// ==========================================
// INICIAR EXPERIÊNCIA MINDAR
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


// ==========================================
// ENVELOPE RECONHECIDO
// ==========================================

        marcador.addEventListener("targetFound", () => {

            if (window.arFalhou) return;


            document.body.classList.add(
                "alvo-encontrado"
            );


            estado.textContent =
                "Envelope reconhecido!";


            animacao.components[
                "sequencia-envelope"
            ].start();

        });


// ==========================================
// PERDA DO MARCADOR
// ==========================================

        marcador.addEventListener("targetLost", () => {

            document.body.classList.remove(
                "alvo-encontrado"
            );


            estado.textContent =
                "Volta a apontar para o envelope completo.";


            animacao.components[
                "sequencia-envelope"
            ]?.stop();

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


            configurarControlosCamera(scene);


            estado.textContent =
                "Aponta a câmara para o envelope completo.";


            verificarCarregamento();

        });


// ==========================================
// ERRO NA EXPERIÊNCIA
// ==========================================

        scene.addEventListener("arError", () => {

            window.mostrarErroAR(
                "Não foi possível iniciar a câmara ou o reconhecimento."
            );

        });


// ==========================================
// INICIALIZAÇÃO DO MINDAR
// ==========================================

        async function iniciarAR() {

            if (window.arFalhou) return;


            verificarCarregamento();


            try {

                await scene.systems[
                    "mindar-image-system"
                ].start();

            } catch (e) {

                console.error(e);


                window.mostrarErroAR(
                    "Não foi possível iniciar a experiência."
                );

            }

        }


        if (scene.hasLoaded) {

            iniciarAR();

        } else {

            scene.addEventListener(

                "loaded",

                iniciarAR,

                { once: true }

            );

        }

    });

}
