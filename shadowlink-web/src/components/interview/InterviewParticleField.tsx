import { useEffect, useRef } from 'react'

type Particle = {
  x: number
  y: number
  homeX: number
  homeY: number
  vx: number
  vy: number
  radius: number
  alpha: number
}

function makeParticles(width: number, height: number) {
  const count = Math.min(280, Math.max(150, Math.floor((width * height) / 6500)))
  return Array.from({ length: count }, (): Particle => {
    const x = Math.random() * width
    const y = Math.random() * height
    return {
      x,
      y,
      homeX: x,
      homeY: y,
      vx: (Math.random() - 0.5) * 0.28,
      vy: (Math.random() - 0.5) * 0.28,
      radius: Math.random() * 2.8 + 1.1,
      alpha: Math.random() * 0.55 + 0.35,
    }
  })
}

export function InterviewParticleField() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const particlesRef = useRef<Particle[]>([])
  const pointerRef = useRef({ x: -9999, y: -9999, active: false })
  const burstRef = useRef({ x: 0, y: 0, force: 0 })

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return undefined
    const context = canvas.getContext('2d')
    if (!context) return undefined

    let animationFrame = 0
    let width = 0
    let height = 0

    const resize = () => {
      const rect = canvas.getBoundingClientRect()
      const pixelRatio = Math.min(window.devicePixelRatio || 1, 2)
      width = rect.width
      height = rect.height
      canvas.width = Math.floor(width * pixelRatio)
      canvas.height = Math.floor(height * pixelRatio)
      context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0)
      particlesRef.current = makeParticles(width, height)
    }

    const setPointer = (event: PointerEvent) => {
      const rect = canvas.getBoundingClientRect()
      const x = event.clientX - rect.left
      const y = event.clientY - rect.top
      pointerRef.current = {
        x,
        y,
        active: x >= 0 && x <= rect.width && y >= 0 && y <= rect.height,
      }
    }

    const clearPointer = () => {
      pointerRef.current.active = false
    }

    const explode = (event: PointerEvent) => {
      setPointer(event)
      burstRef.current = { x: pointerRef.current.x, y: pointerRef.current.y, force: 24 }
    }

    const draw = () => {
      context.clearRect(0, 0, width, height)

      const background = context.createRadialGradient(width * 0.5, height * 0.45, 0, width * 0.5, height * 0.45, Math.max(width, height) * 0.7)
      background.addColorStop(0, 'rgba(99,102,241,0.18)')
      background.addColorStop(0.55, 'rgba(20,184,166,0.10)')
      background.addColorStop(1, 'rgba(8,10,18,0)')
      context.fillStyle = background
      context.fillRect(0, 0, width, height)

      const pointer = pointerRef.current
      const burst = burstRef.current
      const particles = particlesRef.current

      for (const particle of particles) {
        if (pointer.active) {
          const dx = particle.x - pointer.x
          const dy = particle.y - pointer.y
          const distance = Math.hypot(dx, dy)
          const radius = 190
          if (distance > 0 && distance < radius) {
            const push = (1 - distance / radius) * 2.45
            particle.vx += (dx / distance) * push
            particle.vy += (dy / distance) * push
          }
        }

        if (burst.force > 0.1) {
          const dx = particle.x - burst.x
          const dy = particle.y - burst.y
          const distance = Math.hypot(dx, dy)
          const radius = 270
          if (distance > 0 && distance < radius) {
            const push = (1 - distance / radius) * burst.force * 0.065
            particle.vx += (dx / distance) * push
            particle.vy += (dy / distance) * push
          }
        }

        particle.vx += (particle.homeX - particle.x) * 0.002
        particle.vy += (particle.homeY - particle.y) * 0.002
        particle.vx *= 0.9
        particle.vy *= 0.9
        particle.x += particle.vx
        particle.y += particle.vy
      }

      burst.force *= 0.86

      context.save()
      context.globalCompositeOperation = 'lighter'
      for (let i = 0; i < particles.length; i += 1) {
        const particle = particles[i]
        for (let j = i + 1; j < particles.length; j += 1) {
          const other = particles[j]
          const distance = Math.hypot(particle.x - other.x, particle.y - other.y)
          if (distance < 92) {
            context.strokeStyle = `rgba(94,234,212,${0.24 * (1 - distance / 92)})`
            context.lineWidth = 1.15
            context.beginPath()
            context.moveTo(particle.x, particle.y)
            context.lineTo(other.x, other.y)
            context.stroke()
          }
        }
      }

      for (const particle of particles) {
        context.beginPath()
        context.arc(particle.x, particle.y, particle.radius, 0, Math.PI * 2)
        context.fillStyle = `rgba(165,180,252,${particle.alpha})`
        context.fill()
      }

      if (burst.force > 0.1) {
        context.beginPath()
        context.arc(burst.x, burst.y, (24 - burst.force) * 14, 0, Math.PI * 2)
        context.strokeStyle = `rgba(94,234,212,${Math.min(0.72, burst.force / 32)})`
        context.lineWidth = 2
        context.stroke()
      }
      context.restore()

      animationFrame = requestAnimationFrame(draw)
    }

    resize()
    window.addEventListener('resize', resize)
    window.addEventListener('pointermove', setPointer)
    window.addEventListener('pointerleave', clearPointer)
    window.addEventListener('pointerdown', explode)
    animationFrame = requestAnimationFrame(draw)

    return () => {
      window.removeEventListener('resize', resize)
      window.removeEventListener('pointermove', setPointer)
      window.removeEventListener('pointerleave', clearPointer)
      window.removeEventListener('pointerdown', explode)
      cancelAnimationFrame(animationFrame)
    }
  }, [])

  return <canvas ref={canvasRef} aria-hidden="true" className="pointer-events-none absolute inset-0 h-full w-full" />
}
