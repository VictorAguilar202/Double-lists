# AquaSurvey — Doubly Linked List Case Study

## Real-world case

AquaSurvey is an educational prototype for a **subsea archaeological survey team**.

During an underwater survey, researchers define checkpoints such as a shipwreck bow, ceramic field, anchor area, or debris field. New evidence can require a checkpoint to be inserted between two existing checkpoints, or an obsolete checkpoint to be removed.

The project demonstrates why a **doubly linked list** fits the situation: each node keeps references to the previous and next checkpoint, so the route can be traversed in both directions and local nodes can be inserted or removed. This matches the concepts in the class presentation.

## Files

```text
AquaSurvey_DoublyLinkedList/
├── app.py
├── doubly_linked_list.py
├── run.bat
├── README.md
└── frontend/
    ├── index.html
    ├── styles.css
    └── app.js
```

## What the Python structure demonstrates

- `head` and `tail` references.
- `prev` and `next` references on every node.
- Append at the tail.
- Insert after a selected node.
- Delete a node and reconnect both directions.
- Forward traversal: `head → tail`.
- Backward traversal: `tail → head`.
- Search by checkpoint code.

## Frontend

The web interface lets the user select checkpoints, move forward/backward, append, insert, delete, and reset the route.

The interface has **two operating modes**:

1. **Python mode:** when `app.py` is running, the buttons use the Python doubly linked list in the backend.
2. **Browser demo mode:** when the Python backend is unavailable, the interface automatically uses a JavaScript doubly linked list with the same `prev`/`next` behavior. This means the buttons still work instead of producing `Failed to fetch` errors.

## Run with Python

Recommended:

```bash
python app.py
```

Then open:

```text
http://127.0.0.1:8000
```

On Windows, you can also double-click `run.bat`.

## Run with Live Server

You may open `frontend/index.html` with Live Server. If Python is not running, the page automatically switches to **Browser demo mode**, so the controls remain functional.

To connect Live Server to the Python backend, start `python app.py` first and then click **Reconnect Python**.

## Requirements

Python 3.10+ for the backend. No external Python packages are required.

## Academic note

This is a functional educational simulation. It does not connect to real underwater sensors or archaeological equipment.
