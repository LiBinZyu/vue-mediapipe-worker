import { Landmark } from '../types';

// Hand connections based on MediaPipe documentation
const HAND_CONNECTIONS = [
  [0, 1], [1, 2], [2, 3], [3, 4], // Thumb
  [0, 5], [5, 6], [6, 7], [7, 8], // Index
  [5, 9], [9, 10], [10, 11], [11, 12], // Middle
  [9, 13], [13, 14], [14, 15], [15, 16], // Ring
  [13, 17], [0, 17], [17, 18], [18, 19], [19, 20] // Pinky
];

export const drawLandmarks = (ctx: CanvasRenderingContext2D, landmarks: Landmark[][]) => {
  ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
  
  ctx.lineWidth = 2;

  landmarks.forEach(hand => {
    // Draw connections
    ctx.strokeStyle = '#00FF00'; // Green for connections
    for (const [start, end] of HAND_CONNECTIONS) {
      const p1 = hand[start];
      const p2 = hand[end];
      
      ctx.beginPath();
      ctx.moveTo(p1.x * ctx.canvas.width, p1.y * ctx.canvas.height);
      ctx.lineTo(p2.x * ctx.canvas.width, p2.y * ctx.canvas.height);
      ctx.stroke();
    }

    // Draw points
    ctx.fillStyle = '#FF0000'; // Red for points
    for (const point of hand) {
      ctx.beginPath();
      ctx.arc(point.x * ctx.canvas.width, point.y * ctx.canvas.height, 4, 0, 2 * Math.PI);
      ctx.fill();
    }
  });
};