import styles from './FractalBackdrop.module.css'

// A geometria fica fixa; somente as camadas completas se movem.
function fractalTriangles(x: number, y: number, size: number, depth: number): string {
  const height = size * Math.sqrt(3) / 2
  const outline = `M${x},${y}L${x + size / 2},${y + height}L${x - size / 2},${y + height}Z`
  if (depth === 0) return outline
  return outline + fractalTriangles(x, y, size / 2, depth - 1)
    + fractalTriangles(x - size / 4, y + height / 2, size / 2, depth - 1)
    + fractalTriangles(x + size / 4, y + height / 2, size / 2, depth - 1)
}

const FRACTAL_PATH = fractalTriangles(400, 70, 720, 4)

export default function FractalBackdrop({ className = '' }: { className?: string }) {
  return <div className={`${styles.backdrop} ${className}`} aria-hidden="true">
    <svg className={styles.fractal} viewBox="0 0 800 800" fill="none" focusable="false" data-fractal-background>
      <g className={styles.outer}><path d={FRACTAL_PATH} /></g>
      <g className={styles.inner}><path d={FRACTAL_PATH} /></g>
    </svg>
  </div>
}
