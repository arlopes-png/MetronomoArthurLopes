document.addEventListener('DOMContentLoaded', () => {
    const pendulo = document.getElementById('pendulo');
    const peso = document.getElementById('peso');
    const bpmValor = document.getElementById('bpm-valor');
    const andamentoNome = document.getElementById('andamento-nome');
    const btnToggle = document.getElementById('btn-toggle');
    const btnMenos = document.getElementById('btn-menos');
    const btnMais = document.getElementById('btn-mais');
    const selectCompasso = document.getElementById('compasso');
    const ledBatida = document.getElementById('led-batida');

    const MIN_BPM = 40;
    const MAX_BPM = 208;
    const MIN_TOP = 10;
    const MAX_TOP = 200;
    const ANGULO_MAX = 28;

    let bpm = 120;
    let tocando = false;
    let arrastando = false;
    let batidaAtual = 0;
    let ultimoTempo = 0;
    let fase = 0;
    let direcaoAnterior = 1;
    let animacaoId = null;

    let audioCtx = null;

    atualizarPosicaoPorBpm(bpm);

    // AJUSTE PRECISO (-1 / +1 BPM) 
    btnMenos.addEventListener('click', () => alterarBpm(-1));
    btnMais.addEventListener('click', () => alterarBpm(1));

    window.addEventListener('keydown', (e) => {
        if (e.key === 'ArrowUp' || e.key === 'ArrowRight') {
            alterarBpm(1);
        } else if (e.key === 'ArrowDown' || e.key === 'ArrowLeft') {
            alterarBpm(-1);
        }
    });

    function alterarBpm(delta) {
        const novoBpm = Math.min(MAX_BPM, Math.max(MIN_BPM, bpm + delta));
        if (novoBpm !== bpm) {
            bpm = novoBpm;
            atualizarPosicaoPorBpm(bpm);
        }
    }

    // EVENTOS DE ARRASTE DO PESO ---
    peso.addEventListener('mousedown', iniciarArraste);
    window.addEventListener('mousemove', moverPeso);
    window.addEventListener('mouseup', pararArraste);

    peso.addEventListener('touchstart', (e) => iniciarArraste(e.touches[0]), { passive: false });
    window.addEventListener('touchmove', (e) => {
        if (arrastando) {
            e.preventDefault();
            moverPeso(e.touches[0]);
        }
    }, { passive: false });
    window.addEventListener('touchend', pararArraste);

    function iniciarArraste(e) {
        arrastando = true;
    }

    function moverPeso(e) {
        if (!arrastando) return;

        const rectPendulo = pendulo.getBoundingClientRect();
        let novaPosicaoY = e.clientY - rectPendulo.top - (peso.offsetHeight / 2);

        if (novaPosicaoY < MIN_TOP) novaPosicaoY = MIN_TOP;
        if (novaPosicaoY > MAX_TOP) novaPosicaoY = MAX_TOP;

        peso.style.top = `${novaPosicaoY}px`;

        const proporcao = (novaPosicaoY - MIN_TOP) / (MAX_TOP - MIN_TOP);
        bpm = Math.round(MIN_BPM + proporcao * (MAX_BPM - MIN_BPM));

        atualizarInterfaceTexto(bpm);
    }

    function pararArraste() {
        arrastando = false;
    }

    function atualizarPosicaoPorBpm(valorBpm) {
        const proporcao = (valorBpm - MIN_BPM) / (MAX_BPM - MIN_BPM);
        const posY = MIN_TOP + proporcao * (MAX_TOP - MIN_TOP);
        peso.style.top = `${posY}px`;
        atualizarInterfaceTexto(valorBpm);
    }

    function atualizarInterfaceTexto(valorBpm) {
        bpmValor.textContent = valorBpm;
        andamentoNome.textContent = obterNomeAndamento(valorBpm);
    }

    function obterNomeAndamento(valor) {
        if (valor < 60) return 'Largo';
        if (valor < 66) return 'Larghetto';
        if (valor < 76) return 'Adagio';
        if (valor < 108) return 'Andante';
        if (valor < 120) return 'Moderato';
        if (valor < 156) return 'Allegro';
        if (valor < 176) return 'Vivace';
        if (valor < 200) return 'Presto';
        return 'Prestissimo';
    }

    // --- inicio ---
    btnToggle.addEventListener('click', () => {
        if (!audioCtx) {
            audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        }
        if (audioCtx.state === 'suspended') {
            audioCtx.resume();
        }

        tocando = !tocando;

        if (tocando) {
            btnToggle.textContent = 'Parar';
            btnToggle.classList.add('rodando');
            batidaAtual = 0;
            fase = 0;
            direcaoAnterior = 1;
            ultimoTempo = performance.now();
            tocarSom(true);
            loopAnimacao(ultimoTempo);
        } else {
            btnToggle.textContent = 'Iniciar';
            btnToggle.classList.remove('rodando');
            cancelAnimationFrame(animacaoId);
            pendulo.style.transform = 'rotate(0deg)';
            ledBatida.className = 'led';
        }
    });

    // --- SÍNTESE DE SOM ---
    function tocarSom(ehAcento) {
        if (!audioCtx) return;

        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();

        osc.type = 'triangle';
        osc.frequency.setValueAtTime(ehAcento ? 1200 : 800, audioCtx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(100, audioCtx.currentTime + 0.04);

        gain.gain.setValueAtTime(0.8, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.04);

        osc.connect(gain);
        gain.connect(audioCtx.destination);

        osc.start();
        osc.stop(audioCtx.currentTime + 0.045);

        ledBatida.className = ehAcento ? 'led acento' : 'led ativo';
        setTimeout(() => {
            if (tocando) ledBatida.className = 'led';
        }, 100);
    }

    // --- LOOPIIINNNNNNNNNNNNNNNNNNNN---
    function loopAnimacao(tempoAtual) {
        if (!tocando) return;

        const deltaSegundos = (tempoAtual - ultimoTempo) / 1000;
        ultimoTempo = tempoAtual;

        const batidasPorSegundo = bpm / 60;
        fase += deltaSegundos * batidasPorSegundo * Math.PI;

        const angulo = Math.sin(fase) * ANGULO_MAX;
        pendulo.style.transform = `rotate(${angulo}deg)`;

        const direcaoAtual = Math.cos(fase) >= 0 ? 1 : -1;

        if (direcaoAtual !== direcaoAnterior) {
            direcaoAnterior = direcaoAtual;
            batidaAtual++;

            const compasso = parseInt(selectCompasso.value, 10);
            const ehAcento = compasso > 0 && (batidaAtual % compasso === 0);
            tocarSom(ehAcento);
        }

        animacaoId = requestAnimationFrame(loopAnimacao);
    }
});