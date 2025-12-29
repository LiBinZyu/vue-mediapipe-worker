import { type GestureState } from '../composables/useGesture';

// Singleton to track drag state across frames
let dragTarget: Element | null = null;
let middleDragTarget: Element | null = null;

export function processGestureInteraction(state: GestureState) {
    if (!state.cursor.active) return;

    const { x, y } = state.cursor;

    // 0. Find Target
    let target = document.elementFromPoint(x, y);
    if (!target) return;

    // 1. Dispatch Global Mouse Move (Always)
    // We need to pass current buttons state for consistency
    // If dragging left: buttons=1. If dragging middle: buttons=4.
    let currentButtons = 0;
    if (dragTarget) currentButtons |= 1;
    if (middleDragTarget) currentButtons |= 4;

    dispatchMouseEvent('mousemove', x, y, target, currentButtons, 0);

    // 2. Handle Events
    const events = state.events;

    // CLICK (Left)
    if (events['CLICK']) {
        dispatchMouseEvent('mousedown', x, y, target, 1, 0);
        dispatchMouseEvent('mouseup', x, y, target, 0, 0);
        dispatchMouseEvent('click', x, y, target, 0, 0);
    }

    // DRAG START (Left - Index Pinch)
    if (events['DRAG_START'] && !dragTarget) {
        dragTarget = target;
        dispatchMouseEvent('mousedown', x, y, dragTarget, 1, 0); // button 0
    }

    // DRAG END (Left)
    if (events['DRAG_END'] && dragTarget) {
        dispatchMouseEvent('mouseup', x, y, dragTarget, 0, 0);
        dragTarget = null;
    }

    // DRAG MIDDLE START (Middle - Middle Pinch) -> Rotate
    if (events['DRAG_MIDDLE_START'] && !middleDragTarget) {
        middleDragTarget = target;
        dispatchMouseEvent('mousedown', x, y, middleDragTarget, 4, 1); // button 1
    }

    // DRAG MIDDLE END
    if (events['DRAG_MIDDLE_END'] && middleDragTarget) {
        dispatchMouseEvent('mouseup', x, y, middleDragTarget, 0, 1);
        middleDragTarget = null;
    }

    // DOUBLE CLICK
    if (events['DOUBLE_CLICK']) {
        dispatchMouseEvent('dblclick', x, y, target, 0, 0);
    }
}

/**
 * Dispatch Synthetic Mouse Event
 * @param type Event type
 * @param clientX X coord
 * @param clientY Y coord
 * @param target Target element
 * @param buttons Bitmask (1=Left, 2=Right, 4=Middle)
 * @param button Button index (0=Left, 1=Middle, 2=Right) - used mainly for mousedown/up
 */
function dispatchMouseEvent(type: string, clientX: number, clientY: number, target: Element, buttons: number, button: number) {
    const event = new MouseEvent(type, {
        bubbles: true,
        cancelable: true,
        view: window,
        clientX,
        clientY,
        screenX: clientX,
        screenY: clientY,
        buttons: buttons,
        button: button,
    });
    target.dispatchEvent(event);
}
