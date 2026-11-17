'use strict';

const tarotMotion = matchMedia('(prefers-reduced-motion: reduce)');
const tarotPalettes = {
  rose: ['#ffbdf2', '#ff5e96', '#ffd470', '#ff9162', '#c194ff', '#fff6d9'],
  gold: ['#ffdc73', '#fff2a0', '#ff9e47', '#f69aed', '#ffa698', '#fff8e4'],
  sage: ['#b5ffaf', '#57f6cd', '#ffdd70', '#a7adff', '#ffa8d8', '#fff8d8']
};
// The burst positions and times drive both the canvas and the stereo crackle.
const tarotSalvos = [
  {x:.5, y:.47, delay:0, spread:1.26, count:124, strength:1},
  {x:.19, y:.25, delay:80, spread:.71, count:64, strength:.66},
  {x:.82, y:.32, delay:154, spread:.74, count:68, strength:.75},
  {x:.11, y:.67, delay:238, spread:.66, count:62, strength:.61},
  {x:.88, y:.65, delay:315, spread:.78, count:72, strength:.81},
  {x:.48, y:.13, delay:407, spread:.72, count:68, strength:.64},
  {x:.33, y:.78, delay:495, spread:.67, count:60, strength:.55},
  {x:.71, y:.78, delay:577, spread:.73, count:72, strength:.63},
  {x:.5, y:.42, delay:664, spread:1, count:96, strength:.85}
];

function tarotFace(card) {
  const face = document.createElement('span');
  face.className = 'tarot-face';
  face.setAttribute('aria-hidden', 'true');
  const symbol = document.createElement('span');
  symbol.className = 'tarot-fallback';
  symbol.textContent = card.symbol;
  const image = document.createElement('img');
  image.alt = '';
  image.decoding = 'async';
  image.addEventListener('error', () => { image.hidden = true; }, {once:true});
  const file = String(TAEYANG_DECK.indexOf(card)).padStart(2, '0');
  image.src = './assets/arcana/m' + file + '.webp';
  face.append(symbol, image);
  return face;
}

function tarotBack(color) {
  const back = document.querySelector('.deck-choice[data-color="' + color + '"] .card-back').cloneNode(true);
  back.classList.add('tarot-back');
  return back;
}

function tarotFireworks(layer, color, width, height, signal) {
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');
  if (!context || signal.aborted) return;
  const ratio = Math.min(devicePixelRatio || 1, 1.6, Math.sqrt(2600000 / (width * height)));
  canvas.className = 'tarot-fireworks';
  canvas.width = Math.round(width * ratio);
  canvas.height = Math.round(height * ratio);
  context.scale(ratio, ratio);
  layer.prepend(canvas);

  const radius = Math.min(Math.hypot(width, height) * .43, 650);
  const density = width < 600 ? .70 : .93;
  const colors = tarotPalettes[color];
  const salvos = tarotSalvos.map((salvo, i) => {
    const x = salvo.x * width;
    const y = salvo.y * height;
    const spread = salvo.spread * radius;
    const glow = context.createRadialGradient(x, y, 0, x, y, spread * .37);
    const tint = colors[i % colors.length];
    glow.addColorStop(0, '#fff3d4bf');
    glow.addColorStop(.24, tint + '5e');
    glow.addColorStop(1, tint + '00');
    return {...salvo, x, y, spread, glow, tint, count:Math.round(salvo.count * density)};
  });
  const sparks = salvos.flatMap(salvo => Array.from({length:salvo.count}, (_, i) => {
    const angle = (i + Math.random() * .8) * Math.PI * 2 / salvo.count;
    const distance = salvo.spread * (.22 + Math.random() ** .75 * .9);
    return {
      x:salvo.x, y:salvo.y, delay:salvo.delay, life:610 + Math.random() * 590,
      dx:Math.cos(angle) * distance, dy:Math.sin(angle) * distance,
      size:1.15 + Math.random() * 2.8, tint:colors[i % colors.length], kind:i % 8, phase:Math.random() * 6.28
    };
  }));
  const started = performance.now();
  let frame;

  function remove() {
    cancelAnimationFrame(frame);
    canvas.remove();
    signal.removeEventListener('abort', remove);
  }

  function draw(now) {
    const elapsed = now - started;
    context.clearRect(0, 0, width, height);
    context.globalCompositeOperation = 'lighter';
    context.lineCap = 'round';
    for (const salvo of salvos) {
      const progress = (elapsed - salvo.delay) / 550;
      if (progress < 0 || progress > 1) continue;
      context.globalAlpha = Math.min(progress * 7, 1) * (1 - progress) ** 2 * .88;
      context.fillStyle = salvo.glow;
      context.fillRect(salvo.x - salvo.spread / 2, salvo.y - salvo.spread / 2, salvo.spread, salvo.spread);
      const ring = salvo.spread * (.032 + (1 - (1 - progress) ** 2) * .57);
      context.globalAlpha = (1 - progress) ** 2 * .77;
      context.lineWidth = 2.4;
      context.strokeStyle = salvo.tint;
      context.beginPath();
      context.arc(salvo.x, salvo.y, ring, 0, Math.PI * 2);
      context.stroke();
    }
    for (const spark of sparks) {
      const progress = (elapsed - spark.delay) / spark.life;
      if (progress < 0 || progress > 1) continue;
      const travel = 1 - (1 - progress) ** 2.7;
      const px = spark.x + spark.dx * travel;
      const py = spark.y + spark.dy * travel + 88 * progress ** 2;
      if (px < -30 || py < -30 || px > width + 30 || py > height + 30) continue;
      const trail = .25 * (1 - progress) ** 1.4 + .015;
      context.globalAlpha = (1 - progress) ** .72 * .75;
      context.strokeStyle = spark.tint;
      context.lineWidth = spark.size * .88;
      context.beginPath();
      context.moveTo(px - spark.dx * trail, py - spark.dy * trail);
      context.lineTo(px, py);
      context.stroke();
      context.globalAlpha *= .68 + Math.cos(spark.phase + progress * 29) * .32;
      context.fillStyle = spark.tint;
      if (spark.kind === 0) {
        context.beginPath();
        context.moveTo(px, py - spark.size * 2.8);
        context.lineTo(px + spark.size * .7, py - spark.size * .7);
        context.lineTo(px + spark.size * 2.8, py);
        context.lineTo(px + spark.size * .7, py + spark.size * .7);
        context.lineTo(px, py + spark.size * 2.8);
        context.lineTo(px - spark.size * .7, py + spark.size * .7);
        context.lineTo(px - spark.size * 2.8, py);
        context.lineTo(px - spark.size * .7, py - spark.size * .7);
        context.fill();
      } else if (spark.kind === 1) {
        context.beginPath();
        context.ellipse(px, py, spark.size * 1.4, spark.size * .59, spark.phase + progress * 7, 0, Math.PI * 2);
        context.fill();
      } else {
        context.fillRect(px - spark.size / 2, py - spark.size / 2, spark.size, spark.size);
      }
    }
    if (elapsed < 1870) frame = requestAnimationFrame(draw);
    else remove();
  }

  signal.addEventListener('abort', remove, {once:true});
  frame = requestAnimationFrame(draw);
}

async function animateTarotCard(slot, color, onReveal, signal) {
  if (signal.aborted) return;
  const rect = slot.getBoundingClientRect();
  if (tarotMotion.matches || !slot.animate || !rect.width) {
    onReveal();
    return;
  }

  const layer = document.createElement('div');
  layer.className = 'tarot-sequence';
  const veil = document.createElement('div');
  veil.className = 'tarot-veil';
  const proxy = document.createElement('div');
  proxy.className = 'tarot-proxy ' + color;
  const flip = slot.querySelector('.tarot-flip').cloneNode(true);
  proxy.append(flip);
  layer.append(veil, proxy);
  document.getElementById('reveal-fx').append(layer);

  const width = layer.clientWidth;
  const height = layer.clientHeight;
  const duration = 2110;
  const x = width / 2;
  const y = height * .47;
  const dx = x - rect.left - rect.width / 2;
  const dy = y - rect.top - rect.height / 2;
  const scale = Math.min(3.25, width * .58 / rect.width, height * .58 / rect.height);
  Object.assign(proxy.style, {
    width:rect.width + 'px', height:rect.height + 'px',
    left:rect.left + 'px', top:rect.top + 'px'
  });
  veil.style.setProperty('--burst-color', tarotPalettes[color][0]);
  veil.style.setProperty('--burst-y', y + 'px');
  const center = 'translate(' + dx + 'px,' + dy + 'px)';
  const movement = proxy.animate([
    {transform:'translate(0,0) scale(1)', offset:0, easing:'cubic-bezier(.12,.76,.2,1)'},
    {transform:center + ' scale(' + scale * 1.11 + ')', offset:.22, easing:'ease-out'},
    {transform:center + ' scale(' + scale + ')', offset:.34},
    {transform:center + ' scale(' + scale + ')', offset:.76, easing:'cubic-bezier(.5,0,.32,1)'},
    {transform:'translate(0,0) scale(1)', offset:1}
  ], {duration, fill:'both'});
  const turning = flip.animate([
    {transform:'rotateY(0deg) rotate(-6deg)'},
    {transform:'rotateY(180deg) rotate(0deg)'}
  ], {duration:475, easing:'cubic-bezier(.41,.08,.18,1)', fill:'both'});
  const dim = veil.animate([
    {opacity:0}, {opacity:1, offset:.15}, {opacity:1, offset:.78}, {opacity:0}
  ], {duration, fill:'both'});
  slot.classList.add('in-flight');
  const burst = setTimeout(() => {
    onReveal();
    tarotFireworks(layer, color, width, height, signal);
  }, 220);
  const cancel = () => {
    clearTimeout(burst);
    movement.cancel();
    turning.cancel();
    dim.cancel();
  };
  signal.addEventListener('abort', cancel, {once:true});
  try {
    await Promise.allSettled([movement.finished, turning.finished, dim.finished]);
  } finally {
    clearTimeout(burst);
    signal.removeEventListener('abort', cancel);
    slot.classList.remove('in-flight');
    layer.remove();
  }
}

const TarotAudioContext = window.AudioContext || window.webkitAudioContext;
let tarotAudio;
let tarotCrackle;
let activeTarotSound;
function prepareTarotAudio() {
  if (!TarotAudioContext) return false;
  try {
    tarotAudio ??= new TarotAudioContext();
    if (tarotAudio.state !== 'running') tarotAudio.resume().catch(() => {});
    if (!tarotCrackle) {
      tarotCrackle = tarotAudio.createBuffer(1, Math.ceil(tarotAudio.sampleRate * .29), tarotAudio.sampleRate);
      const noise = tarotCrackle.getChannelData(0);
      let smoothed = 0;
      for (let i = 0; i < noise.length; i++) {
        const white = Math.random() * 2 - 1;
        smoothed = .66 * smoothed + .34 * white;
        noise[i] = .57 * white + .43 * smoothed;
      }
    }
    return true;
  } catch {
    return false;
  }
}

function stopTarotFireworkSound() {
  activeTarotSound?.();
}

function playTarotFireworkSound(signal) {
  if (!tarotAudio || !tarotCrackle || tarotAudio.state === 'closed' || signal.aborted) return;
  stopTarotFireworkSound();
  const audio = tarotAudio;
  const limiter = audio.createDynamicsCompressor();
  limiter.threshold.value = -15;
  limiter.ratio.value = 8;
  limiter.attack.value = .002;
  const mix = audio.createGain();
  mix.gain.value = .57;
  limiter.connect(mix).connect(audio.destination);
  const time = audio.currentTime + .008;
  for (const [i, salvo] of tarotSalvos.entries()) {
    const start = time + salvo.delay / 1000;
    const crack = audio.createBufferSource();
    crack.buffer = tarotCrackle;
    crack.playbackRate.value = .92 + (i % 4) * .12;
    const filter = audio.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.setValueAtTime(1520 + (i % 3) * 450, start);
    filter.frequency.exponentialRampToValueAtTime(290, start + .13);
    const snap = audio.createGain();
    snap.gain.setValueAtTime(.001, start);
    snap.gain.linearRampToValueAtTime(salvo.strength * .98, start + .002);
    snap.gain.exponentialRampToValueAtTime(salvo.strength * .075, start + .026);
    snap.gain.exponentialRampToValueAtTime(.001, start + .22);
    crack.connect(filter).connect(snap);
    if (audio.createStereoPanner) {
      const pan = audio.createStereoPanner();
      pan.pan.value = (salvo.x - .5) * 1.4;
      snap.connect(pan).connect(limiter);
    } else {
      snap.connect(limiter);
    }
    crack.start(start);
    crack.stop(start + .24);

    const thump = audio.createOscillator();
    thump.type = i % 3 === 0 ? 'triangle' : 'sine';
    thump.frequency.setValueAtTime(151 + (i % 4) * 23, start);
    thump.frequency.exponentialRampToValueAtTime(43, start + .16);
    const bass = audio.createGain();
    bass.gain.setValueAtTime(.001, start);
    bass.gain.linearRampToValueAtTime(salvo.strength * .33, start + .009);
    bass.gain.exponentialRampToValueAtTime(.001, start + .16);
    thump.connect(bass).connect(limiter);
    thump.start(start);
    thump.stop(start + .17);
  }
  const stop = () => {
    clearTimeout(cleanup);
    signal.removeEventListener('abort', stop);
    mix.gain.setTargetAtTime(0, audio.currentTime, .01);
    setTimeout(() => mix.disconnect(), 65);
    activeTarotSound = null;
  };
  activeTarotSound = stop;
  const cleanup = setTimeout(stop, 1100);
  signal.addEventListener('abort', stop, {once:true});
}
