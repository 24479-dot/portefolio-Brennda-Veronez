
// ==========================================
// V17 — DIAGNÓSTICO E CONTROLO DA CÂMARA
// ==========================================

(() => {

    "use strict";

    const media = navigator.mediaDevices;

    let track = null;
    let video = null;
    let capacidades = {};
    let alvoEncontrado = false;
    let ajustes = {};
    let ocupado = false;

    let cameraEscolhida = "";

    try {

        cameraEscolhida =
            sessionStorage.getItem("brennda-camera-v17") || "";

    } catch (erro) {}


    // ==========================================
    // SELEÇÃO DA CÂMARA
    // ==========================================

    if (media?.getUserMedia) {

        const original =
            media.getUserMedia.bind(media);

        media.getUserMedia = async function (constraints) {

            if (!constraints?.video || !cameraEscolhida) {

                return original(constraints);

            }

            const videoConstraints =
                typeof constraints.video === "object"
                    ? { ...constraints.video }
                    : {};

            delete videoConstraints.facingMode;

            try {

                return await original({

                    ...constraints,

                    video: {

                        ...videoConstraints,

                        deviceId: {
                            exact: cameraEscolhida
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
                    "Câmara selecionada indisponível.",
                    erro
                );

                cameraEscolhida = "";

                try {

                    sessionStorage.removeItem(
                        "brennda-camera-v17"
                    );

                } catch (e) {}

                return original(constraints);

            }

        };

    }


    // ==========================================
    // ELEMENTOS DA INTERFACE
    // ==========================================

    const $ = id => document.getElementById(id);


    function mensagem(texto) {

        $("camera-mensagem").textContent = texto;

    }


    // ==========================================
    // DIAGNÓSTICO REAL DA CÂMARA
    // ==========================================

    function atualizarDiagnostico() {

        if (!track) return;

        const dados = track.getSettings();

        $("diag-camera").textContent =
            track.label || "Não identificada";

        $("diag-resolucao").textContent =
            `${video.videoWidth || dados.width || "?"} × ` +
            `${video.videoHeight || dados.height || "?"}`;

        $("diag-fps").textContent =
            dados.frameRate
                ? Math.round(dados.frameRate)
                : "Não informado";

        $("diag-foco").textContent =
            dados.focusMode || "Não disponibilizado";

        $("diag-exposicao").textContent =
            dados.exposureMode || "Não disponibilizada";

        $("diag-zoom").textContent =
            dados.zoom !== undefined
                ? `${dados.zoom.toFixed(1)}×`
                : "Não disponibilizado";

        $("diag-target").textContent =
            alvoEncontrado
                ? "Envelope reconhecido"
                : "A procurar envelope";

        $("diag-target").style.color =
            alvoEncontrado
                ? "#93d6a2"
                : "#e8d3a3";

        window.diagnosticoCameraV17 = {

            camera: track.label,

            settings: dados,

            capabilities: capacidades,

            videoWidth: video.videoWidth,

            videoHeight: video.videoHeight,

            targetFound: alvoEncontrado

        };

    }


    // ==========================================
    // APLICAR CONFIGURAÇÕES
    // ==========================================

    async function aplicarConfiguracao(novas) {

        if (!track || ocupado) return false;

        ocupado = true;

        const anteriores = { ...ajustes };

        const pretendidos = {

            ...ajustes,

            ...novas

        };

        try {

            const atuais = track.getConstraints();

            // Manter a resolução e a lente existentes.

            await track.applyConstraints({

                ...atuais,

                advanced: [

                    pretendidos

                ]

            });

            ajustes = pretendidos;

            atualizarDiagnostico();

            return true;

        } catch (erro) {

            ajustes = anteriores;

            mensagem(
                "O navegador não aceitou este ajuste."
            );

            console.warn(erro);

            return false;

        } finally {

            ocupado = false;

        }

    }


    // ==========================================
    // FOCAGEM AUTOMÁTICA
    // ==========================================

    async function ativarFoco() {

        const modos = capacidades.focusMode || [];

        if (!modos.includes("continuous")) {

            mensagem(
                "O navegador não disponibiliza foco contínuo."
            );

            return;

        }

        const sucesso = await aplicarConfiguracao({

            focusMode: "continuous"

        });

        if (!sucesso) return;

        mensagem(

            track.getSettings().focusMode === "continuous"

                ? "Foco automático contínuo ativo."

                : "Foco solicitado, mas não confirmado."

        );

    }


    // ==========================================
    // EXPOSIÇÃO AUTOMÁTICA
    // ==========================================

    async function ativarExposicao() {

        const modos = capacidades.exposureMode || [];

        if (!modos.includes("continuous")) {

            mensagem(
                "O navegador não disponibiliza exposição contínua."
            );

            return;

        }

        const sucesso = await aplicarConfiguracao({

            exposureMode: "continuous"

        });

        if (!sucesso) return;

        mensagem(

            track.getSettings().exposureMode === "continuous"

                ? "Exposição automática ativa."

                : "Exposição solicitada, mas não confirmada."

        );

    }


    // ==========================================
    // CONFIGURAR OS CONTROLOS DESLIZANTES
    // ==========================================

    function prepararSlider(id, valorId, propriedade) {

        const slider = $(id);

        const intervalo = capacidades[propriedade];

        if (
            !intervalo ||
            !Number.isFinite(intervalo.min) ||
            !Number.isFinite(intervalo.max) ||
            intervalo.min === intervalo.max
        ) {

            slider.disabled = true;

            $(valorId).textContent =
                "Não suportado";

            return;

        }

        const dados = track.getSettings();

        slider.min = intervalo.min;

        slider.max = intervalo.max;

        slider.step =
            intervalo.step > 0
                ? intervalo.step
                : 0.1;

        slider.value =
            dados[propriedade] ??
            Math.max(
                intervalo.min,
                Math.min(
                    intervalo.max,
                    propriedade === "zoom" ? 1 : 0
                )
            );

        slider.disabled = false;

        $(valorId).textContent = slider.value;

        slider.oninput = () => {

            $(valorId).textContent =
                Number(slider.value).toFixed(1);

        };

        slider.onchange = async () => {

            const sucesso = await aplicarConfiguracao({

                [propriedade]: Number(slider.value)

            });

            if (!sucesso) return;

            const valorReal =
                track.getSettings()[propriedade];

            if (valorReal !== undefined) {

                slider.value = valorReal;

                $(valorId).textContent =
                    Number(valorReal).toFixed(1);

                mensagem(
                    "Configuração atualizada."
                );

            } else {

                mensagem(
                    "Ajuste solicitado, mas não confirmado."
                );

            }

        };

    }


    // ==========================================
    // LISTAR AS CÂMARAS DISPONÍVEIS
    // ==========================================

    async function listarCamaras() {

        try {

            const dispositivos =
                await media.enumerateDevices();

            const cameras =
                dispositivos.filter(dispositivo =>

                    dispositivo.kind === "videoinput" &&
                    dispositivo.deviceId

                );

            const lista = $("camera-lista");

            lista.replaceChildren();

            cameras.forEach((camera, index) => {

                const opcao =
                    document.createElement("option");

                opcao.value = camera.deviceId;

                opcao.textContent =
                    camera.label || `Câmara ${index + 1}`;

                lista.appendChild(opcao);

            });

            lista.value =
                track.getSettings().deviceId || "";

            $("camera-trocar").disabled =
                cameras.length < 2;

        } catch (erro) {

            mensagem(
                "Não foi possível listar as câmaras."
            );

        }

    }


    // ==========================================
    // TROCAR DE LENTE
    // ==========================================

    function trocarCamera() {

        const escolha = $("camera-lista").value;

        if (!escolha) return;

        try {

            sessionStorage.setItem(
                "brennda-camera-v17",
                escolha
            );

            location.reload();

        } catch (erro) {

            mensagem(
                "Não foi possível guardar a escolha da câmara."
            );

        }

    }


    // ==========================================
    // FOCAGEM ATRAVÉS DE UM TOQUE
    // ==========================================

    async function focarNoPonto(evento) {

        if (!track || !video || ocupado) return;

        if (!capacidadeFocoToque()) return;

        if (
            evento.target.closest(
                "#camera-painel, #camera-abrir, a, button"
            )
        ) return;

        if (!$("camera-toque").checked) return;

        if (
            !$("inicio-ar").hidden ||
            !$("carregamento-ar").hidden ||
            !$("erro-ar").hidden
        ) return;

        const rect = video.getBoundingClientRect();

        if (!rect.width || !rect.height) return;

        const x =
            (evento.clientX - rect.left) / rect.width;

        const y =
            (evento.clientY - rect.top) / rect.height;

        if (x < 0 || x > 1 || y < 0 || y > 1) return;

        const novas = {

            pointsOfInterest: [{ x, y }]

        };

        if (
            capacidades.focusMode?.includes("single-shot")
        ) {

            novas.focusMode = "single-shot";

        }

        const sucesso =
            await aplicarConfiguracao(novas);

        if (sucesso) {

            mensagem(
                "Pedido de focagem enviado à câmara."
            );

            mostrarPonto(
                evento.clientX,
                evento.clientY
            );

        }

    }


    function capacidadeFocoToque() {

        const suportadas =
            media.getSupportedConstraints?.() || {};

        return Boolean(

            suportadas.pointsOfInterest &&

            capacidades.focusMode?.some(modo =>

                modo === "single-shot" ||
                modo === "continuous"

            )

        );

    }


    // ==========================================
    // INDICADOR VISUAL DE FOCAGEM
    // ==========================================

    function mostrarPonto(x, y) {

        const ponto = $("camera-ponto");

        ponto.style.left = `${x}px`;

        ponto.style.top = `${y}px`;

        ponto.hidden = false;

        setTimeout(() => {

            ponto.hidden = true;

        }, 800);

    }


    // ==========================================
    // INICIAR O PAINEL APÓS O MINDAR
    // ==========================================

    async function iniciarPainel(scene) {

        const sistema =
            scene.systems["mindar-image-system"];

        video =
            sistema.video ||
            document.querySelector("body > video");

        track =
            video?.srcObject?.getVideoTracks()[0];

        if (!track) return;

        try {

            capacidades =
                track.getCapabilities?.() || {};

        } catch (erro) {

            capacidades = {};

        }

        const dados = track.getSettings();

        for (const propriedade of [

            "focusMode",

            "exposureMode",

            "exposureCompensation",

            "zoom"

        ]) {

            if (
                capacidades[propriedade] !== undefined &&
                dados[propriedade] !== undefined
            ) {

                ajustes[propriedade] =
                    dados[propriedade];

            }

        }

        $("camera-abrir").hidden = false;

        $("camera-foco").disabled =
            !capacidades.focusMode?.includes(
                "continuous"
            );

        $("camera-exposicao-auto").disabled =
            !capacidades.exposureMode?.includes(
                "continuous"
            );

        $("camera-toque").disabled =
            !capacidadeFocoToque();

        prepararSlider(

            "camera-exposicao",

            "valor-exposicao",

            "exposureCompensation"

        );

        prepararSlider(

            "camera-zoom",

            "valor-zoom",

            "zoom"

        );

        await listarCamaras();

        atualizarDiagnostico();

        mensagem(
            "Valores reais da câmara apresentados acima."
        );

        // Atualizar os dados sem reiniciar o MindAR.

        setInterval(() => {

            if (
                track?.readyState === "live" &&
                !$("camera-painel").hidden
            ) {

                atualizarDiagnostico();

            }

        }, 1000);

    }


    // ==========================================
    // EVENTOS DA INTERFACE
    // ==========================================

    document.addEventListener("DOMContentLoaded", () => {

        const scene =
            document.querySelector("a-scene");

        $("camera-abrir").onclick = () => {

            $("camera-painel").hidden =
                !$("camera-painel").hidden;

            atualizarDiagnostico();

        };

        $("camera-fechar").onclick = () => {

            $("camera-painel").hidden = true;

        };

        $("camera-trocar").onclick =
            trocarCamera;

        $("camera-foco").onclick =
            ativarFoco;

        $("camera-exposicao-auto").onclick =
            ativarExposicao;

        $("camera-atualizar").onclick =
            atualizarDiagnostico;

        document.addEventListener(

            "pointerdown",

            focarNoPonto

        );

        scene.addEventListener("arReady", () => {

            iniciarPainel(scene).catch(erro => {

                console.warn(
                    "Diagnóstico indisponível.",
                    erro
                );

            });

        });

        $("marcador").addEventListener(

            "targetFound",

            () => {

                alvoEncontrado = true;

                atualizarDiagnostico();

            }

        );

        $("marcador").addEventListener(

            "targetLost",

            () => {

                alvoEncontrado = false;

                atualizarDiagnostico();

            }

        );

    });

})();
