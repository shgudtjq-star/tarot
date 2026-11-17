'use strict';

const byId = id => document.getElementById(id);
const canonical = document.querySelector('link[rel="canonical"]').href;
const modes = byId('modes');
const topics = byId('topics');
const deckChoices = [...document.querySelectorAll('.deck-choice')];
const stage = byId('reveal-stage');
const stageCards = byId('reveal-cards');
const showReading = byId('show-reading');
const revealSound = byId('reveal-sound');
const result = byId('result');
const resultCards = byId('result-cards');
const storyDialog = byId('story-dialog');
const storyImage = byId('story-image');
const storyShare = byId('story-share');
const saveStory = byId('save-story');
const reviewForm = byId('review-form');
const reviewSubmit = reviewForm.querySelector('button[type="submit"]');
const datePrinter = new Intl.DateTimeFormat('ko-KR', {month:'long', day:'numeric', weekday:'long', timeZone:'Asia/Seoul'});
const positionLabels = ['지금의 흐름','놓치기 쉬운 점','다음 한 걸음'];
const colorLabels = {rose:'로즈', gold:'골드', sage:'세이지'};

let mode = 'three';
let topic = 'today';
let activeDate = dateInSeoul();
let reading = null;
let draw = null;
let soundOn = false;
let storyFile = null;
let storyUrl = '';
let toastTimer;

function tell(message) {
  const toast = byId('toast');
  toast.textContent = message;
  toast.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { toast.hidden = true; }, 3700);
}

function clearReading() {
  draw?.controller.abort();
  draw = null;
  reading = null;
  stage.hidden = true;
  stageCards.replaceChildren();
  result.hidden = true;
  deckChoices.forEach(button => button.setAttribute('aria-pressed', 'false'));
}

function updateDate() {
  const now = new Date();
  const stamp = dateInSeoul(now);
  if (stamp !== activeDate) clearReading();
  activeDate = stamp;
  byId('reading-date').textContent = datePrinter.format(now);
}

function pressed(group, dataKey, value) {
  group.querySelectorAll('button').forEach(button => {
    button.setAttribute('aria-pressed', String(button.dataset[dataKey] === value));
  });
}

for (const [key,[label]] of Object.entries(TAEYANG_TOPICS)) {
  const button = document.createElement('button');
  button.type = 'button';
  button.dataset.topic = key;
  button.textContent = label;
  button.setAttribute('aria-pressed', String(key === topic));
  topics.append(button);
}

modes.addEventListener('click', event => {
  const button = event.target.closest('[data-mode]');
  if (!button || button.dataset.mode === mode) return;
  mode = button.dataset.mode;
  pressed(modes, 'mode', mode);
  byId('deck-note').textContent = mode === 'one' ? '마음이 끌리는 색을 골라 한 장을 펼쳐 보세요.' : '마음이 끌리는 색을 골라 세 장을 펼쳐 보세요.';
  clearReading();
});
topics.addEventListener('click', event => {
  const button = event.target.closest('[data-topic]');
  if (!button || button.dataset.topic === topic) return;
  topic = button.dataset.topic;
  pressed(topics, 'topic', topic);
  clearReading();
});

function cardElement(card, position, message) {
  const row = document.createElement('article');
  row.className = 'reading-card';
  const art = tarotFace(card);
  art.classList.add('reading-art');

  const copy = document.createElement('div');
  const label = document.createElement('p');
  const title = document.createElement('h4');
  const interpretation = document.createElement('p');
  label.className = 'card-position';
  label.textContent = position;
  title.textContent = card.name;
  interpretation.textContent = message;
  copy.append(label, title, interpretation);
  row.append(art, copy);
  return row;
}

function drawSlot(card, position, session) {
  const item = document.createElement('div');
  item.className = 'tarot-slot';
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'tarot-slot-button ' + session.color;
  button.setAttribute('aria-label', position + ' 카드 뒤집기');
  const flip = document.createElement('span');
  flip.className = 'tarot-flip';
  flip.append(tarotBack(session.color), tarotFace(card));
  button.append(flip);
  const label = document.createElement('span');
  label.className = 'tarot-slot-label';
  label.textContent = position;
  const name = document.createElement('strong');
  name.className = 'tarot-slot-name';
  name.textContent = '뒤집기';
  name.setAttribute('aria-hidden', 'true');
  item.append(button, label, name);
  button.addEventListener('click', async () => {
    if (draw !== session || session.busy || button.hasAttribute('aria-disabled')) return;
    session.busy = true;
    if (soundOn) prepareTarotAudio();
    let chimePlayed = false;
    function turnOver() {
      button.classList.add('is-open');
      if (soundOn && !chimePlayed) {
        chimePlayed = true;
        playTarotChime();
      }
    }
    await animateTarotCard(button, session.color, turnOver, session.controller.signal).catch(() => {});
    if (draw !== session) return;
    turnOver();
    session.busy = false;
    session.revealed += 1;
    button.setAttribute('aria-disabled', 'true');
    button.setAttribute('aria-label', position + ' 카드, ' + card.name);
    name.textContent = card.name;
    const complete = session.revealed === session.cards.length;
    byId('reveal-progress').textContent = complete
      ? '카드를 모두 열었어요. 이제 카드가 들려주는 이야기를 확인하세요.'
      : session.cards.length + '장 중 ' + session.revealed + '장을 열었어요. 다음 카드를 뒤집어 보세요.';
    showReading.hidden = !complete;
    if (document.activeElement === button) {
      const next = complete ? showReading : stageCards.querySelector('button:not([aria-disabled])');
      next?.focus({preventScroll:true});
    }
  });
  return item;
}

function startDraw(color) {
  updateDate();
  clearReading();
  const cards = cardsFor(activeDate, topic, color, mode);
  const positions = mode === 'one' ? ['오늘 만난 카드'] : positionLabels;
  const session = {cards, positions, color, revealed:0, busy:false, controller:new AbortController()};
  draw = session;
  deckChoices.forEach(button => button.setAttribute('aria-pressed', String(button.dataset.color === color)));
  byId('reveal-kicker').textContent = colorLabels[color] + ' 덱 · ' + (mode === 'one' ? '한 장 뽑기' : '세 장 뽑기');
  byId('reveal-progress').textContent = mode === 'one' ? '카드를 눌러 오늘의 메시지를 열어보세요.' : '카드를 한 장씩 눌러 흐름, 주의할 점, 다음 한 걸음을 열어보세요.';
  stageCards.classList.toggle('one-card', mode === 'one');
  stageCards.replaceChildren(...cards.map((card, i) => drawSlot(card, positions[i], session)));
  showReading.hidden = true;
  stage.hidden = false;
  stage.scrollIntoView({block:'start'});
  stageCards.querySelector('button')?.focus({preventScroll:true});
}

function showResult() {
  if (!draw || draw.revealed !== draw.cards.length) return;
  const {cards, color, positions} = draw;
  const [label, lens, practical] = TAEYANG_TOPICS[topic];
  const lastCard = cards.at(-1);
  const messages = mode === 'one'
    ? [lens + ' ' + cards[0].signal]
    : [lens + ' ' + cards[0].signal, cards[1].caution, cards[2].action];
  const action = mode === 'one' ? lastCard.action + ' ' + practical : practical;
  const focusTitle = byId('result-title');

  reading = {cards, messages, label, action, date:activeDate, color};
  byId('result-topic').textContent = label + ' · ' + colorLabels[color] + ' · ' + (mode === 'one' ? '오늘 한 장' : '세 장 리딩');
  focusTitle.textContent = lastCard.quote;
  const question = byId('question-text').value.trim();
  const questionDisplay = byId('result-question');
  questionDisplay.hidden = !question;
  questionDisplay.textContent = question ? '“' + question + '”' : '';
  byId('result-action').textContent = action;
  resultCards.replaceChildren(...cards.map((card, i) => cardElement(card, positions[i], messages[i])));
  result.hidden = false;
  focusTitle.focus({preventScroll:true});
  result.scrollIntoView({block:'start'});
}
deckChoices.forEach(button => button.addEventListener('click', () => startDraw(button.dataset.color)));
showReading.addEventListener('click', showResult);
function returnToDeck() {
  const selected = deckChoices.find(button => button.getAttribute('aria-pressed') === 'true');
  clearReading();
  if (selected) selected.focus();
}
byId('return-to-deck').addEventListener('click', returnToDeck);
byId('stage-reset').addEventListener('click', returnToDeck);
revealSound.addEventListener('click', () => {
  if (!soundOn && !prepareTarotAudio()) {
    tell('이 브라우저에서는 효과음을 재생할 수 없어요.');
    return;
  }
  soundOn = !soundOn;
  revealSound.textContent = soundOn ? '효과음 켬' : '효과음 끔';
  revealSound.setAttribute('aria-pressed', String(soundOn));
});
updateDate();
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') updateDate();
});

async function copyText(text) {
  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {}
  }
  const field = document.createElement('textarea');
  field.value = text;
  field.readOnly = true;
  field.style.cssText = 'position:fixed;left:0;top:0;opacity:0';
  const previous = document.activeElement;
  document.body.append(field);
  field.select();
  let copied = false;
  try { copied = document.execCommand('copy'); } catch {}
  field.remove();
  previous?.focus({preventScroll:true});
  return copied;
}

byId('share-site').addEventListener('click', async () => {
  if (navigator.share) {
    try {
      await navigator.share({title:'태양타로', text:'오늘 마음이 가는 카드 한 장을 골라보세요.', url:canonical});
      return;
    } catch (error) {
      if (error.name === 'AbortError') return;
    }
  }
  tell(await copyText(canonical) ? '사이트 주소를 복사했어요.' : '주소창의 사이트 주소를 복사해 주세요.');
});

function reviewContent() {
  const name = byId('review-name').value.trim();
  const message = byId('review-body').value.trim();
  return name && message ? ['[태양타로 후기]', '별명 ' + name, '', message].join('\n') : '';
}

reviewForm.addEventListener('submit', async event => {
  event.preventDefault();
  const message = reviewContent();
  byId('review-status').textContent = message
    ? (await copyText(message) ? '후기를 복사했어요.' : '자동 복사가 안 됐어요. 입력한 문장을 직접 복사해 주세요.')
    : '별명과 후기를 모두 적어주세요.';
});
byId('review-email').addEventListener('click', () => {
  if (!reviewForm.reportValidity()) return;
  const message = reviewContent();
  if (!message) {
    byId('review-status').textContent = '별명과 후기를 모두 적어주세요.';
    return;
  }
  window.location.href = 'mailto:msmh6595@nate.com?subject=' + encodeURIComponent('태양타로 후기') + '&body=' + encodeURIComponent(message);
});
reviewSubmit.disabled = false;

async function loadReviews() {
  try {
    const response = await fetch('./reviews.json', {cache:'no-cache'});
    if (!response.ok) return;
    const reviews = await response.json();
    if (!Array.isArray(reviews)) return;
    const nodes = reviews.filter(item => item && typeof item.name === 'string' && typeof item.text === 'string' && item.name.trim() && item.text.trim()).map(item => {
      const review = document.createElement('article');
      const name = document.createElement('strong');
      const body = document.createElement('p');
      name.textContent = item.name;
      body.textContent = item.text;
      review.append(name, body);
      return review;
    });
    byId('review-list').replaceChildren(...nodes);
    byId('review-empty').hidden = nodes.length > 0;
  } catch {}
}
loadReviews();

function lineText(context, text, x, y, width, lineHeight) {
  let line = '';
  for (const ch of text) {
    if (line && context.measureText(line + ch).width > width) {
      context.fillText(line.trimEnd(), x, y);
      line = ch.trimStart();
      y += lineHeight;
    } else {
      line += ch;
    }
  }
  if (line) context.fillText(line, x, y);
}

function storyCanvasModel(data) {
  const canvas = document.createElement('canvas');
  canvas.width = 1080;
  canvas.height = 1920;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('no canvas');
  const {width,height} = canvas;
  const sky = context.createLinearGradient(0, 0, width, height);
  sky.addColorStop(0, '#291a26');
  sky.addColorStop(.53, '#5a3444');
  sky.addColorStop(1, '#241925');
  context.fillStyle = sky;
  context.fillRect(0, 0, width, height);
  context.lineWidth = 3;
  context.strokeStyle = '#eac889';
  context.strokeRect(43, 47, width - 86, height - 94);

  const hero = document.querySelector('.hero-image img');
  if (hero.complete && hero.naturalWidth) {
    const cropHeight = Math.floor(hero.naturalHeight * .87);
    context.drawImage(hero, 0, (hero.naturalHeight - cropHeight) / 2, hero.naturalWidth, cropHeight, 80, 262, 920, 627);
  }
  context.fillStyle = '#efcd91';
  context.textAlign = 'center';
  context.font = 'italic 74px Georgia, serif';
  context.fillText('Taeyang Tarot', 540, 157);
  context.fillStyle = '#fff0dd';
  context.font = '42px system-ui, sans-serif';
  context.fillText(data.date.replaceAll('-', '.') + ' · ' + data.label, 540, 225);
  context.fillStyle = '#f4d397';
  context.font = '94px Georgia, serif';
  context.fillText(data.cards.at(-1).symbol, 540, 1046);
  context.fillStyle = '#fff4e7';
  context.font = '700 49px system-ui, sans-serif';
  lineText(context, data.cards.at(-1).quote, 540, 1168, 800, 74);
  context.fillStyle = '#f0d7ce';
  context.font = '38px system-ui, sans-serif';
  lineText(context, data.cards.map(card => card.name).join('  ·  '), 540, 1408, 820, 61);
  context.fillStyle = '#eed19b';
  context.font = '700 46px system-ui, sans-serif';
  context.fillText('오늘, 마음이 가는 카드', 540, 1615);
  context.fillStyle = '#fff1df';
  context.font = '34px system-ui, sans-serif';
  const shareAddress = new URL(canonical);
  context.fillText(shareAddress.hostname + shareAddress.pathname, 540, 1692);
  return canvas;
}

saveStory.addEventListener('click', () => {
  if (!reading) return;
  saveStory.disabled = true;
  try {
    storyCanvasModel(reading).toBlob(blob => {
      saveStory.disabled = false;
      if (!blob) { tell('이미지를 만들 수 없어요. 다시 눌러주세요.'); return; }
      if (storyUrl) URL.revokeObjectURL(storyUrl);
      storyUrl = URL.createObjectURL(blob);
      storyImage.src = storyUrl;
      byId('story-download').href = storyUrl;
      storyFile = typeof File === 'function' ? new File([blob], 'taeyang-tarot-story.png', {type:'image/png'}) : null;
      storyShare.hidden = !storyFile || !navigator.share || !navigator.canShare?.({files:[storyFile]});
      if (storyDialog.showModal) storyDialog.showModal();
      else storyDialog.setAttribute('open', '');
    }, 'image/png');
  } catch {
    saveStory.disabled = false;
    tell('이미지를 만들 수 없어요. 다시 눌러주세요.');
  }
});
storyShare.addEventListener('click', async () => {
  try { await navigator.share({files:[storyFile], title:'태양타로'}); }
  catch (error) { if (error.name !== 'AbortError') tell('이미지 다운로드를 이용해 주세요.'); }
});
byId('story-close').addEventListener('click', () => {
  if (storyDialog.close) storyDialog.close();
  else storyDialog.removeAttribute('open');
});

if ('speechSynthesis' in window && 'SpeechSynthesisUtterance' in window) {
  const welcomeVoice = byId('welcome-voice');
  const readingVoice = byId('reading-voice');
  const originals = new Map([[welcomeVoice, welcomeVoice.textContent], [readingVoice, readingVoice.textContent]]);
  let speakingButton;
  function say(text, button) {
    const wasSpeaking = speakingButton === button;
    const previous = speakingButton;
    if (previous) previous.textContent = originals.get(previous);
    speakingButton = null;
    speechSynthesis.cancel();
    if (wasSpeaking) return;
    const speech = new SpeechSynthesisUtterance(text);
    speech.lang = 'ko-KR';
    speech.rate = .93;
    const voices = speechSynthesis.getVoices().filter(voice => voice.lang.toLowerCase().startsWith('ko'));
    speech.voice = voices.find(voice => /Yuna|Heami|SunHi|선희/i.test(voice.name)) || voices[0] || null;
    speakingButton = button;
    button.textContent = '■ 듣기 멈추기';
    speech.onend = speech.onerror = () => {
      if (speakingButton !== button) return;
      speakingButton = null;
      button.textContent = originals.get(button);
    };
    speechSynthesis.speak(speech);
  }
  welcomeVoice.hidden = false;
  readingVoice.hidden = false;
  welcomeVoice.addEventListener('click', () => say('안녕하세요, 태양타로예요. 리딩 방식과 마음에 걸리는 주제를 골라보세요. 끌리는 색을 고른 다음, 카드를 한 장씩 뒤집어 오늘의 이야기를 만나보세요.', welcomeVoice));
  readingVoice.addEventListener('click', () => {
    if (reading) say([reading.label, ...reading.messages, '오늘 해볼 한 가지.', reading.action].join(' '), readingVoice);
  });
}
