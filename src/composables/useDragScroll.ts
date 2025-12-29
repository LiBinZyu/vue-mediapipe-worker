import { ref, onMounted, onUnmounted, type Ref } from 'vue';

export function useDragScroll(containerRef: Ref<HTMLElement | null>) {
    const scrollTop = ref(0);
    const maxScroll = ref(0);

    // Physics
    let velocity = 0;
    let lastY = 0;
    let isDragging = false;
    let animationFrame = 0;

    const updateMaxScroll = () => {
        if (!containerRef.value) return;
        maxScroll.value = Math.max(0, containerRef.value.scrollHeight - containerRef.value.clientHeight);
    };

    const applyScroll = () => {
        if (containerRef.value) {
            containerRef.value.scrollTop = scrollTop.value;
        }
    };

    const momentumLoop = () => {
        if (isDragging) return;
        if (Math.abs(velocity) < 0.1) return;

        scrollTop.value += velocity; // Note: Dragging up -> scrollTop increases (content moves up). 
        // But dy is (current - last). If moving down (dy > 0), we want to scroll UP (decrease scrollTop)?
        // Standard drag: Pull down -> Content moves down -> ScrollTop decreases.
        // So scrollTop -= dy.
        // Velocity was set to -dy.
        // So scrollTop += velocity is correct.

        velocity *= 0.95; // Friction

        // Clamp
        if (scrollTop.value < 0) {
            scrollTop.value = 0;
            velocity = 0;
        } else if (scrollTop.value > maxScroll.value) {
            scrollTop.value = maxScroll.value;
            velocity = 0;
        }

        applyScroll();
        animationFrame = requestAnimationFrame(momentumLoop);
    };

    const onStartDrag = (e: MouseEvent) => {
        // Only trigger if we have scrollable content
        updateMaxScroll();
        if (maxScroll.value <= 0) return;

        isDragging = true;
        lastY = e.clientY;
        velocity = 0;
        if (animationFrame) cancelAnimationFrame(animationFrame);

        // Normalize scrollTop from DOM in case it was changed externally (wheel)
        if (containerRef.value) scrollTop.value = containerRef.value.scrollTop;

        // Prevent selection
        document.body.style.userSelect = 'none';

        window.addEventListener('mousemove', onDragMove);
        window.addEventListener('mouseup', onStopDrag);
    };

    const onDragMove = (e: MouseEvent) => {
        if (!isDragging) return;
        const dy = e.clientY - lastY;
        scrollTop.value -= dy;
        velocity = -dy;

        // Clamp immediate
        scrollTop.value = Math.max(0, Math.min(scrollTop.value, maxScroll.value));
        applyScroll();

        lastY = e.clientY;
    };

    const onStopDrag = () => {
        if (isDragging) {
            isDragging = false;
            document.body.style.userSelect = '';
            window.removeEventListener('mousemove', onDragMove);
            window.removeEventListener('mouseup', onStopDrag);
            momentumLoop();
        }
    };

    // Auto-bind? Or expose handlers?
    // Exposing handlers allows fine-grained control (e.g. only header triggers drag?)
    // But user wants "automatic handling".
    // Let's expose handlers.

    // Also handle Resize to update limits
    onMounted(() => {
        window.addEventListener('resize', updateMaxScroll);
        // Initial sync
        updateMaxScroll();
    });

    onUnmounted(() => {
        window.removeEventListener('resize', updateMaxScroll);
        window.removeEventListener('mousemove', onDragMove);
        window.removeEventListener('mouseup', onStopDrag);
        if (animationFrame) cancelAnimationFrame(animationFrame);
    });

    return {
        scrollTop,
        onStartDrag
    };
}
