document.addEventListener('DOMContentLoaded', function() {

// ========== Ініціалізація карти ==========
function createCustomIcon() {
    return L.divIcon({
        html: `<div style="width: 20px; height: 20px; background: white; border-radius: 50%; border: 2px solid black;"></div>`,
        className: 'custom-marker',
        iconSize: [20, 20],
        iconAnchor: [10, 10]
    });
}

var map = L.map('map').setView([48.3794, 31.1656], 6);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© OpenStreetMap'
}).addTo(map);

// Кастомна лінійка масштабу
const scaleBar = document.getElementById('customScaleBar');
function updateScaleBar() {
    if (!map) return;
    const center = map.getCenter();
    const point1 = map.latLngToContainerPoint(center);
    const point2 = L.point(point1.x + 100, point1.y);
    const latLng2 = map.containerPointToLatLng(point2);
    const distance = map.distance(center, latLng2);
    const metersPerPixel = distance / 100;
    const barLengthPx = 200;
    const barLengthM = metersPerPixel * barLengthPx;
    let niceLength = 10;
    if (barLengthM > 1000) niceLength = 1000;
    else if (barLengthM > 500) niceLength = 500;
    else if (barLengthM > 200) niceLength = 200;
    else if (barLengthM > 100) niceLength = 100;
    else if (barLengthM > 50) niceLength = 50;
    else if (barLengthM > 20) niceLength = 20;
    else niceLength = 10;
    const actualPx = niceLength / metersPerPixel;
    scaleBar.style.width = actualPx + 'px';
    scaleBar.textContent = niceLength + ' м';
    scaleBar.style.backgroundColor = '#000000';
    scaleBar.style.color = '#FFFFFF';
    scaleBar.style.border = '1px solid #FFFFFF';
    scaleBar.style.padding = '2px 4px';
    scaleBar.style.borderRadius = '4px';
}
map.on('move', updateScaleBar);
updateScaleBar();

// Маркери
var marker1, marker2, selectionRect;
var markerCount = 0;
var tempCorner = null;

// Для перетягування прямокутника
var isDraggingRect = false;
var dragStartPoint, dragStartLatLng1, dragStartLatLng2;

// Дані для підказки та накладання
var currentGrid = null;          // оригінальна нормалізована сітка
var currentNx = null, currentNy = null;
var currentMinEl = null, currentMaxEl = null;
var currentBounds = null;
var currentContours = null;      // контури для оверлею (завжди на основі оригінальної сітки)
var contourLayer = null;

// Gradient Ramp variables
var leftPos = 0.0;
var rightPos = 1.0;
var leftColor = '#000000';
var rightColor = '#ffffff';

// DOM elements
const gradientRamp = document.getElementById('gradientRamp');
const rampBar = document.getElementById('gradientRampBar');
const leftHandle = document.getElementById('gradientRampLeftHandle');
const rightHandle = document.getElementById('gradientRampRightHandle');

// Legend
const legendBar = document.getElementById('legendGradientBar');
const colorMin = document.getElementById('colorMin');
const colorMid = document.getElementById('colorMid');
const colorMax = document.getElementById('colorMax');

// Drag state
let activeHandle = null;
let dragStartX = 0;
let startPos = 0;
let wasDragged = false;
const DRAG_THRESHOLD = 5;

// ========== Функції для градієнта ==========
function updateRampBar() {
    const pos1 = leftPos;
    const pos2 = rightPos;
    const col1 = leftColor;
    const col2 = rightColor;
    const left = Math.min(pos1, pos2);
    const right = Math.max(pos1, pos2);
    const colorLeft = pos1 < pos2 ? col1 : col2;
    const colorRight = pos1 < pos2 ? col2 : col1;
    rampBar.style.background = `linear-gradient(to right, ${colorLeft} ${left*100}%, ${colorRight} ${right*100}%)`;
}

function updateHandlePositions() {
    leftHandle.style.left = (leftPos * 100) + '%';
    rightHandle.style.left = (rightPos * 100) + '%';
}

function updateHandleColors() {
    leftHandle.style.backgroundColor = leftColor;
    rightHandle.style.backgroundColor = rightColor;
}

function updateLegend() {
    const pos1 = leftPos;
    const pos2 = rightPos;
    const col1 = leftColor;
    const col2 = rightColor;
    const left = Math.min(pos1, pos2);
    const right = Math.max(pos1, pos2);
    const colorLeft = pos1 < pos2 ? col1 : col2;
    const colorRight = pos1 < pos2 ? col2 : col1;
    legendBar.style.background = `linear-gradient(to right, ${colorLeft} ${left*100}%, ${colorRight} ${right*100}%)`;
}

// Initialize ramp
updateRampBar();
updateHandlePositions();
updateHandleColors();
updateLegend();

// ========== Pickr ==========
const leftPickr = Pickr.create({
    el: leftHandle,
    useAsButton: true,
    theme: 'classic',
    default: leftColor,
    position: 'bottom-start',
    adjustableNumbers: true,
    comparison: false,
    components: {
        preview: true,
        opacity: false,
        hue: true,
        interaction: {
            hex: true,
            rgba: true,
            hsla: false,
            hsva: false,
            cmyk: false,
            input: true,
            clear: true,
            save: false
        }
    },
    i18n: {
        'ui:dialog': 'Вибір кольору',
        'btn:clear': 'Очистити',
    }
});

const rightPickr = Pickr.create({
    el: rightHandle,
    useAsButton: true,
    theme: 'classic',
    default: rightColor,
    position: 'bottom-end',
    adjustableNumbers: true,
    comparison: false,
    components: {
        preview: true,
        opacity: false,
        hue: true,
        interaction: {
            hex: true,
            rgba: true,
            hsla: false,
            hsva: false,
            cmyk: false,
            input: true,
            clear: true,
            save: false
        }
    },
    i18n: {
        'ui:dialog': 'Вибір кольору',
        'btn:clear': 'Очистити',
    }
});

function hexToRgb(hex) {
    const r = parseInt(hex.slice(1,3), 16);
    const g = parseInt(hex.slice(3,5), 16);
    const b = parseInt(hex.slice(5,7), 16);
    return { r, g, b };
}

function getRampColor(t) {
    const pos1 = leftPos;
    const pos2 = rightPos;
    const col1 = leftColor;
    const col2 = rightColor;
    const left = Math.min(pos1, pos2);
    const right = Math.max(pos1, pos2);
    const colorLeft = pos1 < pos2 ? col1 : col2;
    const colorRight = pos1 < pos2 ? col2 : col1;
    if (t <= left) return colorLeft;
    if (t >= right) return colorRight;
    const factor = (t - left) / (right - left);
    const low = hexToRgb(colorLeft);
    const high = hexToRgb(colorRight);
    const r = Math.round(low.r + (high.r - low.r) * factor);
    const g = Math.round(low.g + (high.g - low.g) * factor);
    const b = Math.round(low.b + (high.b - low.b) * factor);
    return `rgb(${r},${g},${b})`;
}

// ========== Алгоритм згладжування Chaikin (без петель) ==========
function chaikinSmooth(points, iterations) {
    if (points.length < 3) return points;
    let result = points.slice();
    for (let iter = 0; iter < iterations; iter++) {
        const newPoints = [];
        // Для замкненої кривої потрібно обробляти першу та останню точки разом
        // Ми не знаємо, чи замкнена тут, тому обробляємо як відкриту
        for (let i = 0; i < result.length - 1; i++) {
            const p0 = result[i];
            const p1 = result[i + 1];
            const q = { x: 0.75 * p0.x + 0.25 * p1.x, y: 0.75 * p0.y + 0.25 * p1.y };
            const r = { x: 0.25 * p0.x + 0.75 * p1.x, y: 0.25 * p0.y + 0.75 * p1.y };
            newPoints.push(q, r);
        }
        // Додаємо останню точку (для відкритої кривої)
        newPoints.push(result[result.length - 1]);
        result = newPoints;
    }
    return result;
}

// Для замкнених кривих потрібна окрема обробка: додаємо першу точку в кінець, обробляємо, потім видаляємо зайве
function chaikinSmoothClosed(points, iterations) {
    if (points.length < 3) return points;
    // Додаємо першу точку в кінець, щоб замкнути
    let extended = points.concat([points[0]]);
    for (let iter = 0; iter < iterations; iter++) {
        const newPoints = [];
        for (let i = 0; i < extended.length - 1; i++) {
            const p0 = extended[i];
            const p1 = extended[i + 1];
            const q = { x: 0.75 * p0.x + 0.25 * p1.x, y: 0.75 * p0.y + 0.25 * p1.y };
            const r = { x: 0.25 * p0.x + 0.75 * p1.x, y: 0.25 * p0.y + 0.75 * p1.y };
            newPoints.push(q, r);
        }
        // Остання точка не потрібна, тому що замкнено
        extended = newPoints;
    }
    // Видаляємо зайві точки (перша і остання дублюються)
    // Результат має бути замкненим, тому повертаємо всі крім останньої
    return extended.slice(0, -1);
}

// ========== Функція для обчислення площі замкненого контуру ==========
function polygonArea(points) {
    let area = 0;
    const n = points.length;
    for (let i = 0; i < n; i++) {
        const j = (i + 1) % n;
        area += points[i].x * points[j].y;
        area -= points[j].x * points[i].y;
    }
    return Math.abs(area) / 2;
}

// ========== Перемалювання з урахуванням згладжування ==========
function redrawCurrentMode() {
    const mode = selectedDisplay.textContent.includes('Linear') ? 'contour' :
                 selectedDisplay.textContent.includes('Displacement') ? 'displacement' : 'clear';
    if (!currentGrid || !currentBounds) return;
    
    const smoothValue = parseFloat(smoothnessInput.value);
    const iterations = Math.round(smoothValue * 2); // 0,2,4,6 для smoothValue 0..3
    const useCurve = iterations > 0;
    
    if (mode === 'contour') {
        // Трансформація сітки за допомогою контрастного розтягу
        const transformed = [];
        for (let y = 0; y < currentNy; y++) {
            const row = [];
            for (let x = 0; x < currentNx; x++) {
                let t = currentGrid[y][x];
                let t2 = (t - leftPos) / (rightPos - leftPos);
                t2 = Math.max(0, Math.min(1, t2));
                row.push(t2);
            }
            transformed.push(row);
        }
        const flat = transformed.flat();
        const levels = parseInt(levelsInput.value);
        const thresholds = d3.range(levels).map(i => i / (levels - 1));
        const contours = d3.contours()
            .size([currentNx, currentNy])
            .thresholds(thresholds)
            (flat);
        
        const svg = document.getElementById('contourSVG');
        svg.innerHTML = '';
        const width = 400, height = 400;
        let pathCount = 0;
        const minArea = 50;          // мінімальна площа для замкнених контурів
        const minPoints = 8;          // мінімальна кількість точок
        
        contours.forEach(contour => {
            const threshold = contour.value;
            const origT = leftPos + threshold * (rightPos - leftPos);
            const color = getRampColor(origT);
            
            contour.coordinates.forEach(polygon => {
                polygon.forEach(ring => {
                    if (!ring || ring.length < minPoints) return;
                    
                    // Масштабуємо точки до розміру SVG
                    let points = ring.map(p => ({
                        x: (p[0] / currentNx) * width,
                        y: (1 - p[1] / currentNy) * height
                    }));
                    
                    // Перевіряємо замкненість
                    const first = points[0];
                    const last = points[points.length - 1];
                    const closed = Math.hypot(first.x - last.x, first.y - last.y) < 1;
                    
                    if (closed) {
                        const area = polygonArea(points);
                        if (area < minArea) return; // пропускаємо дрібні петлі
                    }
                    
                    let finalPoints = points;
                    if (useCurve) {
                        if (closed) {
                            finalPoints = chaikinSmoothClosed(points, iterations);
                        } else {
                            finalPoints = chaikinSmooth(points, iterations);
                        }
                    }
                    
                    // Будуємо шлях
                    let d = `M ${finalPoints[0].x} ${finalPoints[0].y}`;
                    for (let i = 1; i < finalPoints.length; i++) {
                        d += ` L ${finalPoints[i].x} ${finalPoints[i].y}`;
                    }
                    if (closed) d += ' Z';
                    
                    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
                    path.setAttribute('d', d);
                    path.setAttribute('fill', 'none');
                    path.setAttribute('stroke', color);
                    path.setAttribute('stroke-width', parseFloat(lineWidthInput.value));
                    svg.appendChild(path);
                    pathCount++;
                });
            });
        });
        console.log(`Додано path: ${pathCount} (згладжування Chaikin: ${iterations} ітерацій)`);
    } else if (mode === 'displacement') {
        renderDisplacement(currentGrid, currentNx, currentNy);
    } else if (mode === 'clear') {
        const exportSize = exportResolutions[parseInt(exportResInput.value)];
        renderClearMap(currentBounds, exportSize);
    }
}

// Рендеринг Displacement з високоякісною інтерполяцією
function renderDisplacement(grid, nx, ny) {
    const svg = document.getElementById('contourSVG');
    svg.innerHTML = '';
    const width = 400, height = 400;

    const pos1 = leftPos;
    const pos2 = rightPos;
    const col1 = leftColor;
    const col2 = rightColor;
    const left = Math.min(pos1, pos2);
    const right = Math.max(pos1, pos2);
    const colorLeft = pos1 < pos2 ? col1 : col2;
    const colorRight = pos1 < pos2 ? col2 : col1;

    const low = hexToRgb(colorLeft);
    const high = hexToRgb(colorRight);
    const lowPosVal = left;
    const highPosVal = right;

    // Canvas високої роздільної здатності (1024x1024)
    const targetSize = 1024;
    const canvas = document.createElement('canvas');
    canvas.width = targetSize;
    canvas.height = targetSize;
    const ctx = canvas.getContext('2d');
    const imageData = ctx.createImageData(targetSize, targetSize);
    
    for (let y = 0; y < targetSize; y++) {
        const origY = (y / targetSize) * ny;
        const y1 = Math.floor(origY);
        const y2 = Math.min(ny-1, y1 + 1);
        const wy = origY - y1;
        
        for (let x = 0; x < targetSize; x++) {
            const origX = (x / targetSize) * nx;
            const x1 = Math.floor(origX);
            const x2 = Math.min(nx-1, x1 + 1);
            const wx = origX - x1;
            
            const v00 = grid[ny-1 - y1][x1];
            const v01 = grid[ny-1 - y1][x2];
            const v10 = grid[ny-1 - y2][x1];
            const v11 = grid[ny-1 - y2][x2];
            
            const v0 = v00 * (1 - wx) + v01 * wx;
            const v1 = v10 * (1 - wx) + v11 * wx;
            const val = v0 * (1 - wy) + v1 * wy;
            
            let r, g, b;
            if (val <= lowPosVal) {
                r = low.r; g = low.g; b = low.b;
            } else if (val >= highPosVal) {
                r = high.r; g = high.g; b = high.b;
            } else {
                const t = (val - lowPosVal) / (highPosVal - lowPosVal);
                r = Math.round(low.r + (high.r - low.r) * t);
                g = Math.round(low.g + (high.g - low.g) * t);
                b = Math.round(low.b + (high.b - low.b) * t);
            }
            
            const idx = (y * targetSize + x) * 4;
            imageData.data[idx] = r;
            imageData.data[idx+1] = g;
            imageData.data[idx+2] = b;
            imageData.data[idx+3] = 255;
        }
    }
    ctx.putImageData(imageData, 0, 0);

    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = width;
    tempCanvas.height = height;
    const tempCtx = tempCanvas.getContext('2d');
    tempCtx.imageSmoothingEnabled = true;
    tempCtx.imageSmoothingQuality = 'high';
    tempCtx.drawImage(canvas, 0, 0, width, height);
    
    const dataURL = tempCanvas.toDataURL('image/png');
    const image = document.createElementNS('http://www.w3.org/2000/svg', 'image');
    image.setAttribute('href', dataURL);
    image.setAttribute('x', 0);
    image.setAttribute('y', 0);
    image.setAttribute('width', width);
    image.setAttribute('height', height);
    svg.appendChild(image);
}

function renderClearMap(bounds, exportSize) {
    const svg = document.getElementById('contourSVG');
    svg.innerHTML = '';
    const width = 400, height = 400;
    const { minLon, maxLon, minLat, maxLat } = bounds;
    const finalSize = Math.min(exportSize, 1024);
    const url = `https://staticmap.openstreetmap.de/staticmap.php?bbox=${minLon},${minLat},${maxLon},${maxLat}&size=${finalSize}x${finalSize}&maptype=mapnik`;
    const image = document.createElementNS('http://www.w3.org/2000/svg', 'image');
    image.setAttribute('href', url);
    image.setAttribute('x', 0);
    image.setAttribute('y', 0);
    image.setAttribute('width', width);
    image.setAttribute('height', height);
    image.setAttribute('preserveAspectRatio', 'none');
    image.addEventListener('error', function() {
        svg.innerHTML = '';
        const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
        rect.setAttribute('x', 0);
        rect.setAttribute('y', 0);
        rect.setAttribute('width', width);
        rect.setAttribute('height', height);
        rect.setAttribute('fill', '#1B1B1B');
        svg.appendChild(rect);
        const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        text.setAttribute('x', width/2);
        text.setAttribute('y', height/2 - 20);
        text.setAttribute('fill', '#FFFFFF');
        text.setAttribute('font-size', '14');
        text.setAttribute('text-anchor', 'middle');
        text.textContent = 'Clear map недоступна';
        svg.appendChild(text);
        const text2 = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        text2.setAttribute('x', width/2);
        text2.setAttribute('y', height/2 + 10);
        text2.setAttribute('fill', '#AAAAAA');
        text2.setAttribute('font-size', '12');
        text2.setAttribute('text-anchor', 'middle');
        text2.textContent = 'Спробуйте інший тип мапи';
        svg.appendChild(text2);
        console.warn('Clear map: статичний сервіс недоступний.');
    });
    svg.appendChild(image);
}

// ========== Логіка дропдауну ==========
const selectedDisplay = document.getElementById('displayModeSelected');
const optionsContainer = document.getElementById('displayModeOptions');
const options = document.querySelectorAll('.display-mode-option');
const exportButtons = document.querySelectorAll('.export-btn');

updateDisplayByMode('contour');

document.addEventListener('click', function(e) {
    if (!e.target.closest('.display-mode-selector')) {
        optionsContainer.classList.remove('show');
    }
});

selectedDisplay.addEventListener('click', function(e) {
    e.stopPropagation();
    optionsContainer.classList.toggle('show');
});

options.forEach(opt => {
    opt.addEventListener('click', function(e) {
        e.stopPropagation();
        const value = this.dataset.value;
        const text = this.textContent;
        selectedDisplay.textContent = text;
        optionsContainer.classList.remove('show');
        updateDisplayByMode(value);
    });
});

function updateDisplayByMode(mode) {
    exportButtons.forEach(btn => {
        const btnMode = btn.dataset.mode;
        if (mode === 'contour') {
            if (btnMode === 'contour' || btnMode === 'both') btn.classList.remove('hidden');
            else btn.classList.add('hidden');
        } else {
            if (btnMode === 'raster' || btnMode === 'both') btn.classList.remove('hidden');
            else btn.classList.add('hidden');
        }
    });
    if (!currentGrid || !currentBounds) return;
    redrawCurrentMode();
}

// ========== Обробники подій для Gradient Ramp ==========
leftPickr.on('change', () => {
    leftColor = leftPickr.getColor().toHEXA().toString();
    updateHandleColors();
    updateRampBar();
    updateLegend();
    redrawCurrentMode();
});
leftPickr.on('clear', () => {
    leftColor = '#000000';
    updateHandleColors();
    updateRampBar();
    updateLegend();
    redrawCurrentMode();
});

rightPickr.on('change', () => {
    rightColor = rightPickr.getColor().toHEXA().toString();
    updateHandleColors();
    updateRampBar();
    updateLegend();
    redrawCurrentMode();
});
rightPickr.on('clear', () => {
    rightColor = '#ffffff';
    updateHandleColors();
    updateRampBar();
    updateLegend();
    redrawCurrentMode();
});

leftHandle.addEventListener('click', (e) => {
    if (wasDragged) {
        e.preventDefault();
        e.stopPropagation();
        wasDragged = false;
        return;
    }
    leftPickr.show();
});

rightHandle.addEventListener('click', (e) => {
    if (wasDragged) {
        e.preventDefault();
        e.stopPropagation();
        wasDragged = false;
        return;
    }
    rightPickr.show();
});

function onMouseDown(e, handle) {
    e.preventDefault();
    activeHandle = handle;
    dragStartX = e.clientX;
    startPos = handle === 'left' ? leftPos : rightPos;
    wasDragged = false;
    if (leftPickr.isOpen()) leftPickr.hide();
    if (rightPickr.isOpen()) rightPickr.hide();
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
}

function onMouseMove(e) {
    if (!activeHandle) return;
    if (!wasDragged && Math.abs(e.clientX - dragStartX) > DRAG_THRESHOLD) {
        wasDragged = true;
    }
    const rect = rampBar.getBoundingClientRect();
    const offsetX = e.clientX - rect.left;
    let newPos = Math.max(0, Math.min(1, offsetX / rect.width));
    if (activeHandle === 'left') {
        leftPos = newPos;
    } else {
        rightPos = newPos;
    }
    updateHandlePositions();
    updateRampBar();
    updateLegend();
    redrawCurrentMode();
}

function onMouseUp(e) {
    document.removeEventListener('mousemove', onMouseMove);
    document.removeEventListener('mouseup', onMouseUp);
    activeHandle = null;
}

leftHandle.addEventListener('mousedown', (e) => onMouseDown(e, 'left'));
rightHandle.addEventListener('mousedown', (e) => onMouseDown(e, 'right'));

// ========== Інші функції ==========
function showError(message) {
    var toast = document.getElementById('errorToast');
    var msgSpan = document.getElementById('errorMessage');
    msgSpan.textContent = message;
    toast.classList.add('show');
    setTimeout(function() {
        toast.classList.remove('show');
    }, 5000);
}

function computeSquareCornerPixel(anchorPoint, targetPoint) {
    var dx = targetPoint.x - anchorPoint.x;
    var dy = targetPoint.y - anchorPoint.y;
    var side = Math.max(Math.abs(dx), Math.abs(dy));
    var signX = dx >= 0 ? 1 : -1;
    var signY = dy >= 0 ? 1 : -1;
    return {
        x: anchorPoint.x + signX * side,
        y: anchorPoint.y + signY * side
    };
}

function updateRectangle() {
    if (!marker1 || !marker2) return;
    var latlng1 = marker1.getLatLng();
    var latlng2 = marker2.getLatLng();
    if (selectionRect) map.removeLayer(selectionRect);
    var bounds = L.latLngBounds([latlng1.lat, latlng1.lng], [latlng2.lat, latlng2.lng]);
    selectionRect = L.rectangle(bounds, {
        color: '#000000',
        weight: 2,
        fillColor: '#000000',
        fillOpacity: 0.2,
        interactive: true
    }).addTo(map);

    selectionRect.on('mousedown', function(e) {
        isDraggingRect = true;
        dragStartPoint = map.mouseEventToContainerPoint(e.originalEvent);
        dragStartLatLng1 = marker1.getLatLng();
        dragStartLatLng2 = marker2.getLatLng();
        map.dragging.disable();
    });
}

map.on('mousemove', function(e) {
    if (!isDraggingRect) return;
    var currentPoint = map.mouseEventToContainerPoint(e.originalEvent);
    var deltaX = currentPoint.x - dragStartPoint.x;
    var deltaY = currentPoint.y - dragStartPoint.y;

    var newPos1 = map.latLngToContainerPoint(dragStartLatLng1).add(L.point(deltaX, deltaY));
    var newPos2 = map.latLngToContainerPoint(dragStartLatLng2).add(L.point(deltaX, deltaY));

    var newLatLng1 = map.containerPointToLatLng(newPos1);
    var newLatLng2 = map.containerPointToLatLng(newPos2);

    marker1.setLatLng(newLatLng1);
    marker2.setLatLng(newLatLng2);

    document.getElementById('lat1').value = newLatLng1.lat.toFixed(5);
    document.getElementById('lon1').value = newLatLng1.lng.toFixed(5);
    document.getElementById('lat2').value = newLatLng2.lat.toFixed(5);
    document.getElementById('lon2').value = newLatLng2.lng.toFixed(5);

    updateRectangle();
    updateDimensionStats();
});

map.on('mouseup', function(e) {
    if (isDraggingRect) {
        isDraggingRect = false;
        map.dragging.enable();
    }
});

map.on('click', function(e) {
    if (markerCount === 0) {
        marker1 = L.marker(e.latlng, { icon: createCustomIcon(), draggable: true }).addTo(map);
        marker1.on('drag', function() {
            var current = marker1.getLatLng();
            if (!marker2) {
                document.getElementById('lat1').value = current.lat.toFixed(5);
                document.getElementById('lon1').value = current.lng.toFixed(5);
                return;
            } else {
                var anchorPoint = map.latLngToLayerPoint(marker2.getLatLng());
                var currentPoint = map.latLngToLayerPoint(current);
                var constrainedPoint = computeSquareCornerPixel(anchorPoint, currentPoint);
                var constrainedLatLng = map.layerPointToLatLng(constrainedPoint);
                marker1.setLatLng(constrainedLatLng);
                document.getElementById('lat1').value = constrainedLatLng.lat.toFixed(5);
                document.getElementById('lon1').value = constrainedLatLng.lng.toFixed(5);
                updateRectangle();
            }
        });
        document.getElementById('lat1').value = e.latlng.lat.toFixed(5);
        document.getElementById('lon1').value = e.latlng.lng.toFixed(5);
        markerCount = 1;
    } else if (markerCount === 1) {
        var anchorPoint = map.latLngToLayerPoint(marker1.getLatLng());
        var targetPoint = map.latLngToLayerPoint(e.latlng);
        var corner;
        if (tempCorner) {
            corner = tempCorner;
        } else {
            var constrainedPoint = computeSquareCornerPixel(anchorPoint, targetPoint);
            corner = map.layerPointToLatLng(constrainedPoint);
        }
        if (marker2) map.removeLayer(marker2);
        marker2 = L.marker(corner, { icon: createCustomIcon(), draggable: true }).addTo(map);

        marker2.on('drag', function() {
            var current = marker2.getLatLng();
            var anchorPoint = map.latLngToLayerPoint(marker1.getLatLng());
            var currentPoint = map.latLngToLayerPoint(current);
            var constrainedPoint = computeSquareCornerPixel(anchorPoint, currentPoint);
            var constrainedLatLng = map.layerPointToLatLng(constrainedPoint);
            marker2.setLatLng(constrainedLatLng);
            document.getElementById('lat2').value = constrainedLatLng.lat.toFixed(5);
            document.getElementById('lon2').value = constrainedLatLng.lng.toFixed(5);
            updateRectangle();
        });

        document.getElementById('lat2').value = corner.lat.toFixed(5);
        document.getElementById('lon2').value = corner.lng.toFixed(5);
        markerCount = 2;
        updateRectangle();
        tempCorner = null;
    }
});

map.on('mousemove', function(e) {
    if (markerCount === 1 && !marker2) {
        var anchorPoint = map.latLngToLayerPoint(marker1.getLatLng());
        var targetPoint = map.latLngToLayerPoint(e.latlng);
        var constrainedPoint = computeSquareCornerPixel(anchorPoint, targetPoint);
        var corner = map.layerPointToLatLng(constrainedPoint);
        tempCorner = corner;
        if (selectionRect) map.removeLayer(selectionRect);
        var bounds = L.latLngBounds([marker1.getLatLng().lat, marker1.getLatLng().lng], [corner.lat, corner.lng]);
        selectionRect = L.rectangle(bounds, {
            color: '#000000',
            weight: 2,
            fillColor: '#000000',
            fillOpacity: 0.2,
            interactive: true
        }).addTo(map);
        selectionRect.on('mousedown', function(e) {
            isDraggingRect = true;
            dragStartPoint = map.mouseEventToContainerPoint(e.originalEvent);
            dragStartLatLng1 = marker1.getLatLng();
            dragStartLatLng2 = corner;
            map.dragging.disable();
        });
    }
});

document.getElementById('clearMarkersBtn').addEventListener('click', function() {
    if (marker1) map.removeLayer(marker1);
    if (marker2) map.removeLayer(marker2);
    if (selectionRect) map.removeLayer(selectionRect);
    if (contourLayer) map.removeLayer(contourLayer);
    marker1 = null; marker2 = null; selectionRect = null; markerCount = 0;
    tempCorner = null;
    document.getElementById('lat1').value = ''; document.getElementById('lon1').value = '';
    document.getElementById('lat2').value = ''; document.getElementById('lon2').value = '';
    document.getElementById('statWidth').textContent = '—';
    document.getElementById('statHeight').textContent = '—';
    document.getElementById('statArea').textContent = '—';
});

document.getElementById('useMapExtent').addEventListener('click', function() {
    var center = map.getCenter();
    var centerPoint = map.latLngToContainerPoint(center);
    var size = Math.min(map.getSize().x, map.getSize().y) / 2;
    var nwPoint = L.point(centerPoint.x - size, centerPoint.y - size);
    var sePoint = L.point(centerPoint.x + size, centerPoint.y + size);
    var nw = map.containerPointToLatLng(nwPoint);
    var se = map.containerPointToLatLng(sePoint);

    if (marker1) map.removeLayer(marker1);
    if (marker2) map.removeLayer(marker2);
    if (selectionRect) map.removeLayer(selectionRect);
    if (contourLayer) map.removeLayer(contourLayer);

    marker1 = L.marker(nw, { icon: createCustomIcon(), draggable: true }).addTo(map);
    marker2 = L.marker(se, { icon: createCustomIcon(), draggable: true }).addTo(map);

    marker1.on('drag', function() {
        var current = marker1.getLatLng();
        if (!marker2) return;
        var anchorPoint = map.latLngToLayerPoint(marker2.getLatLng());
        var currentPoint = map.latLngToLayerPoint(current);
        var constrainedPoint = computeSquareCornerPixel(anchorPoint, currentPoint);
        var constrainedLatLng = map.layerPointToLatLng(constrainedPoint);
        marker1.setLatLng(constrainedLatLng);
        document.getElementById('lat1').value = constrainedLatLng.lat.toFixed(5);
        document.getElementById('lon1').value = constrainedLatLng.lng.toFixed(5);
        updateRectangle();
    });

    marker2.on('drag', function() {
        var current = marker2.getLatLng();
        if (!marker1) return;
        var anchorPoint = map.latLngToLayerPoint(marker1.getLatLng());
        var currentPoint = map.latLngToLayerPoint(current);
        var constrainedPoint = computeSquareCornerPixel(anchorPoint, currentPoint);
        var constrainedLatLng = map.layerPointToLatLng(constrainedPoint);
        marker2.setLatLng(constrainedLatLng);
        document.getElementById('lat2').value = constrainedLatLng.lat.toFixed(5);
        document.getElementById('lon2').value = constrainedLatLng.lng.toFixed(5);
        updateRectangle();
    });

    document.getElementById('lat1').value = nw.lat.toFixed(5);
    document.getElementById('lon1').value = nw.lng.toFixed(5);
    document.getElementById('lat2').value = se.lat.toFixed(5);
    document.getElementById('lon2').value = se.lng.toFixed(5);
    markerCount = 2;
    updateRectangle();
});

document.getElementById('searchBtn').addEventListener('click', async function() {
    var query = document.getElementById('searchInput').value.trim();
    var errorDiv = document.getElementById('searchError');
    errorDiv.textContent = '';
    if (!query) return;

    try {
        var response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=1`);
        var data = await response.json();
        if (data && data.length > 0) {
            var lat = parseFloat(data[0].lat);
            var lon = parseFloat(data[0].lon);
            map.setView([lat, lon], 12);
        } else {
            errorDiv.textContent = 'Місце не знайдено. Спробуйте точніше (наприклад, "Дніпро, Україна")';
        }
    } catch (e) {
        errorDiv.textContent = 'Помилка пошуку. Спробуйте пізніше.';
    }
});

// ========== Слайдери ==========
var resolutionInput = document.getElementById('resolution');
var resVal = document.getElementById('resVal');
resolutionInput.addEventListener('input', function(e) {
    resVal.textContent = e.target.value;
});
resVal.textContent = resolutionInput.value;

var lineWidthInput = document.getElementById('lineWidth');
var lineWidthVal = document.getElementById('lineWidthVal');
lineWidthInput.addEventListener('input', function(e) {
    lineWidthVal.textContent = parseFloat(e.target.value).toFixed(1);
});
lineWidthVal.textContent = lineWidthInput.value;

var smoothnessInput = document.getElementById('smoothness');
var smoothVal = document.getElementById('smoothVal');
smoothnessInput.addEventListener('input', function(e) {
    smoothVal.textContent = e.target.value;
    redrawCurrentMode();
});
smoothVal.textContent = smoothnessInput.value;

var levelsInput = document.getElementById('levels');
var levelsVal = document.getElementById('levelsVal');
levelsInput.addEventListener('input', function(e) {
    levelsVal.textContent = e.target.value;
    redrawCurrentMode();
});
levelsVal.textContent = levelsInput.value;

var exportResInput = document.getElementById('exportResolution');
var exportResVal = document.getElementById('exportResVal');
var exportResolutions = [512, 1024, 2048, 4096, 8192];
function updateExportResLabel() {
    var idx = parseInt(exportResInput.value);
    var size = exportResolutions[idx];
    exportResVal.textContent = size + 'x' + size;
}
exportResInput.addEventListener('input', updateExportResLabel);
updateExportResLabel();

// ========== Накладання контурів на карту ==========
function addContourOverlay(contours, bounds, nx, ny) {
    if (contourLayer) map.removeLayer(contourLayer);
    var features = [];
    contours.forEach(contour => {
        contour.coordinates.forEach(polygon => {
            polygon.forEach(ring => {
                if (ring.length < 2) return;
                var latlngs = ring.map(p => {
                    var lon = bounds.minLon + (bounds.maxLon - bounds.minLon) * (p[0] / nx);
                    var lat = bounds.minLat + (bounds.maxLat - bounds.minLat) * (p[1] / ny);
                    return [lat, lon];
                });
                features.push({
                    type: 'Feature',
                    geometry: {
                        type: 'LineString',
                        coordinates: latlngs.map(ll => [ll[1], ll[0]])
                    }
                });
            });
        });
    });
    if (features.length > 0) {
        contourLayer = L.geoJSON({
            type: 'FeatureCollection',
            features: features
        }, {
            style: {
                color: '#000000',
                weight: 1.0,
                opacity: 0.3
            }
        }).addTo(map);
    }
}

// ========== Основна функція побудови ==========
document.getElementById('getData').addEventListener('click', async function() {
    if (!marker1 || !marker2) {
        showError('Спочатку встановіть маркери');
        return;
    }

    const btn = this;
    const originalText = btn.innerHTML;
    btn.innerHTML = '<img src="images/icon-build2.svg" alt="" style="width:20px; height:20px; margin-right:4px;"> Завантаження...';
    btn.disabled = true;

    try {
        const nx = parseInt(resolutionInput.value);
        const ny = parseInt(resolutionInput.value);
        const lineWidth = parseFloat(lineWidthInput.value);
        const levels = parseInt(levelsInput.value);

        const lat1 = marker1.getLatLng().lat, lon1 = marker1.getLatLng().lng;
        const lat2 = marker2.getLatLng().lat, lon2 = marker2.getLatLng().lng;

        const minLat = Math.min(lat1, lat2);
        const maxLat = Math.max(lat1, lat2);
        const minLon = Math.min(lon1, lon2);
        const maxLon = Math.max(lon1, lon2);

        const bounds = { minLat, maxLat, minLon, maxLon };

        const locations = [];
        for (let y = 0; y < ny; y++) {
            const lat = minLat + (maxLat - minLat) * y / (ny - 1);
            for (let x = 0; x < nx; x++) {
                const lon = minLon + (maxLon - minLon) * x / (nx - 1);
                locations.push({ latitude: lat, longitude: lon });
            }
        }
        document.getElementById('statPoints').innerText = locations.length;

        let elevations;
        try {
            const response = await fetch('https://api.open-elevation.com/api/v1/lookup', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ locations })
            });
            const data = await response.json();
            elevations = data.results.map(r => r.elevation);
        } catch (e) {
            console.error('API не працює, використовую тестові дані (пагорб)');
            showError('API не відповідає, використовуються тестові дані');
            elevations = [];
            for (let i = 0; i < locations.length; i++) {
                const x = i % nx, y = Math.floor(i / nx);
                const dx = (x - nx/2) / (nx/2);
                const dy = (y - ny/2) / (ny/2);
                const r = Math.sqrt(dx*dx + dy*dy);
                elevations.push(100 * Math.exp(-r*2) + 50);
            }
        }

        const minEl = Math.min(...elevations);
        const maxEl = Math.max(...elevations);
        document.getElementById('statMin').innerText = minEl.toFixed(1) + ' м';
        document.getElementById('statMax').innerText = maxEl.toFixed(1) + ' м';
        document.getElementById('statRange').innerText = (maxEl - minEl).toFixed(1) + ' м';

        updateColorLegend(minEl, maxEl);

        const range = maxEl - minEl || 1;
        const normalized = elevations.map(v => (v - minEl) / range);

        const grid = [];
        for (let y = 0; y < ny; y++) {
            const row = [];
            for (let x = 0; x < nx; x++) {
                row.push(normalized[y * nx + x]);
            }
            grid.push(row);
        }

        currentGrid = grid;
        currentNx = nx;
        currentNy = ny;
        currentMinEl = minEl;
        currentMaxEl = maxEl;
        currentBounds = bounds;

        const thresholds = d3.range(levels).map(i => i / (levels - 1));
        currentContours = d3.contours()
            .size([nx, ny])
            .thresholds(thresholds)
            (normalized);
        addContourOverlay(currentContours, bounds, nx, ny);

        updateDimensionStats();

        const currentMode = selectedDisplay.textContent.includes('Linear') ? 'contour' :
                            selectedDisplay.textContent.includes('Displacement') ? 'displacement' : 'clear';
        updateDisplayByMode(currentMode);

        const svg = document.getElementById('contourSVG');
        setupTooltip(svg, grid, nx, ny, minEl, maxEl);

    } catch (error) {
        console.error('Помилка:', error);
        showError('Помилка: ' + error.message);
    } finally {
        btn.innerHTML = originalText;
        btn.disabled = false;
    }
});

function updateColorLegend(minVal, maxVal) {
    colorMin.textContent = minVal.toFixed(1) + ' м';
    colorMid.textContent = ((minVal + maxVal) / 2).toFixed(1) + ' м';
    colorMax.textContent = maxVal.toFixed(1) + ' м';
}

function computeDimensions(lat1, lon1, lat2, lon2) {
    const R = 6371000;
    const lat1r = lat1 * Math.PI / 180;
    const lat2r = lat2 * Math.PI / 180;
    const lon1r = lon1 * Math.PI / 180;
    const lon2r = lon2 * Math.PI / 180;
    const dLat = Math.abs(lat1r - lat2r);
    const dLon = Math.abs(lon1r - lon2r);
    const height = R * dLat;
    const width = R * dLon * Math.cos((lat1r + lat2r) / 2);
    const area = width * height;
    return { width, height, area };
}

function updateDimensionStats() {
    if (!marker1 || !marker2) return;
    const lat1 = marker1.getLatLng().lat;
    const lon1 = marker1.getLatLng().lng;
    const lat2 = marker2.getLatLng().lat;
    const lon2 = marker2.getLatLng().lng;
    const { width, height, area } = computeDimensions(lat1, lon1, lat2, lon2);
    document.getElementById('statWidth').textContent = width.toFixed(0) + ' м';
    document.getElementById('statHeight').textContent = height.toFixed(0) + ' м';
    document.getElementById('statArea').textContent = (area / 10000).toFixed(1) + ' га';
}

function setupTooltip(svg, grid, nx, ny, minEl, maxEl) {
    const tooltip = document.getElementById('elevationTooltip');
    if (!tooltip) return;
    svg.addEventListener('mousemove', function(e) {
        const rect = svg.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        if (x < 0 || x > 400 || y < 0 || y > 400) {
            tooltip.classList.remove('show');
            return;
        }
        const ix = Math.floor(x / 400 * nx);
        const iy = Math.floor(y / 400 * ny);
        const gridY = ny - 1 - iy;
        if (ix >= 0 && ix < nx && gridY >= 0 && gridY < ny) {
            const elev = grid[gridY][ix] * (maxEl - minEl) + minEl;
            tooltip.textContent = elev.toFixed(1) + ' м';
            tooltip.classList.add('show');
        } else {
            tooltip.classList.remove('show');
        }
    });
    svg.addEventListener('mouseleave', function() {
        tooltip.classList.remove('show');
    });
}

// ========== Експорт ==========
function getExportSize() {
    var idx = parseInt(exportResInput.value);
    return exportResolutions[idx];
}

document.getElementById('downloadSVG').addEventListener('click', function() {
    const svg = document.getElementById('contourSVG');
    const size = getExportSize();
    const clone = svg.cloneNode(true);
    clone.setAttribute('width', size);
    clone.setAttribute('height', size);
    clone.setAttribute('viewBox', '0 0 400 400');
    const serializer = new XMLSerializer();
    let source = serializer.serializeToString(clone);
    source = '<?xml version="1.0" standalone="no"?>\r\n' + source;
    const blob = new Blob([source], { type: 'image/svg+xml' });
    const link = document.createElement('a');
    link.download = 'ConTour.svg';
    link.href = URL.createObjectURL(blob);
    link.click();
    URL.revokeObjectURL(link.href);
});

document.getElementById('downloadPNG').addEventListener('click', function() {
    const svg = document.getElementById('contourSVG');
    const size = getExportSize();
    
    const clone = svg.cloneNode(true);
    clone.removeAttribute('style');
    const serializer = new XMLSerializer();
    const source = serializer.serializeToString(clone);

    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const img = new Image();
    img.onload = function() {
        ctx.drawImage(img, 0, 0, size, size);
        const link = document.createElement('a');
        link.download = 'ConTour.png';
        link.href = canvas.toDataURL('image/png');
        link.click();
    };
    img.onerror = function() {
        showError('Помилка створення PNG');
    };
    img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(source);
});

document.getElementById('downloadJPEG').addEventListener('click', function() {
    const svg = document.getElementById('contourSVG');
    const size = getExportSize();
    const serializer = new XMLSerializer();
    const source = serializer.serializeToString(svg);
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#1B1B1B';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    const img = new Image();
    img.onload = function() {
        ctx.drawImage(img, 0, 0, size, size);
        const link = document.createElement('a');
        link.download = 'ConTour.jpg';
        link.href = canvas.toDataURL('image/jpeg', 0.9);
        link.click();
    };
    img.onerror = function() {
        showError('Помилка створення JPEG');
    };
    img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(source);
});

document.getElementById('downloadPDF').addEventListener('click', function() {
    showError('PDF поки в розробці. Але лінії ті ж, що на екрані.');
});

}); // кінець DOMContentLoaded