
// ==========================================
// CONFIGURAÇÃO DA CÂMARA
// ==========================================

if (navigator.mediaDevices?.getUserMedia) {

    const getUserMediaOriginal =
        navigator.mediaDevices.getUserMedia.bind(
            navigator.mediaDevices
        );

    navigator.mediaDevices.getUserMedia =
        async function (constraints) {

        if (!constraints?.video) {
            return getUserMediaOriginal(constraints);
        }

        const videoOriginal =
            typeof constraints.video === "object"
                ? constraints.video
                : {};

        const novasConfiguracoes = {

            ...constraints,

            video: {
                ...videoOriginal,

                facingMode: {
                    ideal: "environment"
                },

                width: {
                    ideal: 1920
                },

                height: {
                    ideal: 1080
                },

                frameRate: {
                    ideal: 30
                }
            }
        };

        let stream;

        try {

            stream = await getUserMediaOriginal(
                novasConfiguracoes
            );

        } catch (error) {

            stream = await getUserMediaOriginal(
                constraints
            );

        }

        const track = stream.getVideoTracks()[0];

        if (track && track.getCapabilities) {

            const capacidades = track.getCapabilities();

            const ajustes = [];

            // FOCAGEM AUTOMÁTICA CONTÍNUA

            if (capacidades.focusMode?.includes(
                "continuous"
            )) {

                ajustes.push({
                    focusMode: "continuous"
                });

            }

            // EXPOSIÇÃO AUTOMÁTICA

            if (capacidades.exposureMode?.includes(
                "continuous"
            )) {

                ajustes.push({
                    exposureMode: "continuous"
                });

            }

            for (const ajuste of ajustes) {

                try {

                    await track.applyConstraints({
                        ...track.getConstraints(),
                        advanced: [ajuste]
                    });

                } catch (error) {

                    console.warn(
                        "Ajuste não suportado:",
                        ajuste
                    );

                }

            }

            console.log(
                "Configuração da câmara:",
                track.getSettings()
            );

        }

        return stream;

    };

}


// ==========================================
// CONFIGURAÇÃO DA ANIMAÇÃO
// ==========================================

const TOTAL_FRAMES = 220;
const FPS = 20;
const FRAME_DURATION = 1000 / FPS;

const FRAME_FOLDER = "./portfolio_frames_png/";
const BUFFER_SIZE = 24;


function framePath(number) {

    return FRAME_FOLDER +
        "frame_" +
        String(number).padStart(4, "0") +
        ".png";

}


// ==========================================
// COMPONENTE DA ANIMAÇÃO
// ==========================================

AFRAME.registerComponent("sequencia-envelope", {

    init: function () {

        this.currentFrame = 1;
        this.playing = false;
        this.lastTime = 0;

        this.frames = new Map();

        this.canvas = document.createElement("canvas");

        this.canvas.width = 1100;
        this.canvas.height = 1250;

        this.ctx = this.canvas.getContext("2d");

        this.texture = new THREE.CanvasTexture(
            this.canvas
        );

        this.texture.colorSpace = THREE.SRGBColorSpace;
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


    loadFrame: function (number) {

        if (this.frames.has(number)) {

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

        };

        image.onerror = () => {

            console.error(
                "Erro ao carregar:",
                framePath(number)
            );

            this.frames.delete(number);

        };

        image.src = framePath(number);

    },


    preloadFrames: function (start) {

        for (let i = 0; i < BUFFER_SIZE; i++) {

            const number =
                ((start - 1 + i) % TOTAL_FRAMES) + 1;

            this.loadFrame(number);

        }

    },


    drawFrame: function (number) {

        const frame = this.frames.get(number);

        if (!frame || !frame.ready) {

            return false;

        }

        this.ctx.clearRect(

            0,

            0,

            this.canvas.width,

            this.canvas.height

        );

        this.ctx.drawImage(frame.image, 0, 0);

        this.texture.needsUpdate = true;

        return true;

    },


    start: function () {

        this.currentFrame = 1;

        this.lastTime = 0;

        this.playing = true;

        this.preloadFrames(1);

        this.ctx.clearRect(0, 0, 1100, 1250);

        this.texture.needsUpdate = true;

        this.el.setAttribute("visible", false);

    },


    stop: function () {

        this.playing = false;

        this.el.setAttribute("visible", false);

    },


    tick: function (time) {

        if (!this.playing) {

            return;

        }

        if (time - this.lastTime < FRAME_DURATION) {

            return;

        }

        const success = this.drawFrame(
            this.currentFrame
        );

        if (!success) {

            this.loadFrame(this.currentFrame);

            return;

        }

        this.el.setAttribute("visible", true);

        this.lastTime = time;

        this.frames.delete(this.currentFrame);

        this.currentFrame++;

        if (this.currentFrame > TOTAL_FRAMES) {

            this.currentFrame = 1;

        }

        const nextFrame =
            ((this.currentFrame - 1 +
                BUFFER_SIZE - 1) % TOTAL_FRAMES) + 1;

        this.loadFrame(nextFrame);

    }

});


// ==========================================
// INICIAR REALIDADE AUMENTADA
// ==========================================

document.addEventListener("DOMContentLoaded", () => {

    const scene = document.querySelector("a-scene");

    const marcador = document.querySelector(
        "#marcador"
    );

    const animacao = document.querySelector(
        "#animacao-envelope"
    );

    const estado = document.querySelector(
        "#estado"
    );


    // ENVELOPE RECONHECIDO

    marcador.addEventListener("targetFound", () => {

        document.body.classList.add(
            "alvo-encontrado"
        );

        estado.textContent =
            "Envelope reconhecido!";

        animacao.components[
            "sequencia-envelope"
        ].start();

    });


    // ENVELOPE PERDIDO

    marcador.addEventListener("targetLost", () => {

        document.body.classList.remove(
            "alvo-encontrado"
        );

        estado.textContent =
            "Aponta novamente para o envelope.";

        animacao.components[
            "sequencia-envelope"
        ].stop();

    });


    // CÂMARA PREPARADA

    scene.addEventListener("arReady", () => {

        estado.textContent =
            "Aponta a câmara para o envelope.";

    });


    // ERRO

    scene.addEventListener("arError", () => {

        estado.textContent =
            "Não foi possível iniciar a experiência AR.";

    });


    async function iniciarAR() {

        estado.textContent =
            "A preparar a câmara...";

        try {

            const sistemaAR =
                scene.systems["mindar-image-system"];

            await sistemaAR.start();

        } catch (error) {

            console.error(error);

            estado.textContent =
                "Verifica as permissões da câmara e o marcador.";

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
