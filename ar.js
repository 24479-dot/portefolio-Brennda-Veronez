
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
let carregamentoFalhou = false;


// ==========================================
// CONTROLO DO CARREGAMENTO
// ==========================================

function atualizarProgresso(valor, mensagem) {

    const percentagem =
        document.getElementById("percentagem");

    const barra =
        document.getElementById("barra-progresso");

    const circulo =
        document.getElementById("circulo-progresso");

    const texto =
        document.getElementById("texto-carregamento");

    if (!percentagem || !barra || !circulo || !texto) {
        return;
    }

    percentagem.textContent = Math.round(valor) + "%";

    barra.style.width = valor + "%";

    circulo.style.strokeDashoffset =
        326.7256 * (1 - valor / 100);

    texto.textContent = mensagem;

}


function verificarCarregamento() {

    if (carregamentoConcluido || carregamentoFalhou) {
        return;
    }

    const animacao =
        document.querySelector("#animacao-envelope");

    const componente =
        animacao?.components?.["sequencia-envelope"];

    let framesProntos = 0;

    if (componente) {

        for (let i = 1; i <= BUFFER_SIZE; i++) {

            if (componente.frames.get(i)?.ready) {
                framesProntos++;
            }

        }

    }

    const progresso =
        10 +
        (cameraPreparada ? 45 : 0) +
        (framesProntos / BUFFER_SIZE) * 45;

    if (cameraPreparada && framesProntos === BUFFER_SIZE) {

        carregamentoConcluido = true;

        atualizarProgresso(
            100,
            "Experiência preparada!"
        );

        setTimeout(() => {

            document
                .getElementById("carregamento-ar")
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


function erroCarregamento(mensagem) {

    carregamentoFalhou = true;

    const texto =
        document.getElementById("texto-carregamento");

    if (texto) {

        texto.textContent =
            mensagem + " Atualiza a página para tentar novamente.";

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

            verificarCarregamento();

        };

        image.onerror = () => {

            console.error(
                "Erro ao carregar:",
                framePath(number)
            );

            this.frames.delete(number);

            if (!carregamentoConcluido) {

                erroCarregamento(
                    "Não foi possível carregar a animação."
                );

            }

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

        this.ctx.drawImage(
            frame.image,
            0,
            0
        );

        this.texture.needsUpdate = true;

        return true;

    },


    start: function () {

        this.currentFrame = 1;
        this.lastTime = 0;
        this.playing = true;

        this.frames.clear();

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

        if (!this.playing || !carregamentoConcluido) {
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

    const scene =
        document.querySelector("a-scene");

    const marcador =
        document.querySelector("#marcador");

    const animacao =
        document.querySelector("#animacao-envelope");

    const estado =
        document.querySelector("#estado");


    atualizarProgresso(
        0,
        "A iniciar a experiência..."
    );


    // SELO RECONHECIDO

    marcador.addEventListener("targetFound", () => {

        document.body.classList.add(
            "alvo-encontrado"
        );

        estado.textContent =
            "Selo reconhecido!";

        const componente =
            animacao.components["sequencia-envelope"];

        if (carregamentoConcluido) {

            componente.start();

        } else {

            componente.currentFrame = 1;
            componente.lastTime = 0;
            componente.playing = true;

        }

    });


    // PERDA DO MARCADOR

    marcador.addEventListener("targetLost", () => {

        document.body.classList.remove(
            "alvo-encontrado"
        );

        estado.textContent =
            "Volta a apontar para o selo dourado.";

        animacao.components[
            "sequencia-envelope"
        ].stop();

    });


    // CÂMARA PREPARADA

    scene.addEventListener("arReady", () => {

        cameraPreparada = true;

        estado.textContent =
            "Aponta a câmara para o selo dourado.";

        verificarCarregamento();

    });


    // ERRO NA REALIDADE AUMENTADA

    scene.addEventListener("arError", () => {

        estado.textContent =
            "Não foi possível iniciar a realidade aumentada.";

        erroCarregamento(
            "Verifica as permissões da câmara e o marcador."
        );

    });


    // INICIAR MINDAR

    async function iniciarAR() {

        atualizarProgresso(
            10,
            "A iniciar a câmara..."
        );

        estado.textContent =
            "A iniciar a câmara...";

        verificarCarregamento();

        try {

            const sistemaAR =
                scene.systems["mindar-image-system"];

            await sistemaAR.start();

        } catch (error) {

            console.error(error);

            erroCarregamento(
                "Não foi possível iniciar a câmara."
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
