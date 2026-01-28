const imageInput = document.getElementById('imageInput');
const generateBtn = document.getElementById('generateBtn');
const downloadBtn = document.getElementById('downloadImgBtn');
const preview = document.getElementById('preview');
const qrContainer = document.getElementById('qrcode');

let currentDataURL = null;

function resizeImageFile(file, maxWidth = 600) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        let w = img.width;
        let h = img.height;
        if (w > maxWidth) {
          const ratio = maxWidth / w;
          w = maxWidth;
          h = Math.round(h * ratio);
        }
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, w, h);
        const dataURL = canvas.toDataURL('image/png', 0.9);
        resolve(dataURL);
      };
      img.onerror = reject;
      img.src = e.target.result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

imageInput.addEventListener('change', async (e) => {
  const file = e.target.files && e.target.files[0];
  if (!file) {
    preview.textContent = 'No image selected';
    currentDataURL = null;
    return;
  }
  try {
    // create a reasonably sized preview/dataURL
    const small = await resizeImageFile(file, 600);
    preview.innerHTML = `<img src="${small}" alt="preview" />`;
    currentDataURL = small;
  } catch (err) {
    console.error(err);
    preview.textContent = 'Failed to read image';
    currentDataURL = null;
  }
});

async function ensureSmallDataURL(dataURL) {
  // Many QR scanners have limits. Try progressively smaller widths to reduce payload.
  if (!dataURL) return null;
  if (dataURL.length <= 2000) return dataURL;
  const blob = await (await fetch(dataURL)).blob();
  for (const w of [400, 300, 250, 200]) {
    const scaled = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          const ratio = w / img.width;
          const h = Math.round(img.height * ratio);
          const canvas = document.createElement('canvas');
          canvas.width = w;
          canvas.height = h;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, w, h);
          resolve(canvas.toDataURL('image/png', 0.8));
        };
        img.onerror = reject;
        img.src = e.target.result;
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
    if (scaled.length <= 2000) return scaled;
    dataURL = scaled;
  }
  return dataURL; // may still be large
}

generateBtn.addEventListener('click', async () => {
  qrContainer.innerHTML = 'Preparing...';
  downloadBtn.disabled = true;
  if (!currentDataURL) {
    qrContainer.textContent = 'No image selected';
    return;
  }
  let dataURL = currentDataURL;
  if (dataURL.length > 2000) {
    qrContainer.textContent = 'Image is large — attempting further compression/resizing...';
    const small = await ensureSmallDataURL(dataURL);
    if (!small) {
      qrContainer.textContent = 'Unable to process image';
      return;
    }
    dataURL = small;
  }

  qrContainer.innerHTML = '';
  try {
    // create QR (qrcode.min.js)
    new QRCode(qrContainer, {
      text: dataURL,
      width: 256,
      height: 256,
      correctLevel: QRCode.CorrectLevel.M
    });

    // small delay to allow library to render inside container
    setTimeout(() => {
      const img = qrContainer.querySelector('img');
      const canvas = qrContainer.querySelector('canvas');
      let qrDataURL = '';
      if (img && img.src) qrDataURL = img.src;
      else if (canvas) qrDataURL = canvas.toDataURL('image/png');

      if (qrDataURL) {
        downloadBtn.disabled = false;
        downloadBtn.onclick = () => {
          const a = document.createElement('a');
          a.href = qrDataURL;
          a.download = 'qr-image.png';
          a.click();
        };
      }
    }, 150);
  } catch (err) {
    console.error(err);
    qrContainer.textContent = 'Failed to generate QR';
  }
});

// allow clicking preview to open full image in new tab
preview.addEventListener('click', () => {
  const img = preview.querySelector('img');
  if (img && img.src) window.open(img.src, '_blank');
});