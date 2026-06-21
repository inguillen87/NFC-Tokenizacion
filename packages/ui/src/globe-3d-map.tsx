"use client";

import React, { useEffect, useRef, useState } from "react";

// Representación matricial de la Tierra (64x32)
// '#' representa tierra, ' ' representa agua
const WORLD_MAP_GRID = [
  "                                                                ",
  "                  ######                                        ",
  "                 ########                                       ",
  "   ###          #########         ###############      #####    ",
  "  #####       ############       ##################   #######   ",
  " #######     ##############      ###########################    ",
  "#######      ##############     ############################    ",
  "######        ############     #############################    ",
  " ####          ##########      #############################    ",
  "  ##            ########       #############################    ",
  "                 ######        ############################     ",
  "                #######        ###########################      ",
  "               #########        #########################       ",
  "              ##########         #######################        ",
  "             ###########          #####################         ",
  "             ###########           ##################           ",
  "             ##########             ################            ",
  "              #########              ##############             ",
  "              ########                ############              ",
  "               ######                  ##########               ",
  "               #####                    ########        ######  ",
  "                ###                      ######        ######## ",
  "                ##                        ####         ######## ",
  "                 #                         ##           ######  ",
  "                                                         ####   ",
  "                                                          ##    ",
  "                                                                ",
  "                                                                ",
  "      ####################################################      ",
  "      ####################################################      ",
  "                                                                ",
  "                                                                "
];
// Generador de puntos terrestres basados en la matriz
const generateLandPoints = (radius: number) => {
  const points: { x: number; y: number; z: number; isOcean?: boolean }[] = [];
  const rows = WORLD_MAP_GRID.length;
  const cols = WORLD_MAP_GRID[0].length;

  for (let r = 0; r < rows; r++) {
    const lat = 90 - (r / rows) * 180;
    const radLat = (lat * Math.PI) / 180;
    const cosLat = Math.cos(radLat);
    const sinLat = Math.sin(radLat);

    for (let c = 0; c < cols; c++) {
      if (WORLD_MAP_GRID[r][c] === "#") {
        const lng = (c / cols) * 360 - 180;
        const radLng = (lng * Math.PI) / 180;

        // Proyección esférica 3D
        points.push({
          x: radius * cosLat * Math.sin(radLng),
          y: radius * sinLat,
          z: radius * cosLat * Math.cos(radLng),
          isOcean: false
        });
      }
    }
  }

  // Agregar cuadrícula decorativa de paralelos y meridianos (puntos tenues en el océano)
  for (let lat = -70; lat <= 70; lat += 20) {
    const radLat = (lat * Math.PI) / 180;
    const cosLat = Math.cos(radLat);
    const sinLat = Math.sin(radLat);
    for (let lng = -180; lng < 180; lng += 15) {
      const radLng = (lng * Math.PI) / 180;
      points.push({
        x: (radius * 0.99) * cosLat * Math.sin(radLng),
        y: (radius * 0.99) * sinLat,
        z: (radius * 0.99) * cosLat * Math.cos(radLng),
        isOcean: true
      });
    }
  }

  return points;
};
export type GlobePoint = {
  city: string;
  country?: string;
  lat: number;
  lng: number;
  scans?: number;
  risk?: number;
  status?: string;
  vertical?: string;
};

export type GlobeRoute = {
  fromLat: number;
  fromLng: number;
  toLat: number;
  toLng: number;
  label?: string;
  tone?: "info" | "warn" | "success";
};

export function Globe3dMap({
  points = [],
  routes = [],
  width = 600,
  height = 500,
  className = ""
}: {
  points?: GlobePoint[];
  routes?: GlobeRoute[];
  width?: number;
  height?: number;
  className?: string;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rotationRef = useRef({ y: 0, x: 0.2 });
  const velocityRef = useRef({ y: 0.0035, x: 0 });
  const mouseRef = useRef({ isDown: false, startX: 0, startY: 0, rotY: 0, rotX: 0.2 });
  const lastMousePosRef = useRef({ x: 0, y: 0 });

  const radius = Math.min(width, height) * 0.38;
  const center = { x: width / 2, y: height / 2 };

  // Inicializar puntos terrestres una única vez
  const landPoints = React.useMemo(() => generateLandPoints(radius), [radius]);

  // Convertir puntos de ciudades a 3D
  const cityPoints3D = React.useMemo(() => {
    return points.map((p) => {
      const radLat = (p.lat * Math.PI) / 180;
      const radLng = (p.lng * Math.PI) / 180;
      return {
        ...p,
        x: radius * Math.cos(radLat) * Math.sin(radLng),
        y: radius * Math.sin(radLat),
        z: radius * Math.cos(radLat) * Math.cos(radLng)
      };
    });
  }, [points, radius]);

  // Rotación y Renderizado continuo
  useEffect(() => {
    let animId: number;

    const render = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      // Limpiar lienzo
      ctx.clearRect(0, 0, width, height);

      // Aplicar inercia física si el mouse no está apretado
      if (!mouseRef.current.isDown) {
        rotationRef.current.y += velocityRef.current.y;
        rotationRef.current.x = Math.max(
          -Math.PI / 3,
          Math.min(Math.PI / 3, rotationRef.current.x + velocityRef.current.x)
        );

        // Fricción / desaceleración
        velocityRef.current.y *= 0.95;
        velocityRef.current.x *= 0.95;

        // Velocidad mínima para seguir girando indefinidamente (auto-rotación base)
        const baseAutoRotSpeed = 0.0025;
        if (Math.abs(velocityRef.current.y) < baseAutoRotSpeed) {
          velocityRef.current.y = velocityRef.current.y * 0.95 + baseAutoRotSpeed * 0.05;
        }
        if (Math.abs(velocityRef.current.x) < 0.0001) {
          velocityRef.current.x = 0;
        }
      }

      const rotY = rotationRef.current.y;
      const rotX = rotationRef.current.x;

      const cosY = Math.cos(rotY);
      const sinY = Math.sin(rotY);
      const cosX = Math.cos(rotX);
      const sinX = Math.sin(rotX);

      // Matriz de rotación combinada (Y luego X)
      const projectPoint = (x: number, y: number, z: number) => {
        // Rotación sobre eje Y (Giro)
        const x1 = x * cosY - z * sinY;
        const z1 = x * sinY + z * cosY;

        // Rotación sobre eje X (Inclinación)
        const y2 = y * cosX - z1 * sinX;
        const z2 = y * sinX + z1 * cosX;

        return {
          sx: center.x + x1,
          sy: center.y - y2,
          sz: z2
        };
      };

      // 1. Dibujar aura de la atmósfera terrestre
      const gradGlow = ctx.createRadialGradient(center.x, center.y, radius * 0.95, center.x, center.y, radius * 1.25);
      gradGlow.addColorStop(0, "rgba(34, 211, 238, 0.12)");
      gradGlow.addColorStop(0.5, "rgba(99, 102, 241, 0.04)");
      gradGlow.addColorStop(1, "rgba(2, 6, 23, 0)");
      ctx.fillStyle = gradGlow;
      ctx.beginPath();
      ctx.arc(center.x, center.y, radius * 1.3, 0, Math.PI * 2);
      ctx.fill();

      // Dibujar contorno exterior de la esfera
      ctx.strokeStyle = "rgba(34, 211, 238, 0.22)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(center.x, center.y, radius, 0, Math.PI * 2);
      ctx.stroke();

      // 2. Renderizar puntos del mapa base terrestre
      landPoints.forEach((pt) => {
        const { sx, sy, sz } = projectPoint(pt.x, pt.y, pt.z);

        // Ocultar si está en la parte trasera de la esfera (sz < 0)
        const isFront = sz >= 0;

        if (pt.isOcean) {
          // Puntos oceánicos muy tenues y elegantes (fina malla de meridianos/paralelos)
          const opacity = isFront ? 0.09 + (sz / radius) * 0.08 : 0.02;
          ctx.fillStyle = isFront ? `rgba(148, 163, 184, ${opacity})` : `rgba(71, 85, 105, ${opacity})`;
          ctx.beginPath();
          ctx.arc(sx, sy, 0.7, 0, Math.PI * 2);
          ctx.fill();
        } else {
          // Puntos terrestres en cian brillante (continentes bien definidos)
          const opacity = isFront ? 0.42 + (sz / radius) * 0.48 : 0.06;
          const size = isFront ? 1.5 : 0.8;
          ctx.fillStyle = isFront ? `rgba(34, 211, 238, ${opacity})` : `rgba(71, 85, 105, ${opacity})`;
          ctx.beginPath();
          ctx.arc(sx, sy, size, 0, Math.PI * 2);
          ctx.fill();
        }
      });

      // 3. Renderizar rutas (Arco 3D curvo que se desplaza)
      routes.forEach((route) => {
        const from = cityPoints3D.find(
          (c) => Math.abs(c.lat - route.fromLat) < 0.1 && Math.abs(c.lng - route.fromLng) < 0.1
        );
        const to = cityPoints3D.find(
          (c) => Math.abs(c.lat - route.toLat) < 0.1 && Math.abs(c.lng - route.toLng) < 0.1
        );

        if (from && to) {
          // Generar arco interpolando puntos
          const steps = 30;
          ctx.beginPath();

          let previousPoint = null;
          let isRouteVisible = false;

          for (let i = 0; i <= steps; i++) {
            const t = i / steps;

            // Interpolación lineal 3D en la esfera
            const px = from.x + (to.x - from.x) * t;
            const py = from.y + (to.y - from.y) * t;
            const pz = from.z + (to.z - from.z) * t;

            // Normalizar y multiplicar por radio + altura del arco
            const len = Math.sqrt(px * px + py * py + pz * pz);
            const altitude = Math.sin(t * Math.PI) * (radius * 0.15); // Altura de arco en 3D
            const factor = (radius + altitude) / len;

            const arcX = px * factor;
            const arcY = py * factor;
            const arcZ = pz * factor;

            const { sx, sy, sz } = projectPoint(arcX, arcY, arcZ);

            if (sz >= -20) {
              isRouteVisible = true;
            }

            if (i === 0) {
              ctx.moveTo(sx, sy);
            } else {
              ctx.lineTo(sx, sy);
            }
          }

          if (isRouteVisible) {
            // Glow inferior sutil (arco continuo translúcido más grueso)
            ctx.strokeStyle = route.tone === "warn" ? "rgba(245, 158, 11, 0.12)" : "rgba(34, 211, 238, 0.12)";
            ctx.lineWidth = 4.0;
            ctx.stroke();

            // Línea principal discontinua
            ctx.strokeStyle = route.tone === "warn" ? "rgba(245, 158, 11, 0.48)" : "rgba(34, 211, 238, 0.48)";
            ctx.lineWidth = 1.3;
            ctx.setLineDash([3, 5]);
            ctx.stroke();
            ctx.setLineDash([]); // Reset
            
            // Animación de Estela de Cometa (partículas encadenadas con desvanecimiento)
            const speedFactor = (Date.now() / 1800) % 1.0;
            const baseColor = route.tone === "warn" ? "245, 158, 11" : "34, 211, 238";
            const tailSteps = 8;

            for (let tail = tailSteps - 1; tail >= 0; tail--) {
              const tTail = (speedFactor - tail * 0.012 + 1.0) % 1.0;
              const px = from.x + (to.x - from.x) * tTail;
              const py = from.y + (to.y - from.y) * tTail;
              const pz = from.z + (to.z - from.z) * tTail;
              const len = Math.sqrt(px * px + py * py + pz * pz);
              const altitude = Math.sin(tTail * Math.PI) * (radius * 0.15);
              const factor = (radius + altitude) / len;

              const pulseProj = projectPoint(px * factor, py * factor, pz * factor);
              
              if (pulseProj.sz >= -20) {
                const opacityFactor = 1 - tail / tailSteps;
                const opacity = opacityFactor * opacityFactor * 0.85;
                const size = opacityFactor * 3.2 + 0.6;

                ctx.fillStyle = `rgba(${baseColor}, ${opacity})`;
                ctx.beginPath();
                ctx.arc(pulseProj.sx, pulseProj.sy, size, 0, Math.PI * 2);
                ctx.fill();
              }
            }
          }
        }
      });

      // 4. Renderizar puntos de ciudades e hitos interactivos B2B
      cityPoints3D.forEach((city) => {
        const { sx, sy, sz } = projectPoint(city.x, city.y, city.z);

        // Mostrar solo en la cara visible anterior
        if (sz >= -10) {
          const sizeFactor = 2.2 + (sz / radius) * 2.2;
          const isRisk = (city.risk || 0) > 0;
          const pointColor = isRisk ? "251, 113, 133" : "34, 211, 238"; // Rojo vs Cian

          // Halo animado con ondas concéntricas (efecto radar premium)
          const time = (Date.now() / 1200) % 1.0;
          for (let k = 0; k < 3; k++) {
            const ringProgress = (time + k / 3) % 1.0;
            const ringRadius = sizeFactor * (1 + ringProgress * 3.2);
            const baseOpacity = 0.22 + (sz / radius) * 0.42;
            const ringOpacity = (1 - ringProgress) * baseOpacity;

            ctx.strokeStyle = `rgba(${pointColor}, ${ringOpacity})`;
            ctx.lineWidth = 1.2 - ringProgress * 0.7;
            ctx.beginPath();
            ctx.arc(sx, sy, ringRadius, 0, Math.PI * 2);
            ctx.stroke();
          }

          // Centro del punto terrestre
          ctx.fillStyle = isRisk ? "#fb7185" : "#22d3ee";
          ctx.beginPath();
          ctx.arc(sx, sy, sizeFactor, 0, Math.PI * 2);
          ctx.fill();

          // Nombre de la Ciudad y Métricas (Vidrio flotante)
          ctx.fillStyle = "#ffffff";
          ctx.font = "bold 9px sans-serif";
          ctx.shadowColor = "rgba(0,0,0,0.85)";
          ctx.shadowBlur = 4;
          ctx.fillText(city.city, sx + 8, sy - 2);

          // Detalles secundarios
          ctx.shadowBlur = 0; // Reset
          ctx.fillStyle = isRisk ? "#fca5a5" : "#94a3b8";
          ctx.font = "8px sans-serif";
          const subText = city.vertical ? `${city.vertical.toUpperCase()} • ${city.scans} scans` : `${city.scans} scans`;
          ctx.fillText(subText, sx + 8, sy + 8);
        }
      });

      animId = requestAnimationFrame(render);
    };

    animId = requestAnimationFrame(render);
    return () => cancelAnimationFrame(animId);
  }, [width, height, radius, center, landPoints, cityPoints3D, routes]);

  // Manejo de interacciones de arrastre táctil/mouse para girar el globo con inercia física
  const handleMouseDown = (e: React.MouseEvent) => {
    mouseRef.current = {
      isDown: true,
      startX: e.clientX,
      startY: e.clientY,
      rotY: rotationRef.current.y,
      rotX: rotationRef.current.x
    };
    lastMousePosRef.current = { x: e.clientX, y: e.clientY };
    velocityRef.current = { y: 0, x: 0 };
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!mouseRef.current.isDown) return;
    const deltaX = e.clientX - mouseRef.current.startX;
    const deltaY = e.clientY - mouseRef.current.startY;

    const newY = mouseRef.current.rotY + deltaX * 0.007;
    const newX = Math.max(-Math.PI / 3, Math.min(Math.PI / 3, mouseRef.current.rotX - deltaY * 0.007));

    // Calcular velocidad instantánea basada en el movimiento del puntero
    const instVelocityY = (e.clientX - lastMousePosRef.current.x) * 0.007;
    const instVelocityX = -(e.clientY - lastMousePosRef.current.y) * 0.007;

    rotationRef.current = { y: newY, x: newX };
    velocityRef.current = { y: instVelocityY, x: instVelocityX };

    lastMousePosRef.current = { x: e.clientX, y: e.clientY };
  };

  const handleMouseUp = () => {
    mouseRef.current.isDown = false;
  };

  return (
    <div 
      className={`relative select-none flex items-center justify-center overflow-hidden bg-black/10 rounded-2xl border border-white/5 shadow-2xl p-0 ${className}`}
      style={{ width, height }}
    >
      {/* Controles interactivos flotantes */}
      <div className="absolute top-4 left-4 z-20 text-[10px] text-slate-400 font-mono pointer-events-none bg-slate-950/80 px-2 py-1 rounded border border-white/5 backdrop-blur">
        🗺️ LIVE TELEMETRY GLOBE3D
      </div>

      <div className="absolute bottom-4 right-4 z-20 text-[9px] text-slate-500 font-mono pointer-events-none bg-slate-950/80 px-2 py-1 rounded border border-white/5 backdrop-blur">
        Drag to rotate
      </div>

      <canvas
        ref={canvasRef}
        width={width}
        height={height}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        className="cursor-grab active:cursor-grabbing max-w-full max-h-full"
      />
    </div>
  );
}
