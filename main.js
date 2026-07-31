// Dynamic Interactive Bubble Background for madoodia.com
document.addEventListener('DOMContentLoaded', () => {
    const interBubble = document.querySelector('.interactive-bubble');

    if (interBubble) {
        let curX = 0;
        let curY = 0;
        let tgX = 0;
        let tgY = 0;
        const easeFactor = 12; // Easing speed for mouse following

        // Center bubble target coordinates initially
        tgX = window.innerWidth / 2;
        tgY = window.innerHeight / 2;
        curX = tgX;
        curY = tgY;

        function move() {
            // Apply fluid interpolation towards client coordinates
            curX += (tgX - curX) / easeFactor;
            curY += (tgY - curY) / easeFactor;

            // Get sizes to center the bubble directly under the mouse pointer
            const rect = interBubble.getBoundingClientRect();
            const bubbleWidth = rect.width || window.innerHeight * 0.8;
            const bubbleHeight = rect.height || window.innerHeight * 0.8;

            // Position using translate3d for hardware acceleration and layout performance
            interBubble.style.transform = `translate3d(${curX - bubbleWidth / 2}px, ${curY - bubbleHeight / 2}px, 0)`;

            requestAnimationFrame(move);
        }

        window.addEventListener('mousemove', (e) => {
            tgX = e.clientX;
            tgY = e.clientY;
        });

        // Start animation loop
        move();
    }
});
