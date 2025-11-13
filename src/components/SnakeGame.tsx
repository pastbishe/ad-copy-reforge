import { useEffect, useRef, useState } from "react";
import { useTheme } from "@/contexts/ThemeContext";

interface Position {
  x: number;
  y: number;
}

export const SnakeGame = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { theme } = useTheme();
  const [isEnabled] = useState(() => {
    const saved = localStorage.getItem("snake_enabled");
    return saved === null ? true : saved === "true";
  });

  useEffect(() => {
    if (!isEnabled) return;
    
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const resizeCanvas = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };

    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    const gridSize = 20;
    const cols = Math.floor(canvas.width / gridSize);
    const rows = Math.floor(canvas.height / gridSize);
    
    let snake: Position[] = [
      { x: Math.floor(cols / 4), y: Math.floor(rows / 2) },
      { x: Math.floor(cols / 4) - 1, y: Math.floor(rows / 2) },
      { x: Math.floor(cols / 4) - 2, y: Math.floor(rows / 2) }
    ];
    let direction: Position = { x: 1, y: 0 };
    let fruits: Position[] = [
      { x: Math.floor(cols * 0.3), y: Math.floor(rows * 0.2) },
      { x: Math.floor(cols * 0.6), y: Math.floor(rows * 0.3) },
      { x: Math.floor(cols * 0.8), y: Math.floor(rows * 0.6) },
      { x: Math.floor(cols * 0.2), y: Math.floor(rows * 0.8) },
      { x: Math.floor(cols * 0.7), y: Math.floor(rows * 0.9) }
    ];
    
    const getSnakeColor = () => {
      if (theme === "dark") return "#10b981";
      if (theme === "light") return "#059669";
      return window.matchMedia("(prefers-color-scheme: dark)").matches ? "#10b981" : "#059669";
    };

    const getFruitColor = () => {
      if (theme === "dark") return "#ef4444";
      if (theme === "light") return "#dc2626";
      return window.matchMedia("(prefers-color-scheme: dark)").matches ? "#ef4444" : "#dc2626";
    };

    const getBgColor = () => {
      if (theme === "dark") return "#1f2937";
      if (theme === "light") return "#f3f4f6";
      return window.matchMedia("(prefers-color-scheme: dark)").matches ? "#1f2937" : "#f3f4f6";
    };

    const checkBodyCollision = (pos: Position) => {
      return snake.some(segment => segment.x === pos.x && segment.y === pos.y);
    };

    const updateDirection = () => {
      const head = snake[0];
      
      const possibleDirections = [
        { x: 1, y: 0 },
        { x: -1, y: 0 },
        { x: 0, y: 1 },
        { x: 0, y: -1 }
      ].filter(d => {
        if (d.x === -direction.x && d.y === -direction.y) return false;
        
        const testPos = { x: head.x + d.x, y: head.y + d.y };
        
        if (testPos.x < 0 || testPos.x >= cols || testPos.y < 0 || testPos.y >= rows) return false;
        if (checkBodyCollision(testPos)) return false;
        
        return true;
      });

      if (possibleDirections.length === 0) {
        snake = [
          { x: Math.floor(cols / 4), y: Math.floor(rows / 2) },
          { x: Math.floor(cols / 4) - 1, y: Math.floor(rows / 2) },
          { x: Math.floor(cols / 4) - 2, y: Math.floor(rows / 2) }
        ];
        direction = { x: 1, y: 0 };
        return;
      }

      const closestFruit = fruits.reduce((closest, fruit) => {
        const distToCurrent = Math.abs(head.x - fruit.x) + Math.abs(head.y - fruit.y);
        const distToClosest = Math.abs(head.x - closest.x) + Math.abs(head.y - closest.y);
        return distToCurrent < distToClosest ? fruit : closest;
      });

      const bestDirection = possibleDirections.reduce((best, d) => {
        const testPos = { x: head.x + d.x, y: head.y + d.y };
        const distWithD = Math.abs(testPos.x - closestFruit.x) + Math.abs(testPos.y - closestFruit.y);
        
        const bestTestPos = { x: head.x + best.x, y: head.y + best.y };
        const distWithBest = Math.abs(bestTestPos.x - closestFruit.x) + Math.abs(bestTestPos.y - closestFruit.y);
        
        return distWithD < distWithBest ? d : best;
      });

      direction = bestDirection;
    };

    const gameLoop = () => {
      ctx.fillStyle = getBgColor();
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      updateDirection();

      const head = { ...snake[0] };
      head.x += direction.x;
      head.y += direction.y;

      snake.unshift(head);

      const ateFruitIndex = fruits.findIndex(f => f.x === head.x && f.y === head.y);
      if (ateFruitIndex !== -1) {
        let newFruit: Position;
        let attempts = 0;
        do {
          newFruit = {
            x: Math.floor(Math.random() * cols),
            y: Math.floor(Math.random() * rows)
          };
          attempts++;
        } while (checkBodyCollision(newFruit) && attempts < 100);
        
        fruits[ateFruitIndex] = newFruit;
      } else {
        snake.pop();
      }

      const maxLength = 15;
      if (snake.length > maxLength) {
        snake.pop();
      }

      snake.forEach((segment, index) => {
        const alpha = 1 - (index / snake.length) * 0.3;
        ctx.globalAlpha = alpha;
        ctx.fillStyle = getSnakeColor();
        ctx.fillRect(
          segment.x * gridSize + 0.5, 
          segment.y * gridSize + 0.5, 
          gridSize - 1, 
          gridSize - 1
        );
      });

      ctx.globalAlpha = 0.6 + Math.sin(Date.now() / 200) * 0.4;
      ctx.fillStyle = getFruitColor();
      fruits.forEach(fruit => {
        ctx.fillRect(
          fruit.x * gridSize + 0.5, 
          fruit.y * gridSize + 0.5, 
          gridSize - 1, 
          gridSize - 1
        );
      });

      ctx.globalAlpha = 1;
    };

    const interval = setInterval(gameLoop, 150);

    return () => {
      clearInterval(interval);
      window.removeEventListener('resize', resizeCanvas);
    };
  }, [theme, isEnabled]);

  if (!isEnabled) return null;

  return (
    <div className="absolute inset-0 w-full h-full pointer-events-none">
      <canvas
        ref={canvasRef}
        width={window.innerWidth}
        height={window.innerHeight}
        className="w-full h-full opacity-40"
        style={{ imageRendering: "pixelated" }}
      />
    </div>
  );
};
