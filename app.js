const $ = (id) => document.getElementById(id);

const API_BASE = window.location.protocol === 'file:' || window.location.port !== '8000'
    ? 'http://127.0.0.1:8000'
    : '';

let backendAvailable = false;
let localList = createLocalList();

function createLocalList() {
    const list = { head: null, tail: null, size: 0, nodes: new Map() };

    function append(value) {
        const node = { value, prev: list.tail, next: null };
        if (!list.head) list.head = node;
        else list.tail.next = node;
        list.tail = node;
        list.nodes.set(value.code, node);
        list.size++;
        return node;
    }

    function insertAfter(code, value) {
        const current = list.nodes.get(code);
        if (!current) throw new Error('Selected checkpoint does not exist.');
        const node = { value, prev: current, next: current.next };
        if (current.next) current.next.prev = node;
        else list.tail = node;
        current.next = node;
        list.nodes.set(value.code, node);
        list.size++;
    }

    function removeNode(code) {
        const node = list.nodes.get(code);
        if (!node) throw new Error('Select a checkpoint first.');
        if (node.prev) node.prev.next = node.next;
        else list.head = node.next;
        if (node.next) node.next.prev = node.prev;
        else list.tail = node.prev;
        list.nodes.delete(code);
        list.size--;
    }

    function find(code) { return list.nodes.get(code) || null; }

    function forward() {
        const values = [];
        let current = list.head;
        while (current) { values.push(current.value); current = current.next; }
        return values;
    }

    function backward() {
        const values = [];
        let current = list.tail;
        while (current) { values.push(current.value); current = current.prev; }
        return values;
    }

    function clear() {
        list.head = list.tail = null;
        list.size = 0;
        list.nodes.clear();
    }

    return { append, insertAfter, removeNode, find, forward, backward, clear, get head() { return list.head; }, get tail() { return list.tail; }, get size() { return list.size; } };
}

const demo = [
    ['AS-01', 'Shipwreck bow', 'Sector A', 42, 'Mapped'],
    ['AS-02', 'Ceramic field', 'Sector B', 58, 'Pending'],
    ['AS-03', 'Stone anchor', 'Sector C', 64, 'Pending'],
    ['AS-04', 'Cargo scatter', 'Sector D', 71, 'Pending'],
    ['AS-05', 'Hull debris', 'Sector E', 79, 'Pending']
];

function makeLocalValue(code, name, zone, depth, status) {
    return { code, name, zone, depth: Number(depth), status };
}

let localSelected = null;

function resetLocal() {
    localList = createLocalList();
    demo.forEach(item => localList.append(makeLocalValue(...item)));
    localSelected = 'AS-01';
}

resetLocal();

function localPayload() {
    return {
        head: localList.head ? localList.head.value.code : null,
        tail: localList.tail ? localList.tail.value.code : null,
        selected: localSelected,
        count: localList.size,
        forward: localList.forward(),
        backward: localList.backward()
    };
}

function nextLocalCode() {
    let max = 0;
    localList.forward().forEach(item => {
        const n = Number(item.code.split('-')[1]);
        if (Number.isFinite(n)) max = Math.max(max, n);
    });
    return `AS-${String(max + 1).padStart(2, '0')}`;
}

async function fetchJson(url, options = {}) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 900);
    try {
        const response = await fetch(url, { ...options, cache: 'no-store', signal: controller.signal });
        const raw = await response.text();
        let data;
        try { data = JSON.parse(raw); }
        catch { throw new Error(`Server response was not valid JSON (HTTP ${response.status}).`); }
        if (!response.ok) throw new Error(data.error || `HTTP ${response.status}`);
        return data;
    } finally {
        clearTimeout(timer);
    }
}

async function backendState() {
    return fetchJson(`${API_BASE}/api/state`);
}

async function backendAction(action, extra = {}) {
    return fetchJson(`${API_BASE}/api/action`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, ...extra })
    });
}

async function state() {
    try {
        const data = await backendState();
        backendAvailable = true;
        setConnection('Python backend connected', true);
        return data;
    } catch (error) {
        backendAvailable = false;
        setConnection('Browser demo mode · Python backend not detected', false);
        return localPayload();
    }
}

async function action(actionName, extra = {}) {
    if (backendAvailable) {
        try {
            return await backendAction(actionName, extra);
        } catch (error) {
            backendAvailable = false;
            setConnection('Browser demo mode · connection lost', false);
        }
    }

    return performLocalAction(actionName, extra);
}

function performLocalAction(actionName, extra) {
    switch (actionName) {
        case 'append': {
            const code = nextLocalCode();
            localList.append(makeLocalValue(code, extra.name, extra.zone, extra.depth, extra.status));
            localSelected = code;
            break;
        }
        case 'insert_after': {
            const code = nextLocalCode();
            localList.insertAfter(extra.after_code, makeLocalValue(code, extra.name, extra.zone, extra.depth, extra.status));
            localSelected = code;
            break;
        }
        case 'delete': {
            const current = localList.find(localSelected);
            const replacement = current ? (current.next || current.prev || null) : null;
            localList.removeNode(localSelected);
            localSelected = replacement ? replacement.value.code : null;
            break;
        }
        case 'move': {
            const current = localList.find(localSelected);
            if (!current) throw new Error('Select a checkpoint first.');
            const target = extra.direction === 'next' ? current.next : current.prev;
            if (target) localSelected = target.value.code;
            break;
        }
        case 'select':
            if (!localList.find(extra.code)) throw new Error('Checkpoint not found.');
            localSelected = extra.code;
            break;
        case 'reset':
            resetLocal();
            break;
        default:
            throw new Error('Unknown operation.');
    }
    return localPayload();
}

function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#039;' }[c]));
}

function setConnection(message, online) {
    const element = $('connection');
    if (!element) return;
    element.textContent = message;
    element.className = online ? 'connection online' : 'connection offline';
}

function render(data) {
    $('count').textContent = data.count;
    $('head').textContent = data.head || '—';
    $('tail').textContent = data.tail || '—';
    $('selected').textContent = data.selected || '—';

    $('route').innerHTML = '';
    data.forward.forEach((item, index) => {
        const node = document.createElement('div');
        node.className = `node ${item.code === data.selected ? 'selected' : ''}`;
        node.innerHTML = `<div class="code">${escapeHtml(item.code)}</div>
            <h3>${escapeHtml(item.name)}</h3>
            <small>${escapeHtml(item.zone)} · ${item.depth} m</small>
            <span class="status-chip">${escapeHtml(item.status)}</span>`;
        node.addEventListener('click', async () => {
            try { render(await action('select', { code: item.code })); }
            catch (error) { showMessage(error.message, true); }
        });
        $('route').appendChild(node);
        if (index < data.forward.length - 1) {
            const arrow = document.createElement('div');
            arrow.className = 'arrow';
            arrow.textContent = '↔';
            $('route').appendChild(arrow);
        }
    });

    $('backward').innerHTML = '';
    data.backward.forEach((item, index) => {
        const chip = document.createElement('div');
        chip.className = 'back-node';
        chip.innerHTML = `<strong>${escapeHtml(item.code)}</strong> · ${escapeHtml(item.name)}`;
        $('backward').appendChild(chip);
        if (index < data.backward.length - 1) {
            const arrow = document.createElement('span');
            arrow.textContent = '←';
            arrow.className = 'reverse-arrow';
            $('backward').appendChild(arrow);
        }
    });
}

function formData() {
    return {
        name: $('name').value.trim(),
        zone: $('zone').value.trim(),
        depth: Number($('depth').value),
        status: $('status').value
    };
}

function validate(data) {
    if (!data.name || !data.zone) throw new Error('Complete the checkpoint name and survey zone.');
    if (!Number.isInteger(data.depth) || data.depth < 1 || data.depth > 200) {
        throw new Error('Depth must be an integer from 1 to 200 meters.');
    }
}

function clearForm() {
    $('name').value = '';
    $('zone').value = '';
    $('depth').value = '';
    $('status').value = 'Pending';
}

function showMessage(message, error = false) {
    const box = $('message');
    box.textContent = message;
    box.className = `message ${error ? 'error' : 'success'}`;
    clearTimeout(showMessage.timer);
    showMessage.timer = setTimeout(() => box.className = 'message', 2600);
}

$('checkpointForm').addEventListener('submit', async event => {
    event.preventDefault();
    try {
        const data = formData();
        validate(data);
        render(await action('append', data));
        clearForm();
        showMessage('Checkpoint added to the tail.');
    } catch (error) { showMessage(error.message, true); }
});

$('insertBtn').addEventListener('click', async () => {
    try {
        const data = formData();
        validate(data);
        const current = await state();
        if (!current.selected) throw new Error('Select a checkpoint first.');
        render(await action('insert_after', { ...data, after_code: current.selected }));
        clearForm();
        showMessage(`Checkpoint inserted after ${current.selected}.`);
    } catch (error) { showMessage(error.message, true); }
});

$('deleteBtn').addEventListener('click', async () => {
    try {
        const current = await state();
        if (!current.selected) throw new Error('Select a checkpoint first.');
        const code = current.selected;
        render(await action('delete'));
        showMessage(`${code} was removed and the links were reconnected.`);
    } catch (error) { showMessage(error.message, true); }
});

$('forwardBtn').addEventListener('click', async () => {
    try { render(await action('move', { direction: 'next' })); }
    catch (error) { showMessage(error.message, true); }
});

$('backBtn').addEventListener('click', async () => {
    try { render(await action('move', { direction: 'previous' })); }
    catch (error) { showMessage(error.message, true); }
});

$('resetBtn').addEventListener('click', async () => {
    try { render(await action('reset')); showMessage('Demo route restored.'); }
    catch (error) { showMessage(error.message, true); }
});

$('reconnectBtn').addEventListener('click', async () => {
    try {
        const data = await backendState();
        backendAvailable = true;
        setConnection('Python backend connected', true);
        render(data);
        showMessage('Connected to Python backend.');
    } catch (error) {
        backendAvailable = false;
        setConnection('Browser demo mode · Python backend not detected', false);
        showMessage('Python is still offline. Browser demo mode remains available.', true);
    }
});

state().then(render);
