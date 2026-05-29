// State Management
let currentFile = null;
let roomStructure = null;
let placedFurniture = [];
let currentBaseImage = "";
let selectedElement = null;

// Navigation with cleanup
function showSection(sectionId) {
    document.querySelectorAll('.section').forEach(s => {
        s.classList.remove('active');
        s.style.display = 'none';
    });

    const target = document.getElementById(sectionId);
    target.classList.add('active');
    target.style.display = (sectionId === 'editor') ? 'grid' : 'block';
    
    if (sectionId === 'home') {
        document.body.style.background = 'var(--bg-dark)';
    } else {
        document.body.style.background = '#020617';
    }
    window.scrollTo(0, 0);
}

// Auth handling with STRICT validation
function handleAuth() {
    const name = document.getElementById('user-name').value.trim();
    const email = document.getElementById('user-email').value.trim();
    
    const nameRegex = /^[a-zA-Zա-ֆԱ-Ֆև\s]{2,}$/;
    if (!nameRegex.test(name)) {
        alert("Խնդրում ենք լրացնել վավեր անուն (միայն տառեր, նվազագույնը 2 նիշ):");
        return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
        alert("Խնդրում ենք լրացնել վավեր էլ. հասցե (օրինակ՝ user@example.com):");
        return;
    }

    alert(`Բարև ${name}: Գրանցումը հաջողվեց:`);
    showSection('upload');
}

function openAbout() { document.getElementById('about-modal').style.display = 'block'; }
function closeAbout() { document.getElementById('about-modal').style.display = 'none'; }

// Upload Handling
const dropZone = document.getElementById('drop-zone');
const fileInput = document.getElementById('file-input');
const previewContainer = document.getElementById('preview-container');
const imagePreview = document.getElementById('image-preview');

if (dropZone) {
    dropZone.onclick = () => fileInput.click();
    fileInput.onchange = (e) => { if (e.target.files[0]) handleFile(e.target.files[0]); };
    dropZone.ondragover = (e) => { e.preventDefault(); dropZone.classList.add('drag-over'); };
    dropZone.ondragleave = () => dropZone.classList.remove('drag-over');
    dropZone.ondrop = (e) => {
        e.preventDefault();
        if (e.dataTransfer.files[0]) handleFile(e.dataTransfer.files[0]);
    };
}

function handleFile(file) {
    currentFile = file;
    const reader = new FileReader();
    reader.onload = (e) => {
        imagePreview.src = e.target.result;
        previewContainer.style.display = 'block';
        dropZone.style.display = 'none';
    };
    reader.readAsDataURL(file);
}

// Backend Integration & Scanning
document.addEventListener('DOMContentLoaded', () => {
    const analyzeBtn = document.getElementById('analyze-btn');
    if (analyzeBtn) {
        analyzeBtn.onclick = async () => {
            if (!currentFile) return;
            analyzeBtn.innerText = "Սկանավորվում է...";
            analyzeBtn.disabled = true;

            const formData = new FormData();
            formData.append('file', currentFile);

            try {
                const response = await fetch('/upload', { method: 'POST', body: formData });
                const data = await response.json();
                
                if (data.filename) {
                    roomStructure = data.structure;
                    currentBaseImage = `/uploads/${data.filename}`;
                    
                    // Անմիջապես անցնել խմբագրիչին
                    showSection('editor');
                    document.getElementById('editor-base-img').src = currentBaseImage;
                    
                    // Սկանավորման գծերը ցույց տալ մի փոքր ուշացումով
                    setTimeout(renderStructure, 800);
                } else {
                    alert("Սխալ: Սերվերը չի վերադարձրել նկարի անունը:");
                }
            } catch (err) {
                console.error("Scan Error:", err);
                // Եթե նույնիսկ սխալ լինի, թույլ տանք օգտատիրոջը անցնել խմբագրիչ, որպեսզի կանգ չառնի
                alert("Սերվերը դանդաղ է աշխատում, բայց մենք բացում ենք խմբագրիչը...");
                showSection('editor');
            }

            } catch (err) {
                console.error(err);
                alert("Սկանավորման սխալ: Փորձեք կրկին:");
            } finally {
                analyzeBtn.innerText = "Սկսել Սկանավորումը";
                analyzeBtn.disabled = false;
            }
        };
    }
    loadDashboard();
});

function startEditor(imageSrc) {
    document.getElementById('editor-base-img').src = imageSrc;
    showSection('editor');
    setTimeout(renderStructure, 500);
}

function renderStructure() {
    const overlay = document.getElementById('canvas-overlay');
    if (!overlay) return;
    overlay.innerHTML = '';
    if (!roomStructure) return;

    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("width", "100%"); svg.setAttribute("height", "100%");
    svg.style.position = "absolute"; svg.style.top = "0"; svg.style.left = "0";

    if (roomStructure.walls) {
        roomStructure.walls.forEach(wall => {
            const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
            line.setAttribute("x1", wall.start[0]); line.setAttribute("y1", wall.start[1]);
            line.setAttribute("x2", wall.end[0]); line.setAttribute("y2", wall.end[1]);
            line.setAttribute("stroke", "#6366f1"); line.setAttribute("stroke-width", "3");
            line.style.filter = "drop-shadow(0 0 5px #6366f1)";
            svg.appendChild(line);
        });
    }
    overlay.appendChild(svg);
    overlay.classList.add('scanning-active');
    setTimeout(() => overlay.classList.remove('scanning-active'), 2000);
}

// Editor Logic
function allowDrop(ev) { ev.preventDefault(); }
function drag(ev) {
    ev.dataTransfer.setData("type", ev.target.getAttribute('data-type'));
    ev.dataTransfer.setData("icon", ev.target.getAttribute('data-icon'));
}
function drop(ev) {
    ev.preventDefault();
    const type = ev.dataTransfer.getData("type");
    const icon = ev.dataTransfer.getData("icon");
    const rect = document.getElementById('editor-viewport').getBoundingClientRect();
    addFurnitureToCanvas(type, icon, ev.clientX - rect.left, ev.clientY - rect.top);
}

function addFurnitureToCanvas(type, icon, x, y) {
    const furn = document.createElement('div');
    furn.className = 'placed-furn';
    furn.style.left = `${x}px`; furn.style.top = `${y}px`;
    furn.style.fontSize = '3rem';
    furn.dataset.rotation = 0;
    
    const content = document.createElement('span');
    content.innerText = icon;
    furn.appendChild(content);

    const controls = document.createElement('div');
    controls.className = 'furn-controls';
    controls.innerHTML = `
        <button class="control-btn" title="Մեծացնել" onclick="resizeFurn(event, 1.1)">+</button>
        <button class="control-btn" title="Փոքրացնել" onclick="resizeFurn(event, 0.9)">-</button>
        <button class="control-btn" title="Պտտել" onclick="rotateFurn(event, 45)">🔄</button>
        <button class="control-btn" title="Հեռացնել" onclick="deleteFurn(event)">🗑️</button>
    `;
    furn.appendChild(controls);
    
    furn.onclick = (e) => { e.stopPropagation(); selectElement(furn); };
    furn.onmousedown = (e) => startDrag(e, furn);
    document.getElementById('editor-viewport').appendChild(furn);
}

function rotateFurn(e, degrees) {
    e.stopPropagation();
    const furn = e.target.closest('.placed-furn');
    let currentRotation = parseInt(furn.dataset.rotation) || 0;
    currentRotation = (currentRotation + degrees) % 360;
    furn.dataset.rotation = currentRotation;
    furn.style.transform = `rotate(${currentRotation}deg)`;
}

function selectElement(el) {
    if (selectedElement) selectedElement.classList.remove('selected');
    selectedElement = el;
    selectedElement.classList.add('selected');
}

document.getElementById('editor-viewport').onclick = () => {
    if (selectedElement) selectedElement.classList.remove('selected');
    selectedElement = null;
};

function resizeFurn(e, factor) {
    e.stopPropagation();
    const furn = e.target.closest('.placed-furn');
    const currentSize = parseFloat(window.getComputedStyle(furn).fontSize);
    furn.style.fontSize = (currentSize * factor) + 'px';
}

function deleteFurn(e) { e.stopPropagation(); e.target.closest('.placed-furn').remove(); }

function startDrag(e, element) {
    let pos1 = 0, pos2 = 0, pos3 = e.clientX, pos4 = e.clientY;
    document.onmousemove = (ev) => {
        pos1 = pos3 - ev.clientX; pos2 = pos4 - ev.clientY;
        pos3 = ev.clientX; pos4 = ev.clientY;
        element.style.top = (element.offsetTop - pos2) + "px";
        element.style.left = (element.offsetLeft - pos1) + "px";
    };
    document.onmouseup = () => { document.onmousemove = null; document.onmouseup = null; };
}

function changeColor(part) {
    const color = document.getElementById(`${part}-color`).value;
    const overlay = document.getElementById('canvas-overlay');
    let colorLayer = document.getElementById(`overlay-${part}`);
    if (!colorLayer) {
        colorLayer = document.createElement('div');
        colorLayer.id = `overlay-${part}`;
        colorLayer.style.position = 'absolute'; colorLayer.style.top = '0'; colorLayer.style.left = '0';
        colorLayer.style.width = '100%'; colorLayer.style.height = '100%';
        colorLayer.style.pointerEvents = 'none'; colorLayer.style.mixBlendMode = 'multiply';
        colorLayer.style.opacity = '0.3';
        overlay.appendChild(colorLayer);
    }
    colorLayer.style.backgroundColor = color;
}

async function saveCurrentProject() {
    const project = { image: currentBaseImage, furniture: placedFurniture, timestamp: new Date().toISOString() };
    try {
        await fetch('/save-project', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(project)
        });
        const finalPreview = document.getElementById('final-preview');
        finalPreview.innerHTML = `<img src="${currentBaseImage}" style="width:100%; border-radius:15px;">`;
        showSection('summary');
    } catch (err) { alert("Պահպանման սխալ:"); }
}

async function loadDashboard() {
    try {
        const response = await fetch('/projects');
        const projects = await response.json();
        const list = document.getElementById('projects-list');
        list.innerHTML = '';
        projects.forEach(p => {
            const card = document.createElement('div');
            card.className = 'project-card glass-card';
            card.innerHTML = `<img src="${p.image}" alt="Project"><p>Saved: ${new Date(p.timestamp).toLocaleDateString()}</p>`;
            list.appendChild(card);
        });
    } catch (e) {}
}
