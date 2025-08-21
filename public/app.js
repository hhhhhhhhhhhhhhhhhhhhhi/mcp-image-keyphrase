const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
const colorInput = document.getElementById('color');
const sizeInput = document.getElementById('size');
const brushBtn = document.getElementById('brush');
const bucketBtn = document.getElementById('bucket');
const clearBtn = document.getElementById('clear');
const saveBtn = document.getElementById('save');

let currentColor = colorInput.value;
let brushSize = Number(sizeInput.value);
let drawing = false;
let tool = 'brush';

function setActive(btn) {
  document.querySelectorAll('.tool').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
}

brushBtn.addEventListener('click', () => {
  tool = 'brush';
  setActive(brushBtn);
});

bucketBtn.addEventListener('click', () => {
  tool = 'bucket';
  setActive(bucketBtn);
});

colorInput.addEventListener('input', e => {
  currentColor = e.target.value;
});

sizeInput.addEventListener('input', e => {
  brushSize = Number(e.target.value);
});

canvas.addEventListener('mousedown', e => {
  const { x, y } = getCanvasPos(e);
  if (tool === 'brush') {
    drawing = true;
    ctx.strokeStyle = currentColor;
    ctx.lineWidth = brushSize;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(x, y);
  } else if (tool === 'bucket') {
    floodFill(x, y, hexToRgb(currentColor));
  }
});

canvas.addEventListener('mousemove', e => {
  if (!drawing) return;
  const { x, y } = getCanvasPos(e);
  ctx.lineTo(x, y);
  ctx.stroke();
});

canvas.addEventListener('mouseup', () => {
  drawing = false;
});

canvas.addEventListener('mouseleave', () => {
  drawing = false;
});

clearBtn.addEventListener('click', () => {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  drawOutline();
});

saveBtn.addEventListener('click', () => {
  const link = document.createElement('a');
  link.download = 'coloring.png';
  link.href = canvas.toDataURL('image/png');
  link.click();
});

function getCanvasPos(e) {
  const rect = canvas.getBoundingClientRect();
  return { x: e.clientX - rect.left, y: e.clientY - rect.top };
}

function hexToRgb(hex) {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return m ? { r: parseInt(m[1], 16), g: parseInt(m[2], 16), b: parseInt(m[3], 16) } : { r: 0, g: 0, b: 0 };
}

function floodFill(startX, startY, fillColor) {
  const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = imgData.data;
  const width = imgData.width;
  const height = imgData.height;

  const stack = [[Math.floor(startX), Math.floor(startY)]];
  const target = getPixel(startX, startY);

  if (colorsMatch(target, fillColor)) return;

  while (stack.length) {
    const [x, y] = stack.pop();
    const current = getPixel(x, y);
    if (!colorsMatch(current, target)) continue;
    setPixel(x, y, fillColor);
    if (x > 0) stack.push([x - 1, y]);
    if (x < width - 1) stack.push([x + 1, y]);
    if (y > 0) stack.push([x, y - 1]);
    if (y < height - 1) stack.push([x, y + 1]);
  }

  ctx.putImageData(imgData, 0, 0);

  function getPixel(x, y) {
    const idx = (y * width + x) * 4;
    return { r: data[idx], g: data[idx + 1], b: data[idx + 2], a: data[idx + 3] };
  }

  function setPixel(x, y, color) {
    const idx = (y * width + x) * 4;
    data[idx] = color.r;
    data[idx + 1] = color.g;
    data[idx + 2] = color.b;
    data[idx + 3] = 255;
  }

  function colorsMatch(a, b) {
    return a.r === b.r && a.g === b.g && a.b === b.b;
  }
}

function drawOutline() {
  ctx.lineWidth = 3;
  ctx.strokeStyle = '#000';
  ctx.strokeRect(50, 50, 200, 150);
  ctx.beginPath();
  ctx.arc(400, 150, 75, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(550, 200);
  ctx.lineTo(750, 200);
  ctx.lineTo(650, 50);
  ctx.closePath();
  ctx.stroke();
}

drawOutline();
