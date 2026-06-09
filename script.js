const canvas = document.querySelector("#visualCanvas");
const addTextButton = document.querySelector("#addTextButton");
const addImageButton = document.querySelector("#addImageButton");
const fillImageButton = document.querySelector("#fillImageButton");
const clearImageButton = document.querySelector("#clearImageButton");
const addShapeButton = document.querySelector("#addShapeButton");
const deleteButton = document.querySelector("#deleteButton");
const downloadButton = document.querySelector("#downloadButton");
const modelInput = document.querySelector("#modelInput");
const imageFillInput = document.querySelector("#imageFillInput");
const imageImportList = document.querySelector("#imageImportList");
const textEditList = document.querySelector("#textEditList");
const btnRecadrer = document.querySelector("#btnRecadrer");
const btnClearModel = document.querySelector("#btnClearModel");
const btnExport = document.querySelector("#btnExport");
const btnShare = document.querySelector("#btnShare");
const recadrageModal = document.querySelector("#recadrageModal");
const recadragePreview = document.querySelector("#recadragePreview");
const recadrageZoomSlider = document.querySelector("#recadrageZoomSlider");
const btnAnnulerRecadrage = document.querySelector("#btnAnnulerRecadrage");
const btnValiderRecadrage = document.querySelector("#btnValiderRecadrage");
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
let imageImportCount = 0;
let textEditCount = 0;
let recadrageDrag = null;
let cropTarget = null;

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

function updateTextSectionVisibility() {
  const section = textEditList.closest(".editor-section");
  if (section) section.style.display = textEditList.querySelector(".text-edit-row") ? "" : "none";
}

function updateImageSectionVisibility() {
  const section = imageImportList.closest(".editor-section");
  if (!section) return;
  const hasVisible = [...imageImportList.querySelectorAll(".image-import-row")].some(r => r.style.display !== "none");
  section.style.display = hasVisible ? "" : "none";
}

function renderEmptyImageImports() {
  if (imageImportList.children.length) return;

  const empty = document.createElement("p");
  empty.className = "image-import-empty";
  empty.textContent = "Ajoute une image pour afficher son import ici.";
  imageImportList.appendChild(empty);
  updateImageSectionVisibility();
}

function renderEmptyTextEdits() {
  if (textEditList.children.length) return;

  const empty = document.createElement("p");
  empty.className = "text-edit-empty";
  empty.textContent = "Ajoute un texte pour le modifier ici.";
  textEditList.appendChild(empty);
  updateTextSectionVisibility();
}

function createTextEditControl(item) {
  if (!item) return;

  textEditList.querySelector(".text-edit-empty")?.remove();

  textEditCount += 1;
  const textId = `text-${textEditCount}`;
  item.dataset.textId = textId;

  const row = document.createElement("div");
  row.className = "text-edit-row";
  row.dataset.textId = textId;

  const fieldLabel = document.createElement("label");
  fieldLabel.textContent = item.textContent.trim();

  const textarea = document.createElement("textarea");
  textarea.placeholder = "Votre texte ici...";
  textarea.value = item.textContent.trim();
  textarea.addEventListener("input", () => {
    item.textContent = textarea.value || " ";
  });

  fieldLabel.appendChild(textarea);
  row.appendChild(fieldLabel);
  textEditList.appendChild(row);
  updateTextSectionVisibility();
}

function removeTextEditControl(item) {
  const textId = item?.dataset.textId;
  if (!textId) return;

  textEditList.querySelector(`[data-text-id="${textId}"]`)?.remove();
  renderEmptyTextEdits();
}

function syncTextEditControl(item) {
  const textId = item?.dataset.textId;
  if (!textId) return;

  const textarea = textEditList.querySelector(`[data-text-id="${textId}"] textarea`);
  if (textarea && textarea !== document.activeElement) {
    textarea.value = item.textContent.trim();
  }
}

function createImageImportControl(item, label) {
  imageImportList.querySelector(".image-import-empty")?.remove();

  imageImportCount += 1;
  const imageId = `image-${imageImportCount}`;
  item.dataset.imageId = imageId;

  const row = document.createElement("div");
  row.className = "image-import-row";
  row.dataset.imageId = imageId;
  row.dataset.imageLabel = label;

  const fieldLabel = document.createElement("label");
  fieldLabel.textContent = `Importer une ${label}`;

  const input = document.createElement("input");
  input.type = "file";
  input.accept = "image/*";
  input.addEventListener("change", () => {
    const file = input.files[0];
    if (!file) return;
    readImageFillFile(file, item);
    input.value = "";
  });

  const btnCrop = document.createElement("button");
  btnCrop.type = "button";
  btnCrop.textContent = "Recadrer";
  btnCrop.className = "btn-recadrer-image";
  btnCrop.disabled = true;
  btnCrop.addEventListener("click", () => openImageCropModal(item));

  const inputRow = document.createElement("div");
  inputRow.style.cssText = "display:flex;gap:8px;align-items:center;";
  inputRow.appendChild(input);
  inputRow.appendChild(btnCrop);

  fieldLabel.appendChild(inputRow);
  row.appendChild(fieldLabel);
  imageImportList.appendChild(row);
  updateImageSectionVisibility();
}

function disableImageImportControl(item) {
  const imageId = item?.dataset.imageId;
  if (!imageId) return;

  const row = imageImportList.querySelector(`[data-image-id="${imageId}"]`);
  if (!row) return;

  const input = row.querySelector("input");
  const label = row.querySelector("label");

  row.style.display = "none";
  updateImageSectionVisibility();
}

function enableImageImportControl(item) {
  const imageId = item?.dataset.imageId;
  if (!imageId) return;
  const row = imageImportList.querySelector(`[data-image-id="${imageId}"]`);
  if (!row) return;
  const input = row.querySelector("input[type='file']");
  const cropBtn = row.querySelector(".btn-recadrer-image");
  row.style.display = "";
  if (input) input.disabled = false;
  if (cropBtn) cropBtn.disabled = true;
  updateImageSectionVisibility();
}

function clearImageContent() {
  if (!selectedItem?.classList.contains("image-item")) return;
  const item = selectedItem;
  item.classList.remove("has-image");
  item.style.backgroundImage = "";
  item.style.backgroundSize = "";
  item.style.backgroundPosition = "";
  item.style.backgroundRepeat = "";
  delete item.dataset.imageEmbedded;
  delete item.dataset.imageSource;
  delete item.dataset.imageZoom;
  delete item.dataset.imageX;
  delete item.dataset.imageY;
  delete item.dataset.imageRatio;
  enableImageImportControl(item);
  clearImageButton.disabled = true;
  fillImageButton.disabled = false;
}

function removeImageImportControl(item) {
  const imageId = item?.dataset.imageId;
  if (!imageId) return;

  imageImportList.querySelector(`[data-image-id="${imageId}"]`)?.remove();
  renderEmptyImageImports();
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
    clearImageButton.disabled = true;
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
  clearImageButton.disabled = !selectedItem.classList.contains("has-image");

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
  createTextEditControl(item);
  selectItem(item);
  item.focus();
}

function createImageItem() {
  imageCount += 1;
  const label = imageLabel(imageCount);

  const item = document.createElement("div");
  item.className = "canvas-item image-item";
  item.dataset.type = "image-placeholder";
  item.dataset.shape = "rectangle";
  item.textContent = label;
  item.style.left = "50%";
  item.style.top = "50%";
  item.style.width = "48%";
  item.style.height = "30%";
  item.style.opacity = "1";
  canvas.appendChild(item);
  createImageImportControl(item, label);
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
  const canvasRatio = item.dataset.containerRatio ? Number(item.dataset.containerRatio) : 4 / 5;

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
  btnRecadrer.disabled = false;
  btnClearModel.disabled = false;

  const image = new Image();
  image.addEventListener("load", () => {
    item.dataset.imageRatio = `${image.naturalWidth / image.naturalHeight}`;
    applyModelPosition(item);
  });
  image.src = src;
}

function getModelLayer() {
  return canvas.querySelector(".model-layer");
}

function syncCropPreviewFromModel() {
  const model = getModelLayer();
  if (!model) return;

  recadragePreview.dataset.zoom = model.dataset.zoom || "100";
  recadragePreview.dataset.modelX = model.dataset.modelX || "50";
  recadragePreview.dataset.modelY = model.dataset.modelY || "50";
  recadragePreview.dataset.imageRatio = model.dataset.imageRatio || "";
  recadragePreview.style.backgroundImage = model.style.backgroundImage;
  recadrageZoomSlider.value = recadragePreview.dataset.zoom;
  applyModelPosition(recadragePreview);
}

function openRecadrage() {
  if (!getModelLayer()) return;
  cropTarget = "model";
  syncCropPreviewFromModel();
  recadrageModal.classList.add("active");
}

function openImageCropModal(imageItem) {
  if (!imageItem?.dataset.imageEmbedded) return;
  cropTarget = imageItem;
  const itemRect = imageItem.getBoundingClientRect();
  const itemRatio = itemRect.width && itemRect.height ? itemRect.width / itemRect.height : 4 / 5;
  recadragePreview.dataset.zoom = imageItem.dataset.imageZoom || "100";
  recadragePreview.dataset.modelX = imageItem.dataset.imageX || "50";
  recadragePreview.dataset.modelY = imageItem.dataset.imageY || "50";
  recadragePreview.dataset.imageRatio = imageItem.dataset.imageRatio || "";
  recadragePreview.dataset.containerRatio = itemRatio.toFixed(4);
  recadragePreview.style.aspectRatio = `${itemRect.width} / ${itemRect.height}`;
  recadragePreview.style.backgroundImage = imageItem.style.backgroundImage;
  recadrageZoomSlider.value = recadragePreview.dataset.zoom;
  applyModelPosition(recadragePreview);
  recadrageModal.classList.add("active");
}

function closeRecadrage() {
  recadrageModal.classList.remove("active");
  recadragePreview.style.aspectRatio = "";
  delete recadragePreview.dataset.containerRatio;
  recadrageDrag = null;
  cropTarget = null;
}

function validateRecadrage() {
  if (cropTarget === "model") {
    const model = getModelLayer();
    if (!model) return;
    model.dataset.zoom = recadragePreview.dataset.zoom || "100";
    model.dataset.modelX = recadragePreview.dataset.modelX || "50";
    model.dataset.modelY = recadragePreview.dataset.modelY || "50";
    applyModelPosition(model);
    selectItem(model);
  } else if (cropTarget instanceof HTMLElement) {
    cropTarget.dataset.imageZoom = recadragePreview.dataset.zoom || "100";
    cropTarget.dataset.imageX = recadragePreview.dataset.modelX || "50";
    cropTarget.dataset.imageY = recadragePreview.dataset.modelY || "50";
    applyEmbeddedImagePosition(cropTarget);
    selectItem(cropTarget);
  }
  closeRecadrage();
}

function moveCropPreview(event) {
  if (!recadrageDrag) return;

  const rect = recadragePreview.getBoundingClientRect();
  const deltaX = ((event.clientX - recadrageDrag.startX) / rect.width) * 100;
  const deltaY = ((event.clientY - recadrageDrag.startY) / rect.height) * 100;
  recadragePreview.dataset.modelX = clamp(recadrageDrag.startModelX - deltaX, 0, 100).toFixed(1);
  recadragePreview.dataset.modelY = clamp(recadrageDrag.startModelY - deltaY, 0, 100).toFixed(1);
  applyModelPosition(recadragePreview);
}

function readModelFile(file) {
  const reader = new FileReader();

  reader.addEventListener("load", () => {
    createModelLayer(reader.result);
    modelInput.value = "";
  });

  reader.readAsDataURL(file);
}

function fillImageItem(item, src, source = "right") {
  if (!item?.classList.contains("image-item")) return;

  const imageItem = item;
  imageItem.classList.add("has-image");
  if (imageItem === selectedItem) clearImageButton.disabled = false;
  imageItem.dataset.imageEmbedded = "true";
  imageItem.dataset.imageSource = source;
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
    const imageId = imageItem.dataset.imageId;
    if (imageId) {
      const btn = imageImportList.querySelector(`[data-image-id="${imageId}"] .btn-recadrer-image`);
      if (btn) btn.disabled = false;
    }
  });
  image.src = src;
}

function fillSelectedImage(src) {
  fillImageItem(selectedItem, src);
}

function readImageFillFile(file, targetItem = selectedItem, source = "right") {
  const reader = new FileReader();

  reader.addEventListener("load", () => {
    fillImageItem(targetItem, reader.result, source);
    if (source === "left") disableImageImportControl(targetItem);
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

function dataUrlInfo(dataUrl) {
  const match = dataUrl.match(/^data:([^;]+);base64,(.*)$/);
  if (!match) return null;

  const extensionByType = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
    "image/gif": "gif",
    "image/svg+xml": "svg",
  };

  return {
    mime: match[1],
    base64: match[2],
    extension: extensionByType[match[1]] || "png",
  };
}

function getBackgroundDataUrl(item) {
  const value = item.style.backgroundImage;
  const match = value.match(/^url\(["']?(.*?)["']?\)$/);
  return match ? match[1] : "";
}

function buildAssetMap() {
  const assets = [];
  const model = canvas.querySelector(".model-layer");
  const modelDataUrl = model ? getBackgroundDataUrl(model) : "";
  const modelInfo = modelDataUrl ? dataUrlInfo(modelDataUrl) : null;

  if (model && modelInfo) {
    assets.push({
      item: model,
      kind: "model",
      dataUrl: modelDataUrl,
      base64: modelInfo.base64,
      filename: `images/modele.${modelInfo.extension}`,
    });
  }

  canvas.querySelectorAll(".image-item[data-image-source='left']").forEach((item, index) => {
    const dataUrl = getBackgroundDataUrl(item);
    const info = dataUrlInfo(dataUrl);
    if (!info) return;

    const filename = `images/image-${index + 1}.${info.extension}`;
    assets.push({
      item,
      kind: "image",
      dataUrl,
      base64: info.base64,
      filename,
    });
  });

  return assets;
}

function replaceAssetReferences(root, assets) {
  assets.forEach((asset) => {
    if (asset.kind === "model") {
      const clone = root.querySelector(".model-layer");
      if (!clone) return;

      clone.style.backgroundImage = `url("${asset.filename}")`;
      clone.dataset.imageFile = asset.filename;
      return;
    }

    const imageId = asset.item.dataset.imageId;
    if (!imageId) return;

    const clone = root.querySelector(`.image-item[data-image-id="${imageId}"]`);
    if (!clone) return;

    clone.style.backgroundImage = `url("${asset.filename}")`;
    clone.dataset.imageFile = asset.filename;
    delete clone.dataset.imageEmbedded;
  });
}

function getWorkspaceCode(assets = []) {
  const workspace = document.querySelector(".workspace").cloneNode(true);

  workspace.querySelectorAll(".is-selected").forEach((item) => {
    item.classList.remove("is-selected");
  });

  workspace.querySelectorAll("[contenteditable]").forEach((item) => {
    item.removeAttribute("contenteditable");
  });

  workspace.querySelectorAll("textarea").forEach((textarea) => {
    textarea.textContent = textarea.value;
  });

  workspace.querySelectorAll("input").forEach((input) => {
    if (input.type !== "file") {
      input.setAttribute("value", input.value);
    }
  });

  replaceAssetReferences(workspace, assets);

  return workspace.outerHTML;
}

function getStandalonePageScript() {
  return `
document.querySelectorAll(".text-edit-row").forEach((row) => {
  const textarea = row.querySelector("textarea");
  const textId = row.dataset.textId;
  const target = document.querySelector(".text-item[data-text-id='" + textId + "']");
  if (!textarea || !target) return;
  textarea.addEventListener("input", () => {
    target.textContent = textarea.value || " ";
  });
});

document.querySelectorAll(".image-import-row").forEach((row) => {
  const input = row.querySelector("input[type='file']");
  const imageId = row.dataset.imageId;
  const target = document.querySelector(".image-item[data-image-id='" + imageId + "']");
  if (!input || !target || input.disabled) return;
  input.addEventListener("change", () => {
    const file = input.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.addEventListener("load", () => {
      target.classList.add("has-image");
      target.dataset.imageEmbedded = "true";
      target.dataset.imageZoom = "100";
      target.dataset.imageX = "50";
      target.dataset.imageY = "50";
      target.style.backgroundImage = "url('" + reader.result + "')";
      target.style.backgroundSize = "cover";
      target.style.backgroundPosition = "50% 50%";
      target.style.backgroundRepeat = "no-repeat";
      const cropBtn = row.querySelector(".btn-recadrer-image");
      const img = new Image();
      img.addEventListener("load", () => {
        target.dataset.imageRatio = (img.naturalWidth / img.naturalHeight).toString();
        if (cropBtn) cropBtn.disabled = false;
      });
      img.src = reader.result;
      input.value = "";
    });
    reader.readAsDataURL(file);
  });
});

function getModelLayer() {
  return document.querySelector(".model-layer");
}

function applyModelPosition(item) {
  const zoom = Number(item.dataset.zoom || 100);
  const x = Number(item.dataset.modelX || 50);
  const y = Number(item.dataset.modelY || 50);
  const imageRatio = Number(item.dataset.imageRatio || 0);
  const canvasRatio = item.dataset.containerRatio ? Number(item.dataset.containerRatio) : 4 / 5;
  if (!imageRatio) {
    item.style.backgroundSize = "cover";
    item.style.backgroundPosition = x + "% " + y + "%";
    return;
  }
  const size = imageRatio > canvasRatio
    ? { width: (imageRatio / canvasRatio) * zoom, height: zoom }
    : { width: zoom, height: (canvasRatio / imageRatio) * zoom };
  item.style.backgroundSize = size.width + "% " + size.height + "%";
  item.style.backgroundPosition = x + "% " + y + "%";
}

const visualCanvas = document.querySelector("#visualCanvas");
const modelInput = document.querySelector("#modelInput");
const btnRecadrer = document.querySelector("#btnRecadrer");
const recadrageModal = document.querySelector("#recadrageModal");
const recadragePreview = document.querySelector("#recadragePreview");
const recadrageZoomSlider = document.querySelector("#recadrageZoomSlider");
const btnAnnulerRecadrage = document.querySelector("#btnAnnulerRecadrage");
const btnValiderRecadrage = document.querySelector("#btnValiderRecadrage");
let cropDrag = null;
let cropTarget = null;

function closeCropModal() {
  recadrageModal?.classList.remove("active");
  if (recadragePreview) {
    recadragePreview.style.aspectRatio = "";
    delete recadragePreview.dataset.containerRatio;
  }
  cropDrag = null;
  cropTarget = null;
}

function openImageCropModal(imageItem) {
  if (!imageItem?.style.backgroundImage || imageItem.style.backgroundImage === "none" || !recadrageModal || !recadragePreview) return;
  cropTarget = imageItem;
  const rect = imageItem.getBoundingClientRect();
  const ratio = rect.width && rect.height ? rect.width / rect.height : 1;
  recadragePreview.dataset.zoom = imageItem.dataset.imageZoom || "100";
  recadragePreview.dataset.modelX = imageItem.dataset.imageX || "50";
  recadragePreview.dataset.modelY = imageItem.dataset.imageY || "50";
  recadragePreview.dataset.imageRatio = imageItem.dataset.imageRatio || "";
  recadragePreview.dataset.containerRatio = ratio.toFixed(4);
  recadragePreview.style.aspectRatio = rect.width + " / " + rect.height;
  recadragePreview.style.backgroundImage = imageItem.style.backgroundImage;
  if (recadrageZoomSlider) recadrageZoomSlider.value = recadragePreview.dataset.zoom;
  applyModelPosition(recadragePreview);
  recadrageModal.classList.add("active");
}

document.querySelectorAll(".btn-recadrer-image").forEach((btn) => {
  const row = btn.closest(".image-import-row");
  if (!row) return;
  const imageId = row.dataset.imageId;
  const target = document.querySelector(".image-item[data-image-id='" + imageId + "']");
  if (!target) return;
  if (target.style.backgroundImage && target.style.backgroundImage !== "none") btn.disabled = false;
  btn.addEventListener("click", () => openImageCropModal(target));
});

modelInput?.addEventListener("change", () => {
  const file = modelInput.files[0];
  if (!file || !visualCanvas) return;
  const reader = new FileReader();
  reader.addEventListener("load", () => {
    getModelLayer()?.remove();
    const layer = document.createElement("div");
    layer.className = "model-layer";
    layer.dataset.type = "model";
    layer.dataset.zoom = "100";
    layer.dataset.modelX = "50";
    layer.dataset.modelY = "50";
    layer.style.backgroundImage = "url('" + reader.result + "')";
    layer.style.opacity = "1";
    visualCanvas.prepend(layer);
    if (btnRecadrer) btnRecadrer.disabled = false;
    modelInput.value = "";
    const img = new Image();
    img.addEventListener("load", () => {
      layer.dataset.imageRatio = (img.naturalWidth / img.naturalHeight).toString();
      applyModelPosition(layer);
    });
    img.src = reader.result;
  });
  reader.readAsDataURL(file);
});

btnRecadrer?.addEventListener("click", () => {
  const model = getModelLayer();
  if (!model || !recadrageModal || !recadragePreview) return;
  cropTarget = "model";
  recadragePreview.style.aspectRatio = "";
  delete recadragePreview.dataset.containerRatio;
  recadragePreview.dataset.zoom = model.dataset.zoom || "100";
  recadragePreview.dataset.modelX = model.dataset.modelX || "50";
  recadragePreview.dataset.modelY = model.dataset.modelY || "50";
  recadragePreview.dataset.imageRatio = model.dataset.imageRatio || "";
  recadragePreview.style.backgroundImage = model.style.backgroundImage;
  if (recadrageZoomSlider) recadrageZoomSlider.value = recadragePreview.dataset.zoom;
  applyModelPosition(recadragePreview);
  recadrageModal.classList.add("active");
});

btnAnnulerRecadrage?.addEventListener("click", () => closeCropModal());
btnValiderRecadrage?.addEventListener("click", () => {
  if (!recadragePreview) return;
  if (cropTarget === "model") {
    const model = getModelLayer();
    if (model) {
      model.dataset.zoom = recadragePreview.dataset.zoom || "100";
      model.dataset.modelX = recadragePreview.dataset.modelX || "50";
      model.dataset.modelY = recadragePreview.dataset.modelY || "50";
      applyModelPosition(model);
    }
  } else if (cropTarget instanceof Element) {
    const zoom = Number(recadragePreview.dataset.zoom || 100);
    const x = recadragePreview.dataset.modelX || "50";
    const y = recadragePreview.dataset.modelY || "50";
    const imageRatio = Number(cropTarget.dataset.imageRatio || 0);
    const rect = cropTarget.getBoundingClientRect();
    const itemRatio = rect.width && rect.height ? rect.width / rect.height : 1;
    cropTarget.dataset.imageZoom = zoom;
    cropTarget.dataset.imageX = x;
    cropTarget.dataset.imageY = y;
    if (!imageRatio) {
      cropTarget.style.backgroundSize = "cover";
      cropTarget.style.backgroundPosition = x + "% " + y + "%";
    } else {
      const size = imageRatio > itemRatio
        ? { width: (imageRatio / itemRatio) * zoom, height: zoom }
        : { width: zoom, height: (itemRatio / imageRatio) * zoom };
      cropTarget.style.backgroundSize = size.width + "% " + size.height + "%";
      cropTarget.style.backgroundPosition = x + "% " + y + "%";
    }
  }
  closeCropModal();
});

recadrageZoomSlider?.addEventListener("input", () => {
  recadragePreview.dataset.zoom = recadrageZoomSlider.value;
  applyModelPosition(recadragePreview);
});

recadragePreview?.addEventListener("pointerdown", (event) => {
  cropDrag = {
    x: event.clientX,
    y: event.clientY,
    modelX: Number(recadragePreview.dataset.modelX || 50),
    modelY: Number(recadragePreview.dataset.modelY || 50),
  };
  recadragePreview.setPointerCapture(event.pointerId);
});

recadragePreview?.addEventListener("pointermove", (event) => {
  if (!cropDrag) return;
  const rect = recadragePreview.getBoundingClientRect();
  const nextX = Math.min(100, Math.max(0, cropDrag.modelX - ((event.clientX - cropDrag.x) / rect.width) * 100));
  const nextY = Math.min(100, Math.max(0, cropDrag.modelY - ((event.clientY - cropDrag.y) / rect.height) * 100));
  recadragePreview.dataset.modelX = nextX.toFixed(1);
  recadragePreview.dataset.modelY = nextY.toFixed(1);
  applyModelPosition(recadragePreview);
});

recadragePreview?.addEventListener("pointerup", () => {
  cropDrag = null;
});


async function renderPng() {
  if (!window.html2canvas || !visualCanvas) return null;
  return html2canvas(visualCanvas, { scale: 4, backgroundColor: null, useCORS: true });
}

document.querySelector("#btnExport")?.addEventListener("click", async () => {
  const rendered = await renderPng();
  if (!rendered) return;
  const link = document.createElement("a");
  link.href = rendered.toDataURL("image/png");
  link.download = "post.png";
  link.click();
});

document.querySelector("#btnShare")?.addEventListener("click", async () => {
  const rendered = await renderPng();
  if (!rendered) return;
  rendered.toBlob(async (blob) => {
    const file = new File([blob], "post.png", { type: "image/png" });
    if (navigator.share && navigator.canShare?.({ files: [file] })) {
      await navigator.share({ files: [file] });
    }
  }, "image/png");
});
`;
}

function buildExportHtml(data, assets = []) {
  const workspace = getWorkspaceCode(assets);
  const modal = document.querySelector("#recadrageModal").outerHTML;

  return `<!DOCTYPE html>
<html lang="fr">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${data.name}</title>
    <link rel="stylesheet" href="styles.css" />
  </head>
  <body>
    ${workspace}
    ${modal}
    <script src="https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.min.js"><\/script>
    <script src="https://cdn.jsdelivr.net/npm/jszip@3.10.1/dist/jszip.min.js"><\/script>
    <script src="script.js"><\/script>
  </body>
</html>`;
}

function downloadBlob(blob, filename) {
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  link.click();
  URL.revokeObjectURL(link.href);
}

async function downloadCanvasCode() {
  if (!window.JSZip) {
    alert("Le zip n'est pas disponible. Verifie ta connexion puis reessaie.");
    return;
  }

  const data = exportCanvasData();
  const assets = buildAssetMap();
  const html = buildExportHtml(data, assets);
  const cssText = await fetch("styles.css").then(r => r.text()).catch(() => "");

  const zip = new JSZip();
  zip.file("index.html", html);
  zip.file("styles.css", cssText);
  zip.file("script.js", getStandalonePageScript());

  assets.forEach((asset) => {
    zip.file(asset.filename, asset.base64, { base64: true });
  });

  const blob = await zip.generateAsync({ type: "blob" });
  downloadBlob(blob, "editeur-visuel.zip");
}

async function renderVisualPng() {
  if (!window.html2canvas) {
    alert("Export indisponible : html2canvas n'est pas charge.");
    return null;
  }

  const selected = selectedItem;
  if (selected) selected.classList.remove("is-selected");

  const renderedCanvas = await html2canvas(canvas, {
    scale: 4,
    backgroundColor: null,
    useCORS: true,
  });

  if (selected) selected.classList.add("is-selected");
  return renderedCanvas;
}

async function exportVisualImage() {
  const renderedCanvas = await renderVisualPng();
  if (!renderedCanvas) return;

  const link = document.createElement("a");
  link.href = renderedCanvas.toDataURL("image/png");
  link.download = "post.png";
  link.click();
}

async function shareVisualImage() {
  const renderedCanvas = await renderVisualPng();
  if (!renderedCanvas) return;

  renderedCanvas.toBlob(async (blob) => {
    if (!blob) return;

    const file = new File([blob], "post.png", { type: "image/png" });
    if (navigator.share && navigator.canShare?.({ files: [file] })) {
      await navigator.share({ files: [file] });
      return;
    }

    if (navigator.clipboard && window.ClipboardItem) {
      await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
      alert("Image copiee !");
      return;
    }

    alert("Le partage n'est pas disponible sur ce navigateur.");
  }, "image/png");
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

canvas.addEventListener("input", (event) => {
  const item = event.target.closest(".text-item");
  if (item) syncTextEditControl(item);
});

canvas.addEventListener("click", (event) => {
  const item = event.target.closest(".canvas-item, .model-layer");
  if (item) selectItem(item);
});

modelInput.addEventListener("change", () => {
  const file = modelInput.files[0];
  if (file) readModelFile(file);
});
addTextButton.addEventListener("click", () => createTextItem());
addImageButton.addEventListener("click", () => createImageItem());
fillImageButton.addEventListener("click", () => {
  if (selectedItem?.classList.contains("image-item")) {
    disableImageImportControl(selectedItem);
    imageFillInput.click();
  }
});
clearImageButton.addEventListener("click", clearImageContent);
imageFillInput.addEventListener("change", () => {
  const file = imageFillInput.files[0];
  if (file) readImageFillFile(file, selectedItem, "left");
});
addShapeButton.addEventListener("click", () => createShapeItem());
deleteButton.addEventListener("click", () => {
  if (!selectedItem) return;

  const itemToRemove = selectedItem;
  selectItem(null);
  removeImageImportControl(itemToRemove);
  removeTextEditControl(itemToRemove);
  itemToRemove.remove();
});
downloadButton.addEventListener("click", downloadCanvasCode);
btnExport.addEventListener("click", exportVisualImage);
btnShare.addEventListener("click", shareVisualImage);

btnRecadrer.addEventListener("click", openRecadrage);
btnClearModel.addEventListener("click", () => {
  const model = getModelLayer();
  if (!model) return;
  if (selectedItem === model) selectItem(null);
  model.remove();
  btnRecadrer.disabled = true;
  btnClearModel.disabled = true;
  modelInput.value = "";
});
btnAnnulerRecadrage.addEventListener("click", closeRecadrage);
btnValiderRecadrage.addEventListener("click", validateRecadrage);

recadrageZoomSlider.addEventListener("input", () => {
  recadragePreview.dataset.zoom = recadrageZoomSlider.value;
  applyModelPosition(recadragePreview);
});

recadragePreview.addEventListener("pointerdown", (event) => {
  recadrageDrag = {
    startX: event.clientX,
    startY: event.clientY,
    startModelX: Number(recadragePreview.dataset.modelX || 50),
    startModelY: Number(recadragePreview.dataset.modelY || 50),
  };
  recadragePreview.setPointerCapture(event.pointerId);
});

recadragePreview.addEventListener("pointermove", moveCropPreview);
recadragePreview.addEventListener("pointerup", () => {
  recadrageDrag = null;
});

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
renderEmptyImageImports();
createTextEditControl(canvas.querySelector(".text-item"));
renderEmptyTextEdits();
