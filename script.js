const canvas = document.querySelector("#visualCanvas");
const addModelButton = document.querySelector("#addModelButton");
const addTextButton = document.querySelector("#addTextButton");
const addImageButton = document.querySelector("#addImageButton");
const fillImageButton = document.querySelector("#fillImageButton");
const addShapeButton = document.querySelector("#addShapeButton");
const deleteButton = document.querySelector("#deleteButton");
const downloadButton = document.querySelector("#downloadButton");
const modelInput = document.querySelector("#modelInput");
const imageFillInput = document.querySelector("#imageFillInput");
const widthControl = document.querySelector("#widthControl");
const heightControl = document.querySelector("#heightControl");
const fontSizeControl = document.querySelector("#fontSizeControl");
const widthValue = document.querySelector("#widthValue");
const heightValue = document.querySelector("#heightValue");
const fontSizeValue = document.querySelector("#fontSizeValue");
const shapeControl = document.querySelector("#shapeControl");
const colorControl = document.querySelector("#colorControl");
const opacityControl = document.querySelector("#opacityControl");
const modelZoomControl = document.querySelector("#modelZoomControl");
const modelXControl = document.querySelector("#modelXControl");
const modelYControl = document.querySelector("#modelYControl");

let activeDrag = null;
let selectedItem = canvas.querySelector(".canvas-item");
let textCount = canvas.querySelectorAll(".text-item").length;
let imageCount = canvas.querySelectorAll(".image-item").length;
let shapeCount = canvas.querySelectorAll(".shape-item").length;

const controls = [
  widthControl,
  heightControl,
  fontSizeControl,
  shapeControl,
  colorControl,
  opacityControl,
  modelZoomControl,
  modelXControl,
  modelYControl,
];
const valueOutputs = new Map([
  [widthControl, { output: widthValue, unit: "%" }],
  [heightControl, { output: heightValue, unit: "%" }],
  [fontSizeControl, { output: fontSizeValue, unit: "px" }],
]);

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function percentFromStyle(item, property, fallback) {
  const value = item.style[property];
  if (value.endsWith("%")) return parseFloat(value);
  return fallback;
}

function isModelLayer(item) {
  return item?.classList.contains("model-layer");
}

function hasEmbeddedImage(item) {
  return item?.classList.contains("image-item") && item.dataset.imageEmbedded === "true";
}

function hasMovableInnerImage(item) {
  return isModelLayer(item) || hasEmbeddedImage(item);
}

function updateValueOutput(control) {
  const valueOutput = valueOutputs.get(control);
  if (!valueOutput) return;

  valueOutput.output.value = control.value;
}

function setControlValue(control, value) {
  control.value = clamp(Number(value), Number(control.min), Number(control.max));
  updateValueOutput(control);
}

function numberFromInput(value) {
  return Number(value.trim().replace(",", "."));
}

function applyNumberInput(input) {
  const entry = [...valueOutputs].find(([, valueOutput]) => valueOutput.output === input);
  if (!entry) return;

  const [control] = entry;
  if (control.disabled) {
    updateValueOutput(control);
    return;
  }

  const value = numberFromInput(input.value);

  if (!Number.isFinite(value)) {
    updateValueOutput(control);
    return;
  }

  setControlValue(control, value);
  control.dispatchEvent(new Event("input", { bubbles: true }));
}

function updateAllValueOutputs() {
  valueOutputs.forEach((_, control) => updateValueOutput(control));
}

function imageLabel(index) {
  let label = "";
  let current = index;

  while (current > 0) {
    current -= 1;
    label = String.fromCharCode(65 + (current % 26)) + label;
    current = Math.floor(current / 26);
  }

  return `Image ${label}`;
}

function selectItem(item) {
  if (selectedItem) selectedItem.classList.remove("is-selected");
  selectedItem = item;

  if (!selectedItem) {
    controls.forEach((control) => {
      control.disabled = true;
    });
    deleteButton.disabled = true;
    fillImageButton.disabled = true;
    return;
  }

  const isModel = isModelLayer(selectedItem);
  const hasInnerImage = hasMovableInnerImage(selectedItem);
  selectedItem.classList.add("is-selected");
  controls.forEach((control) => {
    control.disabled = false;
  });
  deleteButton.disabled = false;
  fillImageButton.disabled = !selectedItem.classList.contains("image-item");

  setControlValue(widthControl, isModel ? 100 : percentFromStyle(selectedItem, "width", 50));
  setControlValue(heightControl, isModel ? 100 : selectedItem.style.height === "auto" ? 20 : percentFromStyle(selectedItem, "height", 20));
  setControlValue(fontSizeControl, parseFloat(selectedItem.style.fontSize || getComputedStyle(selectedItem).fontSize));
  shapeControl.value = selectedItem.dataset.shape || "free";
  colorControl.value = rgbToHex(getComputedStyle(selectedItem).backgroundColor);
  opacityControl.value = Math.round(parseFloat(selectedItem.style.opacity || "1") * 100);
  modelZoomControl.value = selectedItem.dataset.zoom || selectedItem.dataset.imageZoom || "100";
  modelXControl.value = selectedItem.dataset.modelX || selectedItem.dataset.imageX || "50";
  modelYControl.value = selectedItem.dataset.modelY || selectedItem.dataset.imageY || "50";
  widthControl.disabled = isModel;
  heightControl.disabled = isModel;
  fontSizeControl.disabled = isModel;
  shapeControl.disabled = isModel || (!selectedItem.classList.contains("image-item") && !selectedItem.classList.contains("shape-item"));
  colorControl.disabled = isModel || !selectedItem.classList.contains("shape-item");
  modelZoomControl.disabled = !hasInnerImage;
  modelXControl.disabled = !hasInnerImage;
  modelYControl.disabled = !hasInnerImage;
}

function createTextItem() {
  textCount += 1;

  const item = document.createElement("p");
  item.className = "canvas-item text-item";
  item.dataset.type = "text";
  item.contentEditable = "true";
  item.textContent = `TEXTE ${textCount}`;
  item.style.left = "50%";
  item.style.top = "50%";
  item.style.width = "54%";
  item.style.height = "auto";
  item.style.fontSize = "32px";
  item.style.opacity = "1";
  canvas.appendChild(item);
  selectItem(item);
  item.focus();
}

function createImageItem() {
  imageCount += 1;

  const item = document.createElement("div");
  item.className = "canvas-item image-item";
  item.dataset.type = "image-placeholder";
  item.dataset.shape = "rectangle";
  item.textContent = imageLabel(imageCount);
  item.style.left = "50%";
  item.style.top = "50%";
  item.style.width = "48%";
  item.style.height = "30%";
  item.style.opacity = "1";
  canvas.appendChild(item);
  selectItem(item);
}

function createShapeItem() {
  shapeCount += 1;

  const item = document.createElement("div");
  item.className = "canvas-item shape-item";
  item.dataset.type = "shape";
  item.dataset.shape = "rectangle";
  item.setAttribute("aria-label", `Forme ${shapeCount}`);
  item.style.left = "50%";
  item.style.top = "50%";
  item.style.width = "24%";
  item.style.height = "14%";
  item.style.backgroundColor = "#ffffff";
  item.style.opacity = "1";
  canvas.appendChild(item);
  selectItem(item);
}

function applyModelPosition(item) {
  const zoom = Number(item.dataset.zoom || 100);
  const x = Number(item.dataset.modelX || 50);
  const y = Number(item.dataset.modelY || 50);
  const imageRatio = Number(item.dataset.imageRatio || 0);
  const canvasRatio = 4 / 5;

  if (!imageRatio) {
    item.style.backgroundSize = "cover";
    item.style.backgroundPosition = `${x}% ${y}%`;
    return;
  }

  const size =
    imageRatio > canvasRatio
      ? { width: (imageRatio / canvasRatio) * zoom, height: zoom }
      : { width: zoom, height: (canvasRatio / imageRatio) * zoom };

  item.style.backgroundSize = `${size.width}% ${size.height}%`;
  item.style.backgroundPosition = `${x}% ${y}%`;
}

function applyEmbeddedImagePosition(item) {
  const zoom = Number(item.dataset.imageZoom || 100);
  const x = Number(item.dataset.imageX || 50);
  const y = Number(item.dataset.imageY || 50);
  const imageRatio = Number(item.dataset.imageRatio || 0);
  const itemRect = item.getBoundingClientRect();
  const itemRatio = itemRect.width && itemRect.height ? itemRect.width / itemRect.height : 1;

  if (!imageRatio) {
    item.style.backgroundSize = "cover";
    item.style.backgroundPosition = `${x}% ${y}%`;
    return;
  }

  const size =
    imageRatio > itemRatio
      ? { width: (imageRatio / itemRatio) * zoom, height: zoom }
      : { width: zoom, height: (itemRatio / imageRatio) * zoom };

  item.style.backgroundSize = `${size.width}% ${size.height}%`;
  item.style.backgroundPosition = `${x}% ${y}%`;
}

function createModelLayer(src) {
  const currentModel = canvas.querySelector(".model-layer");
  if (currentModel) currentModel.remove();

  const item = document.createElement("div");
  item.className = "model-layer";
  item.dataset.type = "model";
  item.dataset.zoom = "100";
  item.dataset.modelX = "50";
  item.dataset.modelY = "50";
  item.style.backgroundImage = `url("${src}")`;
  item.style.opacity = "1";
  applyModelPosition(item);
  canvas.prepend(item);
  selectItem(item);

  const image = new Image();
  image.addEventListener("load", () => {
    item.dataset.imageRatio = `${image.naturalWidth / image.naturalHeight}`;
    applyModelPosition(item);
  });
  image.src = src;
}

function readModelFile(file) {
  const reader = new FileReader();

  reader.addEventListener("load", () => {
    createModelLayer(reader.result);
    modelInput.value = "";
  });

  reader.readAsDataURL(file);
}

function fillSelectedImage(src) {
  if (!selectedItem?.classList.contains("image-item")) return;

  const imageItem = selectedItem;
  imageItem.classList.add("has-image");
  imageItem.dataset.imageEmbedded = "true";
  imageItem.dataset.imageZoom = "100";
  imageItem.dataset.imageX = "50";
  imageItem.dataset.imageY = "50";
  imageItem.style.backgroundImage = `url("${src}")`;
  imageItem.style.backgroundRepeat = "no-repeat";
  applyEmbeddedImagePosition(imageItem);

  const image = new Image();
  image.addEventListener("load", () => {
    imageItem.dataset.imageRatio = `${image.naturalWidth / image.naturalHeight}`;
    applyEmbeddedImagePosition(imageItem);
    selectItem(imageItem);
  });
  image.src = src;
}

function readImageFillFile(file) {
  const reader = new FileReader();

  reader.addEventListener("load", () => {
    fillSelectedImage(reader.result);
    imageFillInput.value = "";
  });

  reader.readAsDataURL(file);
}

function rgbToHex(color) {
  const match = color.match(/\d+/g);
  if (!match) return "#ffffff";

  return match
    .slice(0, 3)
    .map((value) => Number(value).toString(16).padStart(2, "0"))
    .join("")
    .padStart(6, "0")
    .replace(/^/, "#");
}

function getPointerPosition(event) {
  const rect = canvas.getBoundingClientRect();
  const x = clamp(((event.clientX - rect.left) / rect.width) * 100, 0, 100);
  const y = clamp(((event.clientY - rect.top) / rect.height) * 100, 0, 100);
  return { x, y };
}

function moveItem(event) {
  if (!activeDrag) return;

  if (activeDrag.type === "model") {
    const rect = canvas.getBoundingClientRect();
    const deltaX = ((event.clientX - activeDrag.startX) / rect.width) * 100;
    const deltaY = ((event.clientY - activeDrag.startY) / rect.height) * 100;
    const nextX = clamp(activeDrag.startModelX + deltaX, 0, 100);
    const nextY = clamp(activeDrag.startModelY + deltaY, 0, 100);

    activeDrag.element.dataset.modelX = nextX.toFixed(1);
    activeDrag.element.dataset.modelY = nextY.toFixed(1);
    modelXControl.value = activeDrag.element.dataset.modelX;
    modelYControl.value = activeDrag.element.dataset.modelY;
    applyModelPosition(activeDrag.element);
    return;
  }

  const position = getPointerPosition(event);
  activeDrag.element.style.left = `${position.x.toFixed(2)}%`;
  activeDrag.element.style.top = `${position.y.toFixed(2)}%`;
}

function exportCanvasData() {
  const canvasRect = canvas.getBoundingClientRect();
  const items = [...canvas.children].map((item, index) => {
    const itemRect = item.getBoundingClientRect();
    const styles = getComputedStyle(item);

    return {
      index,
      type: item.dataset.type || (item.classList.contains("text-item") ? "text" : item.tagName.toLowerCase()),
      text: item.textContent.trim(),
      shape: item.dataset.shape || null,
      model: isModelLayer(item)
        ? {
            zoom: item.dataset.zoom,
            x: item.dataset.modelX,
            y: item.dataset.modelY,
          }
        : null,
      imageEmbedded: item.dataset.imageEmbedded === "true",
      embeddedImage: hasEmbeddedImage(item)
        ? {
            zoom: item.dataset.imageZoom,
            x: item.dataset.imageX,
            y: item.dataset.imageY,
          }
        : null,
      html: item.outerHTML.replace(" is-selected", ""),
      position: {
        left: item.style.left || `${(((itemRect.left - canvasRect.left) / canvasRect.width) * 100).toFixed(2)}%`,
        top: item.style.top || `${(((itemRect.top - canvasRect.top) / canvasRect.height) * 100).toFixed(2)}%`,
      },
      size: {
        width: `${((itemRect.width / canvasRect.width) * 100).toFixed(2)}%`,
        height: `${((itemRect.height / canvasRect.height) * 100).toFixed(2)}%`,
      },
      styles: {
        backgroundColor: styles.backgroundColor,
        borderRadius: styles.borderRadius,
        color: styles.color,
        fontSize: styles.fontSize,
        fontWeight: styles.fontWeight,
        textAlign: styles.textAlign,
        opacity: styles.opacity,
        transform: styles.transform,
      },
    };
  });

  return {
    name: canvas.dataset.exportName || "visuel",
    format: "4:5",
    background: getComputedStyle(canvas).backgroundColor,
    width: Math.round(canvasRect.width),
    height: Math.round(canvasRect.height),
    items,
  };
}

function getCanvasCode() {
  return [...canvas.children]
    .map((item) => {
      const clone = item.cloneNode(true);
      clone.classList.remove("is-selected");
      clone.removeAttribute("contenteditable");
      return clone.outerHTML;
    })
    .join("\n      ");
}

function buildExportHtml(data) {
  const body = getCanvasCode();
  const metadata = JSON.stringify(data, null, 2).replaceAll("</script", "<\\/script");

  return `<!DOCTYPE html>
<html lang="fr">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${data.name}</title>
    <style>
      * { box-sizing: border-box; }
      body {
        min-height: 100vh;
        margin: 0;
        display: grid;
        place-items: center;
        background: #f4f2ee;
        font-family: Inter, ui-sans-serif, system-ui, sans-serif;
      }
      .visual-canvas {
        position: relative;
        width: min(80vw, 560px);
        aspect-ratio: 4 / 5;
        overflow: hidden;
        background: ${data.background};
      }
      .canvas-item {
        position: absolute;
        margin: 0;
        transform: translate(-50%, -50%);
        z-index: 2;
      }
      .model-layer {
        position: absolute;
        inset: 0;
        z-index: 1;
        background-repeat: no-repeat;
        background-position: 50% 50%;
        background-size: cover;
      }
      .image-item {
        display: grid;
        place-items: center;
        background: rgba(255, 255, 255, 0.32);
        background-position: center;
        background-repeat: no-repeat;
        background-size: cover;
        color: #151515;
        font-size: 28px;
        font-weight: 800;
        text-align: center;
        user-select: none;
        overflow: hidden;
      }
      .image-item.has-image {
        background-color: transparent;
        color: transparent;
      }
      .shape-item {
        background: #ffffff;
      }
      .shape-item[data-shape="circle"] {
        border-radius: 999px;
      }
      .text-item {
        min-width: 80px;
        max-width: 90%;
        padding: 6px 8px;
        color: #151515;
        font-size: 32px;
        font-weight: 750;
        line-height: 1.1;
        text-align: center;
        overflow-wrap: anywhere;
      }
    </style>
  </head>
  <body>
    <!-- Code du rectangle gris uniquement -->
    <div class="visual-canvas">
      ${body}
    </div>
    <script type="application/json" id="visual-data">
${metadata}
    <\/script>
  </body>
</html>`;
}

function downloadCanvasCode() {
  const data = exportCanvasData();
  const html = buildExportHtml(data);
  const blob = new Blob([html], { type: "text/html;charset=utf-8" });
  const link = document.createElement("a");

  link.href = URL.createObjectURL(blob);
  link.download = `${data.name}.html`;
  link.click();
  URL.revokeObjectURL(link.href);
}

canvas.addEventListener("pointerdown", (event) => {
  const item = event.target.closest(".canvas-item, .model-layer");
  if (!item || item === document.activeElement) return;

  selectItem(item);
  activeDrag = isModelLayer(item)
    ? {
        element: item,
        type: "model",
        startX: event.clientX,
        startY: event.clientY,
        startModelX: Number(item.dataset.modelX || 50),
        startModelY: Number(item.dataset.modelY || 50),
      }
    : { element: item };
  item.setPointerCapture(event.pointerId);
});

canvas.addEventListener("pointermove", moveItem);

canvas.addEventListener("pointerup", () => {
  activeDrag = null;
});

canvas.addEventListener("dblclick", (event) => {
  const item = event.target.closest(".text-item");
  if (item) item.focus();
});

canvas.addEventListener("click", (event) => {
  const item = event.target.closest(".canvas-item, .model-layer");
  if (item) selectItem(item);
});

addModelButton.addEventListener("click", () => modelInput.click());
modelInput.addEventListener("change", () => {
  const file = modelInput.files[0];
  if (file) readModelFile(file);
});
addTextButton.addEventListener("click", () => createTextItem());
addImageButton.addEventListener("click", () => createImageItem());
fillImageButton.addEventListener("click", () => {
  if (selectedItem?.classList.contains("image-item")) {
    imageFillInput.click();
  }
});
imageFillInput.addEventListener("change", () => {
  const file = imageFillInput.files[0];
  if (file) readImageFillFile(file);
});
addShapeButton.addEventListener("click", () => createShapeItem());
deleteButton.addEventListener("click", () => {
  if (!selectedItem) return;

  const itemToRemove = selectedItem;
  selectItem(null);
  itemToRemove.remove();
});
downloadButton.addEventListener("click", downloadCanvasCode);

widthControl.addEventListener("input", () => {
  if (!selectedItem) return;

  selectedItem.style.width = `${widthControl.value}%`;
  updateValueOutput(widthControl);

  if (selectedItem.dataset.shape === "square" || selectedItem.dataset.shape === "circle") {
    selectedItem.style.height = `${widthControl.value}%`;
    setControlValue(heightControl, widthControl.value);
  }

  if (hasEmbeddedImage(selectedItem)) applyEmbeddedImagePosition(selectedItem);
});

heightControl.addEventListener("input", () => {
  if (!selectedItem) return;

  selectedItem.style.height = `${heightControl.value}%`;
  updateValueOutput(heightControl);

  if (selectedItem.dataset.shape === "square" || selectedItem.dataset.shape === "circle") {
    selectedItem.style.width = `${heightControl.value}%`;
    setControlValue(widthControl, heightControl.value);
  }

  if (hasEmbeddedImage(selectedItem)) applyEmbeddedImagePosition(selectedItem);
});

fontSizeControl.addEventListener("input", () => {
  updateValueOutput(fontSizeControl);
  if (selectedItem) selectedItem.style.fontSize = `${fontSizeControl.value}px`;
});

shapeControl.addEventListener("input", () => {
  if (!selectedItem || (!selectedItem.classList.contains("image-item") && !selectedItem.classList.contains("shape-item"))) return;

  selectedItem.dataset.shape = shapeControl.value;
  selectedItem.style.borderRadius = shapeControl.value === "circle" ? "999px" : "0";

  if (shapeControl.value === "square") {
    const side = Math.min(widthControl.value, heightControl.value || widthControl.value);
    selectedItem.style.width = `${side}%`;
    selectedItem.style.height = `${side}%`;
    setControlValue(widthControl, side);
    setControlValue(heightControl, side);
  }

  if (shapeControl.value === "circle") {
    const side = Math.min(widthControl.value, heightControl.value || widthControl.value);
    selectedItem.style.width = `${side}%`;
    selectedItem.style.height = `${side}%`;
    setControlValue(widthControl, side);
    setControlValue(heightControl, side);
  }

  if (shapeControl.value === "rectangle") {
    const width = selectedItem.classList.contains("shape-item") ? 24 : 48;
    const height = selectedItem.classList.contains("shape-item") ? 14 : 30;
    selectedItem.style.width = `${width}%`;
    selectedItem.style.height = `${height}%`;
    setControlValue(widthControl, width);
    setControlValue(heightControl, height);
  }
});

document.querySelectorAll("[data-step-for]").forEach((button) => {
  button.addEventListener("click", () => {
    const control = document.querySelector(`#${button.dataset.stepFor}`);
    if (!control || control.disabled) return;

    setControlValue(control, (Number(control.value) + Number(button.dataset.step)).toFixed(1));
    control.dispatchEvent(new Event("input", { bubbles: true }));
  });
});

document.querySelectorAll(".number-value").forEach((input) => {
  input.addEventListener("change", () => applyNumberInput(input));
  input.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      input.blur();
    }
  });
});

colorControl.addEventListener("input", () => {
  if (selectedItem && selectedItem.classList.contains("shape-item")) {
    selectedItem.style.backgroundColor = colorControl.value;
  }
});

opacityControl.addEventListener("input", () => {
  if (selectedItem) selectedItem.style.opacity = `${opacityControl.value / 100}`;
});

modelZoomControl.addEventListener("input", () => {
  if (!hasMovableInnerImage(selectedItem)) return;

  if (isModelLayer(selectedItem)) {
    selectedItem.dataset.zoom = modelZoomControl.value;
    applyModelPosition(selectedItem);
    return;
  }

  selectedItem.dataset.imageZoom = modelZoomControl.value;
  applyEmbeddedImagePosition(selectedItem);
});

modelXControl.addEventListener("input", () => {
  if (!hasMovableInnerImage(selectedItem)) return;

  if (isModelLayer(selectedItem)) {
    selectedItem.dataset.modelX = modelXControl.value;
    applyModelPosition(selectedItem);
    return;
  }

  selectedItem.dataset.imageX = modelXControl.value;
  applyEmbeddedImagePosition(selectedItem);
});

modelYControl.addEventListener("input", () => {
  if (!hasMovableInnerImage(selectedItem)) return;

  if (isModelLayer(selectedItem)) {
    selectedItem.dataset.modelY = modelYControl.value;
    applyModelPosition(selectedItem);
    return;
  }

  selectedItem.dataset.imageY = modelYControl.value;
  applyEmbeddedImagePosition(selectedItem);
});

selectItem(selectedItem);
updateAllValueOutputs();
