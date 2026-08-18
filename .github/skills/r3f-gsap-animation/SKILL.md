---
name: r3f-gsap-animation
description: "Use when creating, updating, or debugging React Three Fiber (R3F) 3D canvas scenes and GSAP ScrollTrigger animations in Next.js landing pages or components."
user-invocable: true
---

# R3F & GSAP Animation Component Checklist

A quick checklist and standards guide for building high-performance 3D scenes integrated with GSAP ScrollTrigger in Next.js.

## 1. Scene Setup & Layout
- [ ] Add `'use client'` directive at top of interactive 3D component files.
- [ ] Structure the layout with a fixed background Canvas and relative scroll overlay:
  - Fixed background container: `fixed inset-0 z-0 overflow-hidden pointer-events-none`
  - Scrollable content container: `relative z-10 w-full`
  - Overlay cards/elements: `pointer-events-none` on sections, `pointer-events-auto` on interactive cards.
- [ ] Reset scroll restoration on mount:
  ```ts
  useEffect(() => {
    window.history.scrollRestoration = 'manual'
    const t = setTimeout(() => window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior }), 0)
    return () => clearTimeout(t)
  }, [])
  ```

## 2. React Three Fiber & State Performance
- [ ] **Avoid React state in `useFrame`**: Use a mutable `useRef` object (`animStateRef`) for per-frame animated values (positions, rotations, scales, light intensity).
- [ ] Read `animStateRef.current` inside `useFrame` to update Three.js object transformations directly without triggering React re-renders.
- [ ] Enable DPR cap on `Canvas`: `dpr={[1, 1.5]}` to prevent GPU lag on high-DPI displays.
- [ ] Wrap 3D models and helpers in `<Suspense fallback={null}>`.

## 3. Dynamic Theme & Material Color Management
- [ ] Consume theme context (`useTheme`) for dynamic primary colors and light/dark mode states.
- [ ] **Avoid mutating/recreating materials directly**: Update material colors using `materials.paint.color.set(new THREE.Color(primary))` inside a `useEffect`.
- [ ] Use a ref guard (`lastPrimary.current === primary`) to prevent redundant updates when other state changes trigger component re-renders.

## 4. GSAP & ScrollTrigger Integration
- [ ] Register `ScrollTrigger` conditionally on client-side:
  ```ts
  if (typeof window !== 'undefined') {
    gsap.registerPlugin(ScrollTrigger)
  }
  ```
- [ ] Use the `@gsap/react` hook (`useGSAP`) with `scope: containerRef` for safe lifecycle management and automatic cleanup.
- [ ] Animate the ref state object (`animStateRef.current`) in GSAP timeline to drive 3D positions smoothly via `scrub: 1`.
- [ ] Call `ScrollTrigger.refresh()` after setting up complex timeline triggers or dynamic DOM mounts.

## 5. Quality Criteria & Verification
- [ ] No layout shift or horizontal scrollbars (`overflow-x-hidden` on parent container).
- [ ] Smooth 60fps scrolling performance without memory leaks.
- [ ] Text elements and buttons retain proper contrast and `pointer-events` responsiveness over 3D backgrounds.
- [ ] Canvas clean up on unmount without WebGL context loss errors.
