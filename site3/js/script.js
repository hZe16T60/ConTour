// ==================== ОСНОВНИЙ РОБОЧИЙ JS ====================
(function() {
    // ==================== КАСТОМНІ DROPDOWN ====================
    function initCustomDropdown(dropdownId, onChange) {
        const dropdown = document.getElementById(dropdownId);
        if (!dropdown) return;
        
        const trigger = dropdown.querySelector('.dropdown-trigger');
        const selected = dropdown.querySelector('.dropdown-selected');
        const options = dropdown.querySelectorAll('.dropdown-option');
        
        trigger.addEventListener('click', (e) => {
            e.stopPropagation();
            document.querySelectorAll('.custom-dropdown.open').forEach(d => {
                if (d !== dropdown) d.classList.remove('open');
            });
            dropdown.classList.toggle('open');
        });
        
        options.forEach(option => {
            option.addEventListener('click', (e) => {
                e.stopPropagation();
                const value = option.getAttribute('data-value');
                const text = option.querySelector('.option-text').textContent;
                
                selected.textContent = text;
                options.forEach(o => o.classList.remove('selected'));
                option.classList.add('selected');
                dropdown.classList.remove('open');
                
                if (onChange) onChange(value);
            });
        });
        
        document.addEventListener('click', (e) => {
            if (!dropdown.contains(e.target)) {
                dropdown.classList.remove('open');
            }
        });
        
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                dropdown.classList.remove('open');
            }
        });
    }
    
    // Ініціалізація dropdown для Гармонії
    initCustomDropdown('harmony-dropdown', (value) => {
        harmony = value;
        isCustom = harmony === 'custom';
        currentAngles = [...harmonyDefs[harmony].angles];
        currentFactors = [...harmonyDefs[harmony].factors];
        if(harmony==='monochrome') {
            [currentAngles[0],currentAngles[5]]=[currentAngles[5],currentAngles[0]];
            [currentFactors[0],currentFactors[5]]=[currentFactors[5],currentFactors[0]];
            baseAngle=32.2; baseDistance=54;
        } else if(harmony==='custom') {
            baseAngle=0; baseDistance=70;
        } else {
            baseDistance = MAX_RADIUS / Math.max(...currentFactors);
            baseAngle=0;
        }
        generateMarkers();
        updateSwatchesAndMarkers();
        const master=markers[0];
        const angleDeg = master.angle*180/Math.PI;
        const hex = getColorAtPosition(angleDeg, master.distance);
        updatingFromMaster=true;
        colorPicker.color.hexString = hex;
        updatingFromMaster=false;
    });
    
    // Ініціалізація dropdown для Режиму кольору
    initCustomDropdown('color-mode-dropdown', (value) => {
        colorMode = value;
        updateSlidersVisibility();
        updateSlidersFromActiveColor();
    });

    // ==================== ДОПОМІЖНІ ФУНКЦІЇ КОЛЬОРІВ ====================
    function hexToRgb(hex) {
        const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
        return result ? {
            r: parseInt(result[1], 16),
            g: parseInt(result[2], 16),
            b: parseInt(result[3], 16)
        } : null;
    }

    function rgbToHex(r, g, b) {
        return '#' + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
    }

    function rgbToHsl(r, g, b) {
        r /= 255; g /= 255; b /= 255;
        const max = Math.max(r, g, b), min = Math.min(r, g, b);
        let h, s, l = (max + min) / 2;
        if (max === min) {
            h = s = 0;
        } else {
            const d = max - min;
            s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
            switch (max) {
                case r: h = (g - b) / d + (g < b ? 6 : 0); break;
                case g: h = (b - r) / d + 2; break;
                case b: h = (r - g) / d + 4; break;
            }
            h /= 6;
        }
        return { h: Math.round(h * 360), s: Math.round(s * 100), l: Math.round(l * 100) };
    }

    function hslToRgb(h, s, l) {
        h /= 360; s /= 100; l /= 100;
        let r, g, b;
        if (s === 0) {
            r = g = b = l;
        } else {
            const hue2rgb = (p, q, t) => {
                if (t < 0) t += 1;
                if (t > 1) t -= 1;
                if (t < 1/6) return p + (q - p) * 6 * t;
                if (t < 1/2) return q;
                if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
                return p;
            };
            const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
            const p = 2 * l - q;
            r = hue2rgb(p, q, h + 1/3);
            g = hue2rgb(p, q, h);
            b = hue2rgb(p, q, h - 1/3);
        }
        return { r: Math.round(r * 255), g: Math.round(g * 255), b: Math.round(b * 255) };
    }

    function parseColorInput(input) {
        input = input.trim();
        
        // HEX
        if (input.startsWith('#')) {
            const rgb = hexToRgb(input);
            if (rgb) return { ...rgb, hex: input };
        }
        
        // RGB
        const rgbMatch = input.match(/rgb\s*\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)/i);
        if (rgbMatch) {
            const r = parseInt(rgbMatch[1]);
            const g = parseInt(rgbMatch[2]);
            const b = parseInt(rgbMatch[3]);
            return { r, g, b, hex: rgbToHex(r, g, b) };
        }
        
        // HSL
        const hslMatch = input.match(/hsl\s*\(\s*(\d+)\s*,\s*(\d+)%?\s*,\s*(\d+)%?\s*\)/i);
        if (hslMatch) {
            const h = parseInt(hslMatch[1]);
            const s = parseInt(hslMatch[2]);
            const l = parseInt(hslMatch[3]);
            const rgb = hslToRgb(h, s, l);
            return { ...rgb, hex: rgbToHex(rgb.r, rgb.g, rgb.b) };
        }
        
        return null;
    }

    function applyMoodToHex(hex, mood) {
        if (mood === 'none' || !hex || hex === '—') return hex;
        const rgb = hexToRgb(hex);
        if (!rgb) return hex;
        const hsl = rgbToHsl(rgb.r, rgb.g, rgb.b);
        switch (mood) {
            case 'colorful': hsl.s = Math.min(100, hsl.s + 20); break;
            case 'bright':   hsl.l = Math.min(100, hsl.l + 20); break;
            case 'muted':    hsl.s = Math.max(0, hsl.s - 20); break;
            case 'saturated':hsl.s = Math.min(100, hsl.s + 30); break;
            case 'dark':     hsl.l = Math.max(0, hsl.l - 20); break;
            default: return hex;
        }
        const newRgb = hslToRgb(hsl.h, hsl.s, hsl.l);
        return rgbToHex(newRgb.r, newRgb.g, newRgb.b);
    }

    function renderSwatches(containerId, count = 6, withDelete = true) {
        const colorsGrid = document.getElementById(containerId);
        if (!colorsGrid) return;
        colorsGrid.innerHTML = '';
        colorsGrid.style.display = 'flex';
        
        for (let i = 0; i < count; i++) {
            const card = document.createElement('div');
            card.className = 'color-card';
            card.style.background = '#333';
            card.setAttribute('data-index', i);
            
            const hexSpan = document.createElement('span');
            hexSpan.className = 'color-hex';
            hexSpan.textContent = '#333333';
            hexSpan.setAttribute('data-color', '#333333');
            
            card.appendChild(hexSpan);
            
            if (withDelete) {
                const deleteIcon = document.createElement('button');
                deleteIcon.className = 'delete-icon';
                deleteIcon.innerHTML = '×';
                deleteIcon.setAttribute('data-index', i);
                card.appendChild(deleteIcon);
            }
            
            // Клік для вибору активного кольору
            card.addEventListener('click', (e) => {
                if (e.target.classList.contains('delete-icon')) return;
                selectActiveColor(i, containerId);
            });
            
            colorsGrid.appendChild(card);
        }
        
        document.querySelectorAll(`#${containerId} .color-hex`).forEach(el => {
            el.addEventListener('click', (e) => {
                e.stopPropagation();
                const hex = el.getAttribute('data-color');
                if (hex === 'grey') return;
                navigator.clipboard.writeText(hex).then(() => {
                    const original = el.textContent;
                    el.textContent = '✓';
                    setTimeout(() => el.textContent = original, 800);
                });
            });
        });
    }

    // ==================== ПАНЕЛЬ НАЛАШТУВАНЬ ====================
    let colorMode = 'rgb';
    let activeColorIndex = 0;

    const universalInput = document.getElementById('universal-color-input');
    const colorPreview = document.getElementById('color-preview');

    // Слайдери
    const sliders = {
        r: document.getElementById('slider-r'),
        g: document.getElementById('slider-g'),
        b: document.getElementById('slider-b'),
        h: document.getElementById('slider-h'),
        s: document.getElementById('slider-s'),
        l: document.getElementById('slider-l'),
        hex: document.getElementById('slider-hex')
    };

    const sliderValues = {
        r: document.getElementById('value-r'),
        g: document.getElementById('value-g'),
        b: document.getElementById('value-b'),
        h: document.getElementById('value-h'),
        s: document.getElementById('value-s'),
        l: document.getElementById('value-l')
    };

    function updateSlidersVisibility() {
        document.querySelector('.rgb-sliders').classList.toggle('hidden', colorMode !== 'rgb');
        document.querySelector('.hsl-sliders').classList.toggle('hidden', colorMode !== 'hsl');
        document.querySelector('.hex-sliders').classList.toggle('hidden', colorMode !== 'hex');
    }

    function updateSlidersFromActiveColor() {
        const swatches = document.querySelectorAll('#create-page .color-card');
        if (activeColorIndex >= swatches.length) return;
        
        const hexEl = swatches[activeColorIndex].querySelector('.color-hex');
        const hex = hexEl.getAttribute('data-color');
        const rgb = hexToRgb(hex);
        if (!rgb) return;
        
        const hsl = rgbToHsl(rgb.r, rgb.g, rgb.b);
        
        // Оновлюємо слайдери
        sliders.r.value = rgb.r;
        sliders.g.value = rgb.g;
        sliders.b.value = rgb.b;
        sliders.h.value = hsl.h;
        sliders.s.value = hsl.s;
        sliders.l.value = hsl.l;
        sliders.hex.value = hex;
        
        // Оновлюємо значення
        sliderValues.r.textContent = rgb.r;
        sliderValues.g.textContent = rgb.g;
        sliderValues.b.textContent = rgb.b;
        sliderValues.h.textContent = hsl.h + '°';
        sliderValues.s.textContent = hsl.s + '%';
        sliderValues.l.textContent = hsl.l + '%';
        
        // Оновлюємо прев'ю
        colorPreview.style.background = hex;
        universalInput.value = hex;
        
        // Оновлюємо колірний круг
        updatingFromMaster = true;
        colorPicker.color.hexString = hex;
        updatingFromMaster = false;
    }

    function selectActiveColor(index, containerId = 'colors-grid') {
        activeColorIndex = index;
        
        // Знімаємо активність з усіх
        document.querySelectorAll('.color-card').forEach(card => {
            card.classList.remove('active');
        });
        
        // Додаємо активність вибраному
        const swatches = document.querySelectorAll(`#${containerId} .color-card`);
        if (swatches[index]) {
            swatches[index].classList.add('active');
        }
        
        updateSlidersFromActiveColor();
    }

    function updateColorFromSliders() {
        let hex;
        
        if (colorMode === 'rgb') {
            const r = parseInt(sliders.r.value);
            const g = parseInt(sliders.g.value);
            const b = parseInt(sliders.b.value);
            hex = rgbToHex(r, g, b);
            
            sliderValues.r.textContent = r;
            sliderValues.g.textContent = g;
            sliderValues.b.textContent = b;
        } else if (colorMode === 'hsl') {
            const h = parseInt(sliders.h.value);
            const s = parseInt(sliders.s.value);
            const l = parseInt(sliders.l.value);
            const rgb = hslToRgb(h, s, l);
            hex = rgbToHex(rgb.r, rgb.g, rgb.b);
            
            sliderValues.h.textContent = h + '°';
            sliderValues.s.textContent = s + '%';
            sliderValues.l.textContent = l + '%';
        } else if (colorMode === 'hex') {
            hex = sliders.hex.value;
            if (!hex.startsWith('#')) hex = '#' + hex;
        }
        
        // Оновлюємо прев'ю
        colorPreview.style.background = hex;
        universalInput.value = hex;
        
        // Оновлюємо активний колір
        updateActiveColor(hex);
    }

    function updateActiveColor(hex) {
        const swatches = document.querySelectorAll('#create-page .color-card');
        if (activeColorIndex >= swatches.length) return;
        
        const card = swatches[activeColorIndex];
        const hexEl = card.querySelector('.color-hex');
        
        // Отримуємо HSL активного кольору
        const baseRgb = hexToRgb(hex);
        if (!baseRgb) return;
        const baseHsl = rgbToHsl(baseRgb.r, baseRgb.g, baseRgb.b);
        
        if (isCustom || harmony === 'custom') {
            // В довільному режимі змінюємо тільки один колір
            card.style.backgroundColor = hex;
            hexEl.textContent = hex;
            hexEl.setAttribute('data-color', hex);
            
            // Оновлюємо відповідний маркер - плавно переміщаємо його
            const markerIdx = rectToMarker[activeColorIndex];
            if (markers[markerIdx]) {
                const hue = baseHsl.h;
                const lightness = baseHsl.l / 100;
                let newDistance = getDistanceFromLightness(lightness);
                newDistance = Math.min(newDistance, MAX_RADIUS);
                const newAngle = hue * Math.PI / 180;
                
                updateSingleMarker(markerIdx, newAngle, newDistance);
            }
        } else {
            // В режимі гармонії змінюємо всі кольори і переміщаємо маркери
            
            // Оновлюємо базовий кут і відстань на основі активного кольору
            const activeMarkerIdx = rectToMarker[activeColorIndex];
            const hue = baseHsl.h;
            const lightness = baseHsl.l / 100;
            let newDistance = (centerMode === 'white' ? (1 - lightness) * 2 * MAX_RADIUS : lightness * 2 * MAX_RADIUS);
            newDistance = Math.min(newDistance, MAX_RADIUS);
            
            // Оновлюємо базові значення
            baseAngle = hue - currentAngles[activeMarkerIdx];
            const maxFactor = Math.max(...currentFactors);
            baseDistance = newDistance / currentFactors[activeMarkerIdx];
            baseDistance = Math.min(baseDistance, MAX_RADIUS / maxFactor);
            baseDistance = Math.max(baseDistance, 0);
            
            // Додаємо клас анімації для плавного переходу
            markers.forEach(m => m.element.classList.add('animate'));
            
            // Оновлюємо всі маркери і кольори
            const centerX = 150, centerY = 150;
            markers.forEach((marker, i) => {
                const angleRad = (baseAngle + currentAngles[i]) * Math.PI / 180;
                let distance = Math.min(baseDistance * currentFactors[i], MAX_RADIUS);
                const x = centerX + distance * Math.cos(angleRad);
                const y = centerY + distance * Math.sin(angleRad);
                
                // Плавно оновлюємо позицію
                marker.element.style.left = x + 'px';
                marker.element.style.top = y + 'px';
                marker.angle = angleRad;
                marker.distance = distance;
                
                // Оновлюємо колір маркера
                const angleDeg = angleRad * 180 / Math.PI;
                const markerHex = getColorAtPosition(angleDeg, distance);
                marker.element.style.backgroundColor = markerHex;
                
                // Оновлюємо відповідну карточку
                const rectIndex = markerToRect[i];
                if (rectIndex < swatches.length) {
                    swatches[rectIndex].style.backgroundColor = markerHex;
                    const swatchHexEl = swatches[rectIndex].querySelector('.color-hex');
                    swatchHexEl.textContent = markerHex;
                    swatchHexEl.setAttribute('data-color', markerHex);
                }
            });
            
            updateLayering();
            
            // Видаляємо клас анімації після завершення
            setTimeout(() => {
                markers.forEach(m => m.element.classList.remove('animate'));
            }, 300);
            
            // Оновлюємо колірний круг без виклику події
            const master = markers[0];
            const masterAngleDeg = master.angle * 180 / Math.PI;
            const masterHex = getColorAtPosition(masterAngleDeg, master.distance);
            updatingFromMaster = true;
            colorPicker.color.hexString = masterHex;
            updatingFromMaster = false;
        }
    }

    // Обробники слайдерів
    Object.values(sliders).forEach(slider => {
        if (slider) {
            slider.addEventListener('input', updateColorFromSliders);
        }
    });

    // Універсальне поле вводу
    universalInput.addEventListener('input', (e) => {
        const color = parseColorInput(e.target.value);
        if (color) {
            colorPreview.style.background = color.hex;
            
            // Оновлюємо слайдери
            const hsl = rgbToHsl(color.r, color.g, color.b);
            sliders.r.value = color.r;
            sliders.g.value = color.g;
            sliders.b.value = color.b;
            sliders.h.value = hsl.h;
            sliders.s.value = hsl.s;
            sliders.l.value = hsl.l;
            sliders.hex.value = color.hex;
            
            sliderValues.r.textContent = color.r;
            sliderValues.g.textContent = color.g;
            sliderValues.b.textContent = color.b;
            sliderValues.h.textContent = hsl.h + '°';
            sliderValues.s.textContent = hsl.s + '%';
            sliderValues.l.textContent = hsl.l + '%';
            
            updateActiveColor(color.hex);
        }
    });

    // ==================== КОЛЬОРОВЕ КОЛО ====================
    const wheelContainer = document.getElementById('wheel-container');
    const markersOverlay = document.getElementById('markers-overlay');
    
    const colorPicker = new iro.ColorPicker(wheelContainer, {
        width: 300,
        color: "#E62075",
        borderWidth: 0,
        layout: [ { component: iro.ui.Wheel, options: { wheelLightness: true, wheelAngle: 0, wheelDirection: 'clockwise' } } ]
    });

    let harmony = 'monochrome';
    let markers = [];
    let masterMarker = null;
    const swatchCount = 6;
    const MAX_RADIUS = 130;
    let centerMode = 'white';
    let updatingFromMaster = false;
    let isCustom = false;
    let draggedIndex = null;

    const harmonyDefs = {
        monochrome:  { angles: [0,0,0,0,0,0], factors: [0.2,0.4,0.6,0.8,1.0,1.2] },
        triad:       { angles: [0,0,120,120,240,240], factors: [0.5,0.8,0.5,0.8,0.5,0.8] },
        complementary:{ angles: [0,0,0,180,180,180], factors: [0.3,0.6,0.9,0.3,0.6,0.9] },
        split:       { angles: [0,0,150,150,210,210], factors: [0.4,0.7,0.4,0.7,0.4,0.7] },
        square:      { angles: [0,0,90,90,180,270], factors: [0.5,0.8,0.5,0.8,0.5,0.8] },
        compound:    { angles: [0,30,60,90,120,150], factors: [0.5,0.6,0.7,0.8,0.9,1.0] },
        custom:      { angles: [0,45,90,135,180,225], factors: [0.5,0.6,0.7,0.8,0.9,1.0] }
    };

    let currentAngles = [...harmonyDefs.monochrome.angles];
    let currentFactors = [...harmonyDefs.monochrome.factors];
    [currentAngles[0], currentAngles[5]] = [currentAngles[5], currentAngles[0]];
    [currentFactors[0], currentFactors[5]] = [currentFactors[5], currentFactors[0]];

    let baseAngle = 32.2;
    let baseDistance = 54;

    const markerToRect = [5,1,2,3,4,0];
    const rectToMarker = [5,1,2,3,4,0];

    function hslToWheelHex(h,s,l) {
        h/=360;
        let r,g,b;
        if(s===0) r=g=b=l;
        else {
            const hue2rgb=(p,q,t)=>{
                if(t<0) t+=1;
                if(t>1) t-=1;
                if(t<1/6) return p+(q-p)*6*t;
                if(t<1/2) return q;
                if(t<2/3) return p+(q-p)*(2/3-t)*6;
                return p;
            };
            const q = l<0.5 ? l*(1+s) : l+s-l*s;
            const p = 2*l - q;
            r = hue2rgb(p,q,h+1/3);
            g = hue2rgb(p,q,h);
            b = hue2rgb(p,q,h-1/3);
        }
        const toHex=x=>Math.round(x*255).toString(16).padStart(2,'0');
        return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
    }

    function getColorAtPosition(angleDeg, distance) {
        let hue = (angleDeg+360)%360;
        const t = distance/MAX_RADIUS;
        let lightness = centerMode==='white' ? 1.0 - t*0.5 : 0.0 + t*0.5;
        return hslToWheelHex(hue, 1.0, lightness);
    }

    function getDistanceFromLightness(lightness) {
        return centerMode==='white' ? (1-lightness)*2*MAX_RADIUS : lightness*2*MAX_RADIUS;
    }

    function updateLayering() {
        if(!markers.length) return;
        markers[0].element.style.zIndex = 20;
        const others = markers.slice(1).map((m,i)=>({m,idx:i+1})).sort((a,b)=>a.m.distance-b.m.distance);
        others.forEach((item,rank)=> item.m.element.style.zIndex = 11+rank);
    }

    function generateMarkers() {
        markersOverlay.innerHTML = '';
        markers = [];
        const centerX=150, centerY=150;
        for(let i=0;i<swatchCount;i++) {
            let angleRad = (baseAngle + currentAngles[i]) * Math.PI/180;
            let distance = Math.min(baseDistance * currentFactors[i], MAX_RADIUS);
            const x = centerX + distance * Math.cos(angleRad);
            const y = centerY + distance * Math.sin(angleRad);
            
            const marker = document.createElement('div');
            marker.className = 'marker';
            marker.style.left = x+'px';
            marker.style.top = y+'px';
            marker.setAttribute('data-index', i);
            markersOverlay.appendChild(marker);
            
            markers.push({ element:marker, angle:angleRad, distance, index:i, isMaster:i===0 });
        }
        masterMarker = markers[0];
        updateLayering();
    }

    function updateSingleMarker(index, newAngle, newDistance) {
        const marker = markers[index];
        if(!marker) return;
        newDistance = Math.min(newDistance, MAX_RADIUS);
        const centerX=150, centerY=150;
        const x = centerX + newDistance * Math.cos(newAngle);
        const y = centerY + newDistance * Math.sin(newAngle);
        marker.element.style.left = x+'px';
        marker.element.style.top = y+'px';
        marker.angle = newAngle;
        marker.distance = newDistance;
        
        const angleDeg = newAngle * 180/Math.PI;
        const hex = getColorAtPosition(angleDeg, newDistance);
        marker.element.style.backgroundColor = hex;
        
        const rectIndex = markerToRect[index];
        const swatches = document.querySelectorAll('#create-page .color-card');
        if(rectIndex < swatches.length) {
            swatches[rectIndex].style.backgroundColor = hex;
            const hexEl = swatches[rectIndex].querySelector('.color-hex');
            hexEl.textContent = hex;
            hexEl.setAttribute('data-color', hex);
        }
    }

    function updateMarkers(newBaseAngle, newBaseDistance) {
        if(isCustom) return;
        baseAngle = newBaseAngle;
        baseDistance = newBaseDistance;
        const centerX=150, centerY=150;
        markers.forEach((marker,i)=>{
            const angleRad = (baseAngle + currentAngles[i]) * Math.PI/180;
            let distance = Math.min(baseDistance * currentFactors[i], MAX_RADIUS);
            const x = centerX + distance * Math.cos(angleRad);
            const y = centerY + distance * Math.sin(angleRad);
            marker.element.style.left = x+'px';
            marker.element.style.top = y+'px';
            marker.angle = angleRad;
            marker.distance = distance;
        });
        updateSwatchesAndMarkers();
        updateLayering();
    }

    function updateSwatchesAndMarkers() {
        const swatches = document.querySelectorAll('#create-page .color-card');
        markers.forEach(marker=>{
            const rectIndex = markerToRect[marker.index];
            if(rectIndex >= swatches.length) return;
            const angleDeg = marker.angle * 180/Math.PI;
            const hex = getColorAtPosition(angleDeg, marker.distance);
            swatches[rectIndex].style.backgroundColor = hex;
            const hexEl = swatches[rectIndex].querySelector('.color-hex');
            hexEl.textContent = hex;
            hexEl.setAttribute('data-color', hex);
            marker.element.style.backgroundColor = hex;
        });
    }
    
    // Функція для оновлення параметрів на основі активного кольору
    function updateParamsFromMarker(marker) {
        if (!marker) return;
        const angleDeg = marker.angle * 180 / Math.PI;
        const hex = getColorAtPosition(angleDeg, marker.distance);
        const rgb = hexToRgb(hex);
        if (!rgb) return;
        const hsl = rgbToHsl(rgb.r, rgb.g, rgb.b);
        
        // Оновлюємо слайдери
        sliders.r.value = rgb.r;
        sliders.g.value = rgb.g;
        sliders.b.value = rgb.b;
        sliders.h.value = hsl.h;
        sliders.s.value = hsl.s;
        sliders.l.value = hsl.l;
        sliders.hex.value = hex;
        
        // Оновлюємо значення
        sliderValues.r.textContent = rgb.r;
        sliderValues.g.textContent = rgb.g;
        sliderValues.b.textContent = rgb.b;
        sliderValues.h.textContent = hsl.h + '°';
        sliderValues.s.textContent = hsl.s + '%';
        sliderValues.l.textContent = hsl.l + '%';
        
        // Оновлюємо прев'ю
        colorPreview.style.background = hex;
        universalInput.value = hex;
    }

    renderSwatches('colors-grid', 6, true);
    generateMarkers();
    updateSwatchesAndMarkers();
    selectActiveColor(0);

    // Обробка перетягування маркерів
    markersOverlay.addEventListener('mousedown', (e) => {
        const target = e.target.closest('.marker');
        if (!target) return;
        
        const index = parseInt(target.getAttribute('data-index'));
        
        if (isCustom) {
            startDragMarker(index, e);
        } else {
            e.preventDefault();
            
            const onMove = (moveEvent) => {
                const rect = wheelContainer.getBoundingClientRect();
                const centerX = rect.left + rect.width / 2;
                const centerY = rect.top + rect.height / 2;
                
                const dx = moveEvent.clientX - centerX;
                const dy = moveEvent.clientY - centerY;
                
                let newAngle = Math.atan2(dy, dx);
                let mouseDistance = Math.sqrt(dx*dx + dy*dy);
                let newAngleDeg = newAngle * 180 / Math.PI;
                
                const newBaseAngle = newAngleDeg - currentAngles[index];
                
                let allowedBaseDistance = mouseDistance / currentFactors[index];
                
                for (let i = 0; i < swatchCount; i++) {
                    const limitForThisMarker = MAX_RADIUS / currentFactors[i];
                    if (allowedBaseDistance > limitForThisMarker) {
                        allowedBaseDistance = limitForThisMarker;
                    }
                }

                updateMarkers(newBaseAngle, allowedBaseDistance);
                
                // Оновлюємо параметри в реальному часі
                updateParamsFromMarker(markers[0]);
                
                const master = markers[0];
                const angleDegMaster = master.angle * 180 / Math.PI;
                const hex = getColorAtPosition(angleDegMaster, master.distance);
                updatingFromMaster = true;
                colorPicker.color.hexString = hex;
                updatingFromMaster = false;
            };
            
            const onUp = () => {
                window.removeEventListener('mousemove', onMove);
                window.removeEventListener('mouseup', onUp);
            };
            
            window.addEventListener('mousemove', onMove);
            window.addEventListener('mouseup', onUp);
        }
    });

    function startDragMarker(index, startEvent) {
        if (!isCustom) return;
        if (draggedIndex !== null) return;
        startEvent.preventDefault();
        draggedIndex = index;
        
        const marker = markers[index];
        const rect = wheelContainer.getBoundingClientRect();
        const centerX = rect.left + rect.width / 2;
        const centerY = rect.top + rect.height / 2;
        
        function onDragMove(moveEvent) {
            if (draggedIndex !== index) return;
            const dx = moveEvent.clientX - centerX;
            const dy = moveEvent.clientY - centerY;
            let newDistance = Math.sqrt(dx*dx + dy*dy);
            newDistance = Math.min(newDistance, MAX_RADIUS);
            let newAngle = Math.atan2(dy, dx);
            updateSingleMarker(index, newAngle, newDistance);
            // Оновлюємо параметри в реальному часі
            updateParamsFromMarker(markers[index]);
        }
        
        function onDragEnd() {
            if (draggedIndex === index) {
                draggedIndex = null;
            }
            window.removeEventListener('mousemove', onDragMove);
            window.removeEventListener('mouseup', onDragEnd);
        }
        
        window.addEventListener('mousemove', onDragMove);
        window.addEventListener('mouseup', onDragEnd);
    }

    colorPicker.on('color:change', color => {
        if(updatingFromMaster) return;
        if(isCustom) {
            const idx = activeColorIndex;
            const hue = color.hsl.h;
            const lightness = color.hsl.l;
            let newDistance = getDistanceFromLightness(lightness);
            newDistance = Math.min(newDistance, MAX_RADIUS);
            const newAngle = hue * Math.PI/180;
            updateSingleMarker(idx, newAngle, newDistance);
            // Оновлюємо параметри
            updateParamsFromMarker(markers[idx]);
        } else {
            const hue = color.hsl.h;
            const lightness = color.hsl.l;
            const newBaseAngle = hue - currentAngles[0];
            let newDistance = (centerMode==='white' ? (1-lightness)*2*MAX_RADIUS : lightness*2*MAX_RADIUS);
            newDistance = Math.min(newDistance, MAX_RADIUS);
            const maxFactor = Math.max(...currentFactors);
            let newBaseDistance = newDistance / currentFactors[0];
            newBaseDistance = Math.min(newBaseDistance, MAX_RADIUS/maxFactor);
            newBaseDistance = Math.max(newBaseDistance, 0);
            updateMarkers(newBaseAngle, newBaseDistance);
            // Оновлюємо параметри
            updateParamsFromMarker(markers[0]);
        }
    });

    // Чорний/Білий центр
    document.getElementById('set-black').addEventListener('click', ()=>{
        centerMode='black';
        if(isCustom) {
            markers.forEach((_,idx)=>{
                const angleDeg = markers[idx].angle*180/Math.PI;
                const hex = getColorAtPosition(angleDeg, markers[idx].distance);
                markers[idx].element.style.backgroundColor = hex;
                const rectIndex = markerToRect[idx];
                const swatches = document.querySelectorAll('#create-page .color-card');
                if(rectIndex<swatches.length) {
                    swatches[rectIndex].style.backgroundColor = hex;
                    const hexEl = swatches[rectIndex].querySelector('.color-hex');
                    hexEl.textContent = hex;
                    hexEl.setAttribute('data-color', hex);
                }
            });
        } else updateSwatchesAndMarkers();
        const master=markers[0];
        const angleDeg = master.angle*180/Math.PI;
        const hex = getColorAtPosition(angleDeg, master.distance);
        updatingFromMaster=true;
        colorPicker.color.hexString = hex;
        updatingFromMaster=false;
    });

    document.getElementById('set-white').addEventListener('click', ()=>{
        centerMode='white';
        if(isCustom) {
            markers.forEach((_,idx)=>{
                const angleDeg = markers[idx].angle*180/Math.PI;
                const hex = getColorAtPosition(angleDeg, markers[idx].distance);
                markers[idx].element.style.backgroundColor = hex;
                const rectIndex = markerToRect[idx];
                const swatches = document.querySelectorAll('#create-page .color-card');
                if(rectIndex<swatches.length) {
                    swatches[rectIndex].style.backgroundColor = hex;
                    const hexEl = swatches[rectIndex].querySelector('.color-hex');
                    hexEl.textContent = hex;
                    hexEl.setAttribute('data-color', hex);
                }
            });
        } else updateSwatchesAndMarkers();
        const master=markers[0];
        const angleDeg = master.angle*180/Math.PI;
        const hex = getColorAtPosition(angleDeg, master.distance);
        updatingFromMaster=true;
        colorPicker.color.hexString = hex;
        updatingFromMaster=false;
    });

    // ==================== НАВІГАЦІЯ ====================
    const modeBtns = document.querySelectorAll('.mode-btn');
    const modeSlider = document.getElementById('mode-slider');
    const pageSlider = document.getElementById('page-slider');
    const navBar = document.getElementById('nav-bar');
    const btnCreate = document.getElementById('btn-create');
    const btnSaved = document.getElementById('btn-saved');
    const createPage = document.getElementById('create-page');
    const extractPage = document.getElementById('extract-page');
    const gradientPage = document.getElementById('gradient-page');
    const savedPage = document.getElementById('saved-page');
    const savedGrid = document.getElementById('saved-grid');

    function updateModeSlider(activeBtn) {
        const btnRect = activeBtn.getBoundingClientRect();
        const navRect = navBar.getBoundingClientRect();
        modeSlider.style.left = (btnRect.left - navRect.left) + 'px';
        modeSlider.style.width = btnRect.width + 'px';
    }

    function updatePageSlider(activeBtn) {
        const btnRect = activeBtn.getBoundingClientRect();
        const navRect = navBar.getBoundingClientRect();
        pageSlider.style.left = (btnRect.left - navRect.left) + 'px';
        pageSlider.style.width = btnRect.width + 'px';
    }

    modeBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            modeBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            updateModeSlider(btn);
            const mode = btn.getAttribute('data-mode');
            createPage.classList.add('hidden');
            extractPage.classList.add('hidden');
            gradientPage.classList.add('hidden');
            savedPage.classList.add('hidden');
            if (mode === 'wheel') {
                createPage.classList.remove('hidden');
                btnCreate.classList.add('active');
                btnSaved.classList.remove('active');
            } else if (mode === 'extract') {
                extractPage.classList.remove('hidden');
                btnCreate.classList.add('active');
                btnSaved.classList.remove('active');
            } else if (mode === 'gradient') {
                gradientPage.classList.remove('hidden');
                btnCreate.classList.add('active');
                btnSaved.classList.remove('active');
            }
            updatePageSlider(btnCreate);
        });
    });

    setTimeout(() => {
        updateModeSlider(document.querySelector('.mode-btn.active'));
        updatePageSlider(btnCreate);
    }, 100);

    btnCreate.addEventListener('click', () => {
        btnCreate.classList.add('active');
        btnSaved.classList.remove('active');
        createPage.classList.remove('hidden');
        extractPage.classList.add('hidden');
        gradientPage.classList.add('hidden');
        savedPage.classList.add('hidden');
        updatePageSlider(btnCreate);
        modeBtns.forEach(btn => {
            if (btn.getAttribute('data-mode') === 'wheel') {
                btn.classList.add('active');
                updateModeSlider(btn);
            } else {
                btn.classList.remove('active');
            }
        });
    });

    btnSaved.addEventListener('click', () => {
        btnSaved.classList.add('active');
        btnCreate.classList.remove('active');
        savedPage.classList.remove('hidden');
        createPage.classList.add('hidden');
        extractPage.classList.add('hidden');
        gradientPage.classList.add('hidden');
        updatePageSlider(btnSaved);
        renderSavedPalettes();
    });

    // ==================== ЗБЕРЕЖЕНІ ПАЛІТРИ ====================
    let savedPalettes = JSON.parse(localStorage.getItem('colir_palettes')) || [];
    
    function saveCurrentPalette(colors) {
        const palette = { id: Date.now(), colors, date: new Date().toLocaleDateString('uk-UA') };
        savedPalettes.push(palette);
        localStorage.setItem('colir_palettes', JSON.stringify(savedPalettes));
        renderSavedPalettes();
    }

    function renderSavedPalettes() {
        savedGrid.innerHTML = '';
        if (savedPalettes.length === 0) {
            savedGrid.innerHTML = '<p style="color:#666;">Поки немає збережених палітр.</p>';
            return;
        }
        savedPalettes.forEach(pal => {
            const div = document.createElement('div');
            div.className = 'saved-palette';
            const colorsHtml = pal.colors.map(c => `<div class="color-mini" style="background:${c};"></div>`).join('');
            div.innerHTML = `
                <div class="colors">${colorsHtml}</div>
                <div class="date">${pal.date}</div>
                <div class="palette-actions">
                    <button class="delete-palette" data-id="${pal.id}">🗑</button>
                    <button class="export-png" data-id="${pal.id}">PNG</button>
                    <button class="import-palette" data-id="${pal.id}">Імпорт</button>
                </div>
            `;
            savedGrid.appendChild(div);
        });

        document.querySelectorAll('.delete-palette').forEach(btn => {
            btn.addEventListener('click', e => {
                e.stopPropagation();
                const id = btn.getAttribute('data-id');
                savedPalettes = savedPalettes.filter(p => p.id != id);
                localStorage.setItem('colir_palettes', JSON.stringify(savedPalettes));
                renderSavedPalettes();
            });
        });

        document.querySelectorAll('.export-png').forEach(btn => {
            btn.addEventListener('click', e => {
                e.stopPropagation();
                const id = btn.getAttribute('data-id');
                const palette = savedPalettes.find(p => p.id == id);
                if (!palette) return;
                const canvas = document.createElement('canvas');
                canvas.width = 600; canvas.height = 100;
                const ctx = canvas.getContext('2d');
                const colWidth = 100;
                palette.colors.forEach((c,i) => {
                    ctx.fillStyle = c;
                    ctx.fillRect(i*colWidth, 0, colWidth, 100);
                });
                const link = document.createElement('a');
                link.download = `palette-${palette.id}.png`;
                link.href = canvas.toDataURL('image/png');
                link.click();
            });
        });

        document.querySelectorAll('.import-palette').forEach(btn => {
            btn.addEventListener('click', e => {
                e.stopPropagation();
                const id = btn.getAttribute('data-id');
                const palette = savedPalettes.find(p => p.id == id);
                if (!palette) return;
                const swatches = document.querySelectorAll('#create-page .color-card');
                palette.colors.forEach((hex, rectIdx) => {
                    if (rectIdx >= swatches.length) return;
                    const markerIdx = rectToMarker[rectIdx];
                    swatches[rectIdx].style.backgroundColor = hex;
                    const hexEl = swatches[rectIdx].querySelector('.color-hex');
                    hexEl.textContent = hex;
                    hexEl.setAttribute('data-color', hex);
                    if (markers[markerIdx]) markers[markerIdx].element.style.backgroundColor = hex;
                });
                btnCreate.click();
            });
        });
    }

    document.getElementById('save-palette').addEventListener('click', () => {
        const colors = Array.from(document.querySelectorAll('#create-page .color-card .color-hex')).map(el => el.textContent);
        saveCurrentPalette(colors);
    });

    if (savedPalettes.length === 0) {
        savedPalettes = [
            { id: 1, colors: ['#E62075','#E64D20','#E62A20','#E220E6','#E66F20','#E6736D'], date: '01.03.2024' }
        ];
        localStorage.setItem('colir_palettes', JSON.stringify(savedPalettes));
    }

    // ==================== СТОРІНКА ВИТЯГУ ТЕМИ ====================
    const dropZone = document.getElementById('drop-zone');
    const fileInput = document.getElementById('file-input');
    const imagePreview = document.getElementById('image-preview');
    const imageCanvas = document.getElementById('image-canvas');
    const imageMarkersContainer = document.getElementById('image-markers-container');
    const imageMarkers = document.getElementById('image-markers');
    const extractColorsGrid = document.getElementById('extract-colors-grid');
    const saveExtractBtn = document.getElementById('save-extract-palette');
    const moodBtns = document.querySelectorAll('#mood-selector .mood-btn');
    const extractResetBtn = document.getElementById('extract-reset-btn');
    const extractCountBtn = document.getElementById('extract-count-btn');
    const extractCountDropdown = document.getElementById('extract-count-dropdown');

    let currentExtractImage = null;
    let extractMarkersList = [];
    let extractCtx = imageCanvas.getContext('2d');
    let colorThief = new ColorThief();
    let currentExtractMood = 'none';
    let rawExtractColors = [];

    function applyMoodToExtract() {
        const swatches = document.querySelectorAll('#extract-colors-grid .color-card');
        rawExtractColors.forEach((rawHex, idx) => {
            if (idx >= swatches.length) return;
            const moodHex = applyMoodToHex(rawHex, currentExtractMood);
            swatches[idx].style.backgroundColor = moodHex;
            const hexEl = swatches[idx].querySelector('.color-hex');
            hexEl.textContent = moodHex;
            hexEl.setAttribute('data-color', moodHex);
            if (extractMarkersList[idx]) extractMarkersList[idx].element.style.backgroundColor = moodHex;
        });
    }

    function updateExtractSwatches() {
        const swatches = document.querySelectorAll('#extract-colors-grid .color-card');
        extractMarkersList.forEach((marker, idx) => {
            if (idx >= swatches.length) return;
            const canvasX = Math.floor((marker.percentX / 100) * imageCanvas.width);
            const canvasY = Math.floor((marker.percentY / 100) * imageCanvas.height);
            const x = Math.max(0, Math.min(imageCanvas.width - 1, canvasX));
            const y = Math.max(0, Math.min(imageCanvas.height - 1, canvasY));
            const pixel = extractCtx.getImageData(x, y, 1, 1).data;
            const rawHex = '#' + [pixel[0], pixel[1], pixel[2]].map(v => v.toString(16).padStart(2,'0')).join('');
            rawExtractColors[idx] = rawHex;
        });
        applyMoodToExtract();
    }

    function updateImageMarkersContainer() {
        // Оновлюємо розміри контейнера меток відповідно до розмірів canvas
        const canvasRect = imageCanvas.getBoundingClientRect();
        const previewRect = imagePreview.getBoundingClientRect();
        
        imageMarkers.style.width = canvasRect.width + 'px';
        imageMarkers.style.height = canvasRect.height + 'px';
    }

    function placeExtractMarkers(count) {
        imageMarkers.innerHTML = '';
        extractMarkersList = [];
        rawExtractColors = [];
        
        // Оновлюємо розміри контейнера меток
        updateImageMarkersContainer();
        
        for (let i = 0; i < count; i++) {
            const percentX = Math.random() * 80 + 10; // 10% - 90%
            const percentY = Math.random() * 80 + 10;
            
            const marker = document.createElement('div');
            marker.className = 'image-marker';
            marker.style.left = percentX + '%';
            marker.style.top = percentY + '%';
            marker.setAttribute('data-index', i);
            imageMarkers.appendChild(marker);
            
            extractMarkersList.push({ element: marker, percentX, percentY, index: i });

            marker.addEventListener('mousedown', (e) => {
                e.preventDefault();
                const index = parseInt(e.target.getAttribute('data-index'));
                const startX = e.clientX;
                const startY = e.clientY;
                const startPercentX = extractMarkersList[index].percentX;
                const startPercentY = extractMarkersList[index].percentY;

                function onMove(moveEvent) {
                    const markersRect = imageMarkers.getBoundingClientRect();
                    const deltaX = moveEvent.clientX - startX;
                    const deltaY = moveEvent.clientY - startY;
                    
                    const deltaPercentX = (deltaX / markersRect.width) * 100;
                    const deltaPercentY = (deltaY / markersRect.height) * 100;
                    
                    let newPercentX = startPercentX + deltaPercentX;
                    let newPercentY = startPercentY + deltaPercentY;
                    
                    // Обмежуємо межами зображення (0% - 100%)
                    newPercentX = Math.max(0, Math.min(100, newPercentX));
                    newPercentY = Math.max(0, Math.min(100, newPercentY));
                    
                    marker.style.left = newPercentX + '%';
                    marker.style.top = newPercentY + '%';
                    extractMarkersList[index].percentX = newPercentX;
                    extractMarkersList[index].percentY = newPercentY;
                    updateExtractSwatches();
                }
                function onUp() {
                    window.removeEventListener('mousemove', onMove);
                    window.removeEventListener('mouseup', onUp);
                }
                window.addEventListener('mousemove', onMove);
                window.addEventListener('mouseup', onUp);
            });
        }
        updateExtractSwatches();
    }

    function loadExtractImage(file, count) {
        const reader = new FileReader();
        reader.onload = (e) => {
            const img = new Image();
            img.onload = () => {
                const maxWidth = 700, maxHeight = 450;
                let width = img.width, height = img.height;
                const aspectRatio = width / height;
                
                if (width > maxWidth) {
                    width = maxWidth;
                    height = width / aspectRatio;
                }
                if (height > maxHeight) {
                    height = maxHeight;
                    width = height * aspectRatio;
                }
                
                imageCanvas.width = width; 
                imageCanvas.height = height;
                extractCtx.drawImage(img, 0, 0, width, height);
                
                imagePreview.style.display = 'flex';
                dropZone.style.display = 'none';
                currentExtractImage = file;
                renderSwatches('extract-colors-grid', count, false);
                
                // Невелика затримка для оновлення розмірів
                setTimeout(() => {
                    placeExtractMarkers(count);
                }, 50);
            };
            img.src = e.target.result;
        };
        reader.readAsDataURL(file);
    }

    function resetExtract() {
        imagePreview.style.display = 'none';
        dropZone.style.display = 'flex';
        currentExtractImage = null;
        extractMarkersList = [];
        rawExtractColors = [];
        renderSwatches('extract-colors-grid', parseInt(extractCountBtn.textContent), false);
    }

    dropZone.addEventListener('click', () => fileInput.click());
    dropZone.addEventListener('dragover', e => { e.preventDefault(); dropZone.classList.add('dragover'); });
    dropZone.addEventListener('dragleave', () => dropZone.classList.remove('dragover'));
    dropZone.addEventListener('drop', e => {
        e.preventDefault();
        dropZone.classList.remove('dragover');
        const file = e.dataTransfer.files[0];
        if (file && file.type.startsWith('image/')) loadExtractImage(file, parseInt(extractCountBtn.textContent));
    });
    fileInput.addEventListener('change', e => {
        if (e.target.files[0]) loadExtractImage(e.target.files[0], parseInt(extractCountBtn.textContent));
    });

    extractResetBtn.addEventListener('click', resetExtract);

    extractCountBtn.addEventListener('click', e => {
        e.stopPropagation();
        extractCountDropdown.classList.toggle('show');
    });
    document.addEventListener('click', e => {
        if (!extractCountBtn.contains(e.target) && !extractCountDropdown.contains(e.target))
            extractCountDropdown.classList.remove('show');
    });
    extractCountDropdown.querySelectorAll('.count-option').forEach(opt => {
        opt.addEventListener('click', () => {
            const val = opt.getAttribute('data-value');
            extractCountBtn.textContent = val;
            extractCountDropdown.querySelectorAll('.count-option').forEach(o => o.classList.remove('selected'));
            opt.classList.add('selected');
            extractCountDropdown.classList.remove('show');
            if (currentExtractImage) loadExtractImage(currentExtractImage, parseInt(val));
            else renderSwatches('extract-colors-grid', parseInt(val), false);
        });
    });

    moodBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            moodBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            currentExtractMood = btn.getAttribute('data-mood');
            if (rawExtractColors.length) applyMoodToExtract();
        });
    });

    renderSwatches('extract-colors-grid', 6, false);
    saveExtractBtn.addEventListener('click', () => {
        const colors = Array.from(document.querySelectorAll('#extract-colors-grid .color-hex')).map(el => el.textContent);
        saveCurrentPalette(colors);
    });

    // ==================== СТОРІНКА ВИТЯГУ ГРАДІЄНТА ====================
    const gradientDropZone = document.getElementById('gradient-drop-zone');
    const gradientFileInput = document.getElementById('gradient-file-input');
    const gradientImagePreview = document.getElementById('gradient-image-preview');
    const gradientImageCanvas = document.getElementById('gradient-image-canvas');
    const gradientImageMarkersContainer = document.getElementById('gradient-image-markers-container');
    const gradientImageMarkers = document.getElementById('gradient-image-markers');
    const gradientColorsGrid = document.getElementById('gradient-colors-grid');
    const saveGradientBtn = document.getElementById('save-gradient-palette');
    const gradientMoodBtns = document.querySelectorAll('#gradient-mood-selector .mood-btn');
    const gradientPreview = document.getElementById('gradient-preview');
    const gradientResetBtn = document.getElementById('gradient-reset-btn');
    const gradientCountBtn = document.getElementById('gradient-count-btn');
    const gradientCountDropdown = document.getElementById('gradient-count-dropdown');
    const gradientPolyline = document.getElementById('gradient-polyline');

    let currentGradientImage = null;
    let gradientMarkersList = [];
    let gradientCtx = gradientImageCanvas.getContext('2d');
    let currentGradientMood = 'none';
    let rawGradientColors = [];

    function findPositionForColor(targetRgb, ctx, width, height, step = 5) {
        let bestDist = Infinity, bestX = 0, bestY = 0;
        for (let y = 0; y < height; y += step) {
            for (let x = 0; x < width; x += step) {
                const pixel = ctx.getImageData(x, y, 1, 1).data;
                const dr = pixel[0] - targetRgb.r;
                const dg = pixel[1] - targetRgb.g;
                const db = pixel[2] - targetRgb.b;
                const dist = dr*dr + dg*dg + db*db;
                if (dist < bestDist) { bestDist = dist; bestX = x; bestY = y; }
            }
        }
        return { x: bestX, y: bestY };
    }

    function updateGradientLine() {
        if (!gradientMarkersList.length) return;
        const points = gradientMarkersList.map(m => {
            return `${m.percentX}% ${m.percentY}%`;
        }).join(', ');
        gradientPolyline.setAttribute('points', points);
    }

    function applyMoodToGradient() {
        const swatches = document.querySelectorAll('#gradient-colors-grid .color-card');
        rawGradientColors.forEach((rawHex, idx) => {
            if (idx >= swatches.length) return;
            const moodHex = applyMoodToHex(rawHex, currentGradientMood);
            swatches[idx].style.backgroundColor = moodHex;
            const hexEl = swatches[idx].querySelector('.color-hex');
            hexEl.textContent = moodHex;
            hexEl.setAttribute('data-color', moodHex);
            if (gradientMarkersList[idx]) gradientMarkersList[idx].element.style.backgroundColor = moodHex;
        });
        const colors = Array.from(swatches).map(card => card.style.backgroundColor);
        if (colors.length) gradientPreview.style.background = `linear-gradient(to right, ${colors.join(', ')})`;
    }

    function updateGradientSwatches() {
        const swatches = document.querySelectorAll('#gradient-colors-grid .color-card');
        gradientMarkersList.forEach((marker, idx) => {
            if (idx >= swatches.length) return;
            const canvasX = Math.floor((marker.percentX / 100) * gradientImageCanvas.width);
            const canvasY = Math.floor((marker.percentY / 100) * gradientImageCanvas.height);
            const x = Math.max(0, Math.min(gradientImageCanvas.width - 1, canvasX));
            const y = Math.max(0, Math.min(gradientImageCanvas.height - 1, canvasY));
            const pixel = gradientCtx.getImageData(x, y, 1, 1).data;
            const rawHex = '#' + [pixel[0], pixel[1], pixel[2]].map(v => v.toString(16).padStart(2,'0')).join('');
            rawGradientColors[idx] = rawHex;
        });
        applyMoodToGradient();
        updateGradientLine();
    }

    function updateGradientMarkersContainer() {
        // Оновлюємо розміри контейнера меток відповідно до розмірів canvas
        const canvasRect = gradientImageCanvas.getBoundingClientRect();
        
        gradientImageMarkers.style.width = canvasRect.width + 'px';
        gradientImageMarkers.style.height = canvasRect.height + 'px';
    }

    function placeGradientMarkers(count) {
        gradientImageMarkers.innerHTML = '';
        gradientMarkersList = [];
        rawGradientColors = [];

        // Оновлюємо розміри контейнера меток
        updateGradientMarkersContainer();

        let palette;
        try {
            palette = colorThief.getPalette(gradientImageCanvas, count);
            if (!palette || palette.length < count) throw new Error('Недостатньо кольорів');
        } catch (e) {
            palette = [];
            for (let i = 0; i < count; i++) {
                palette.push([Math.random()*255, Math.random()*255, Math.random()*255]);
            }
        }

        const positions = palette.map(rgb => findPositionForColor({ r: rgb[0], g: rgb[1], b: rgb[2] }, gradientCtx, gradientImageCanvas.width, gradientImageCanvas.height, 5));
        positions.sort((a,b) => a.x - b.x);

        for (let i = 0; i < count; i++) {
            const pos = positions[i];
            const percentX = (pos.x / gradientImageCanvas.width) * 100;
            const percentY = (pos.y / gradientImageCanvas.height) * 100;
            
            const marker = document.createElement('div');
            marker.className = 'image-marker';
            marker.style.left = percentX + '%';
            marker.style.top = percentY + '%';
            marker.setAttribute('data-index', i);
            gradientImageMarkers.appendChild(marker);
            
            gradientMarkersList.push({ element: marker, percentX, percentY, index: i });

            marker.addEventListener('mousedown', (e) => {
                e.preventDefault();
                const index = parseInt(e.target.getAttribute('data-index'));
                const startX = e.clientX;
                const startY = e.clientY;
                const startPercentX = gradientMarkersList[index].percentX;
                const startPercentY = gradientMarkersList[index].percentY;

                function onMove(moveEvent) {
                    const markersRect = gradientImageMarkers.getBoundingClientRect();
                    const deltaX = moveEvent.clientX - startX;
                    const deltaY = moveEvent.clientY - startY;
                    
                    const deltaPercentX = (deltaX / markersRect.width) * 100;
                    const deltaPercentY = (deltaY / markersRect.height) * 100;
                    
                    let newPercentX = startPercentX + deltaPercentX;
                    let newPercentY = startPercentY + deltaPercentY;
                    
                    // Обмежуємо межами зображення (0% - 100%)
                    newPercentX = Math.max(0, Math.min(100, newPercentX));
                    newPercentY = Math.max(0, Math.min(100, newPercentY));
                    
                    marker.style.left = newPercentX + '%';
                    marker.style.top = newPercentY + '%';
                    gradientMarkersList[index].percentX = newPercentX;
                    gradientMarkersList[index].percentY = newPercentY;
                    updateGradientSwatches();
                }
                function onUp() {
                    window.removeEventListener('mousemove', onMove);
                    window.removeEventListener('mouseup', onUp);
                }
                window.addEventListener('mousemove', onMove);
                window.addEventListener('mouseup', onUp);
            });
        }
        updateGradientSwatches();
    }

    function loadGradientImage(file, count) {
        const reader = new FileReader();
        reader.onload = (e) => {
            const img = new Image();
            img.onload = () => {
                const maxWidth = 700, maxHeight = 450;
                let width = img.width, height = img.height;
                const aspectRatio = width / height;
                
                if (width > maxWidth) {
                    width = maxWidth;
                    height = width / aspectRatio;
                }
                if (height > maxHeight) {
                    height = maxHeight;
                    width = height * aspectRatio;
                }
                
                gradientImageCanvas.width = width; 
                gradientImageCanvas.height = height;
                gradientCtx.drawImage(img, 0, 0, width, height);
                
                gradientImagePreview.style.display = 'flex';
                gradientDropZone.style.display = 'none';
                currentGradientImage = file;
                renderSwatches('gradient-colors-grid', count, false);
                
                // Невелика затримка для оновлення розмірів
                setTimeout(() => {
                    placeGradientMarkers(count);
                }, 50);
            };
            img.src = e.target.result;
        };
        reader.readAsDataURL(file);
    }

    function resetGradient() {
        gradientImagePreview.style.display = 'none';
        gradientDropZone.style.display = 'flex';
        currentGradientImage = null;
        gradientMarkersList = [];
        rawGradientColors = [];
        renderSwatches('gradient-colors-grid', parseInt(gradientCountBtn.textContent), false);
        gradientPreview.style.background = 'linear-gradient(to right, #000, #fff)';
        gradientPolyline.setAttribute('points', '');
    }

    gradientDropZone.addEventListener('click', () => gradientFileInput.click());
    gradientDropZone.addEventListener('dragover', e => { e.preventDefault(); gradientDropZone.classList.add('dragover'); });
    gradientDropZone.addEventListener('dragleave', () => gradientDropZone.classList.remove('dragover'));
    gradientDropZone.addEventListener('drop', e => {
        e.preventDefault();
        gradientDropZone.classList.remove('dragover');
        const file = e.dataTransfer.files[0];
        if (file && file.type.startsWith('image/')) loadGradientImage(file, parseInt(gradientCountBtn.textContent));
    });
    gradientFileInput.addEventListener('change', e => {
        if (e.target.files[0]) loadGradientImage(e.target.files[0], parseInt(gradientCountBtn.textContent));
    });

    gradientResetBtn.addEventListener('click', resetGradient);

    gradientCountBtn.addEventListener('click', e => {
        e.stopPropagation();
        gradientCountDropdown.classList.toggle('show');
    });
    document.addEventListener('click', e => {
        if (!gradientCountBtn.contains(e.target) && !gradientCountDropdown.contains(e.target))
            gradientCountDropdown.classList.remove('show');
    });
    gradientCountDropdown.querySelectorAll('.count-option').forEach(opt => {
        opt.addEventListener('click', () => {
            const val = opt.getAttribute('data-value');
            gradientCountBtn.textContent = val;
            gradientCountDropdown.querySelectorAll('.count-option').forEach(o => o.classList.remove('selected'));
            opt.classList.add('selected');
            gradientCountDropdown.classList.remove('show');
            if (currentGradientImage) loadGradientImage(currentGradientImage, parseInt(val));
            else renderSwatches('gradient-colors-grid', parseInt(val), false);
        });
    });

    gradientMoodBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            gradientMoodBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            currentGradientMood = btn.getAttribute('data-mood');
            if (rawGradientColors.length) applyMoodToGradient();
        });
    });

    renderSwatches('gradient-colors-grid', 6, false);
    saveGradientBtn.addEventListener('click', () => {
        const colors = Array.from(document.querySelectorAll('#gradient-colors-grid .color-hex')).map(el => el.textContent);
        saveCurrentPalette(colors);
    });

})();

// ==================== СКРИПТ ЗМІНИ АКЦЕНТНОГО КОЛЬОРУ ====================
(function() {
    let hueAccent = 210;
    let hueBefore = 180;
    let hueAfter = 200;
    const step = 360 / (5 * 60 * 1000 / 100);

    function updateColors() {
        hueAccent = (hueAccent + step) % 360;
        hueBefore = (hueBefore + step * 0.8) % 360;
        hueAfter = (hueAfter + step * 1.2) % 360;

        const accentColor = `hsl(${hueAccent}, 55%, 55%)`;
        const beforeColor = `hsla(${hueBefore}, 80%, 60%, 0.5)`;
        const afterColor = `hsla(${hueAfter}, 80%, 60%, 0.6)`;

        document.documentElement.style.setProperty('--accent', accentColor);
        document.documentElement.style.setProperty('--before-color', beforeColor);
        document.documentElement.style.setProperty('--after-color', afterColor);
    }

    setInterval(updateColors, 40);
    updateColors();
})();
