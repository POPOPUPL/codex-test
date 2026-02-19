const startBtn = document.getElementById('startBtn');
const stopBtn = document.getElementById('stopBtn');
const downloadLink = document.getElementById('downloadLink');
const screenVideo = document.getElementById('screenVideo');
const avatarVideo = document.getElementById('avatarVideo');
const avatarBox = document.getElementById('avatarBox');
const avatarShape = document.getElementById('avatarShape');
const avatarSize = document.getElementById('avatarSize');
const resolution = document.getElementById('resolution');
const sysAudio = document.getElementById('sysAudio');
const micAudio = document.getElementById('micAudio');
const whiteboardToggle = document.getElementById('whiteboardToggle');
const whiteboard = document.getElementById('whiteboard');
const whiteboardTools = document.getElementById('whiteboardTools');
const penColor = document.getElementById('penColor');
const penWidth = document.getElementById('penWidth');
const clearBoard = document.getElementById('clearBoard');

let screenStream;
let micStream;
let avatarStream;
let recorder;
let mixedStream;
let drawTimer;
let chunks = [];

const boardCtx = whiteboard.getContext('2d');
let drawing = false;
let lastPoint = null;

function updateAvatarShape() {
  avatarBox.classList.toggle('circle', avatarShape.value === 'circle');
  avatarBox.classList.toggle('ellipse', avatarShape.value === 'ellipse');
}

function updateAvatarSize() {
  const size = `${avatarSize.value}px`;
  avatarBox.style.width = size;
  avatarBox.style.height = size;
}

function initDraggableAvatar() {
  let dragging = false;
  let offsetX = 0;
  let offsetY = 0;

  avatarBox.addEventListener('pointerdown', (event) => {
    dragging = true;
    offsetX = event.clientX - avatarBox.offsetLeft;
    offsetY = event.clientY - avatarBox.offsetTop;
    avatarBox.setPointerCapture(event.pointerId);
  });

  avatarBox.addEventListener('pointermove', (event) => {
    if (!dragging) return;
    const stage = document.getElementById('stage');
    const maxX = stage.clientWidth - avatarBox.clientWidth;
    const maxY = stage.clientHeight - avatarBox.clientHeight;
    const left = Math.max(0, Math.min(maxX, event.clientX - offsetX));
    const top = Math.max(0, Math.min(maxY, event.clientY - offsetY));
    avatarBox.style.left = `${left}px`;
    avatarBox.style.top = `${top}px`;
  });

  avatarBox.addEventListener('pointerup', (event) => {
    dragging = false;
    avatarBox.releasePointerCapture(event.pointerId);
  });
}

function resizeBoardToStage() {
  const stage = document.getElementById('stage');
  whiteboard.width = stage.clientWidth;
  whiteboard.height = stage.clientHeight;
}

function boardPos(event) {
  const rect = whiteboard.getBoundingClientRect();
  return { x: event.clientX - rect.left, y: event.clientY - rect.top };
}

function initWhiteboard() {
  resizeBoardToStage();
  window.addEventListener('resize', resizeBoardToStage);

  whiteboard.addEventListener('pointerdown', (event) => {
    drawing = true;
    lastPoint = boardPos(event);
  });

  whiteboard.addEventListener('pointermove', (event) => {
    if (!drawing) return;
    const point = boardPos(event);
    boardCtx.strokeStyle = penColor.value;
    boardCtx.lineWidth = Number(penWidth.value);
    boardCtx.lineCap = 'round';
    boardCtx.beginPath();
    boardCtx.moveTo(lastPoint.x, lastPoint.y);
    boardCtx.lineTo(point.x, point.y);
    boardCtx.stroke();
    lastPoint = point;
  });

  ['pointerup', 'pointerleave'].forEach((name) => {
    whiteboard.addEventListener(name, () => {
      drawing = false;
      lastPoint = null;
    });
  });

  clearBoard.addEventListener('click', () => {
    boardCtx.clearRect(0, 0, whiteboard.width, whiteboard.height);
  });

  whiteboardToggle.addEventListener('change', () => {
    whiteboard.classList.toggle('hidden', !whiteboardToggle.checked);
    whiteboardTools.classList.toggle('hidden', !whiteboardToggle.checked);
  });
}

async function startCapture() {
  chunks = [];
  downloadLink.classList.add('hidden');

  const displayConstraints = {
    video: true,
    audio: sysAudio.checked
  };

  screenStream = await navigator.mediaDevices.getDisplayMedia(displayConstraints);
  screenVideo.srcObject = screenStream;

  if (micAudio.checked) {
    micStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
  }

  avatarStream = await navigator.mediaDevices.getUserMedia({
    video: { width: 640, height: 360, facingMode: 'user' },
    audio: false
  });
  avatarVideo.srcObject = avatarStream;

  resizeBoardToStage();

  const stage = document.getElementById('stage');
  const compose = document.createElement('canvas');
  const scale = Number(resolution.value);
  compose.width = Math.floor(stage.clientWidth * scale);
  compose.height = Math.floor(stage.clientHeight * scale);
  const ctx = compose.getContext('2d');

  drawTimer = setInterval(() => {
    ctx.clearRect(0, 0, compose.width, compose.height);
    ctx.drawImage(screenVideo, 0, 0, compose.width, compose.height);

    if (whiteboardToggle.checked) {
      ctx.drawImage(whiteboard, 0, 0, compose.width, compose.height);
    }

    const stageRect = stage.getBoundingClientRect();
    const avatarRect = avatarBox.getBoundingClientRect();

    const ax = ((avatarRect.left - stageRect.left) / stageRect.width) * compose.width;
    const ay = ((avatarRect.top - stageRect.top) / stageRect.height) * compose.height;
    const aw = (avatarRect.width / stageRect.width) * compose.width;
    const ah = (avatarRect.height / stageRect.height) * compose.height;

    ctx.save();
    ctx.beginPath();
    if (avatarShape.value === 'circle') {
      const radius = Math.min(aw, ah) / 2;
      ctx.arc(ax + aw / 2, ay + ah / 2, radius, 0, Math.PI * 2);
    } else {
      ctx.ellipse(ax + aw / 2, ay + ah / 2, aw / 2, ah / 2, 0, 0, Math.PI * 2);
    }
    ctx.closePath();
    ctx.clip();
    ctx.drawImage(avatarVideo, ax, ay, aw, ah);
    ctx.restore();
  }, 33);

  const videoTrack = compose.captureStream(30).getVideoTracks()[0];
  const audioContext = new AudioContext();
  const destination = audioContext.createMediaStreamDestination();

  if (sysAudio.checked) {
    const sysTrack = screenStream.getAudioTracks()[0];
    if (sysTrack) {
      const source = audioContext.createMediaStreamSource(new MediaStream([sysTrack]));
      source.connect(destination);
    }
  }

  if (micAudio.checked && micStream) {
    const micTrack = micStream.getAudioTracks()[0];
    if (micTrack) {
      const source = audioContext.createMediaStreamSource(new MediaStream([micTrack]));
      source.connect(destination);
    }
  }

  mixedStream = new MediaStream([videoTrack, ...destination.stream.getAudioTracks()]);
  recorder = new MediaRecorder(mixedStream, { mimeType: 'video/webm;codecs=vp9,opus' });

  recorder.ondataavailable = (event) => {
    if (event.data.size > 0) chunks.push(event.data);
  };

  recorder.onstop = () => {
    const blob = new Blob(chunks, { type: 'video/webm' });
    const url = URL.createObjectURL(blob);
    downloadLink.href = url;
    downloadLink.classList.remove('hidden');
    clearInterval(drawTimer);
  };

  recorder.start(1000);
  startBtn.disabled = true;
  stopBtn.disabled = false;
}

function stopCapture() {
  stopBtn.disabled = true;
  startBtn.disabled = false;

  recorder?.stop();
  [screenStream, micStream, avatarStream, mixedStream].forEach((stream) => {
    stream?.getTracks().forEach((track) => track.stop());
  });

  screenVideo.srcObject = null;
  avatarVideo.srcObject = null;
}

startBtn.addEventListener('click', async () => {
  try {
    await startCapture();
  } catch (error) {
    console.error(error);
    alert(`启动录制失败：${error.message}`);
  }
});

stopBtn.addEventListener('click', stopCapture);
avatarShape.addEventListener('change', updateAvatarShape);
avatarSize.addEventListener('input', updateAvatarSize);

initDraggableAvatar();
initWhiteboard();
updateAvatarShape();
updateAvatarSize();
