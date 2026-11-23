'use client'

import Link from 'next/link'
import { ArrowLeft, ArrowRight, Camera, Download, Heart, MapPin, Move, Search, X, ZoomIn, ZoomOut } from 'lucide-react'
import { useEffect, useMemo, useRef, useState, type FormEvent, type KeyboardEvent as ReactKeyboardEvent, type PointerEvent as ReactPointerEvent } from 'react'
import type { CuratedGalleryArtwork } from '@/lib/booking-server'

const apiBaseUrl = (process.env.NEXT_PUBLIC_BACKEND_API_URL ?? 'http://localhost:4000').replace(/\/$/, '')
const savedArtworkKey = 'haat-gallery-saved-artworks'
const categories = ['All Artworks', 'Acrylic & Oil', 'Watercolor', 'Mixed Media', 'Sculpture', 'Folk & Heritage'] as const
const priceRanges = ['All Price Range', 'Under ₹20,000', '₹20,000 – ₹50,000', 'Above ₹50,000'] as const
const sortOptions = ['Newest', 'Price: Low to High', 'Price: High to Low'] as const
const pageSize = 9

type ViewingTab = 'detail' | 'room'
type PreviewFrameStyle = 'frameless-canvas' | 'thin-matte-black' | 'warm-oak-wood' | 'gallery-white'
type WallPoint = { x: number; y: number }
type WallQuad = [WallPoint, WallPoint, WallPoint, WallPoint]

const previewFrameStyles: { id: PreviewFrameStyle; label: string }[] = [
  { id: 'frameless-canvas', label: 'Frameless Canvas' },
  { id: 'thin-matte-black', label: 'Thin Matte Black' },
  { id: 'warm-oak-wood', label: 'Warm Oak Wood' },
  { id: 'gallery-white', label: 'Gallery White' },
]

function matchesCategory(medium: string, category: (typeof categories)[number]) {
  const value = medium.toLocaleLowerCase()
  if (category === 'All Artworks') return true
  if (category === 'Acrylic & Oil') return /acrylic|oil|impasto/.test(value)
  if (category === 'Watercolor') return /watercolou?r|botanical/.test(value)
  if (category === 'Mixed Media') return /mixed media|resin|collage/.test(value)
  if (category === 'Sculpture') return /sculpture|bronze|terracotta|ceramic/.test(value)
  return /folk|heritage|miniature|madhubani|tribal|gold leaf|mineral pigment/.test(value)
}

function matchesPriceRange(price: number, range: (typeof priceRanges)[number]) {
  if (range === 'Under ₹20,000') return price < 20000
  if (range === '₹20,000 – ₹50,000') return price >= 20000 && price <= 50000
  if (range === 'Above ₹50,000') return price > 50000
  return true
}

function formatPrice(price: number) {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(price)
}

function statusLabel(status: CuratedGalleryArtwork['status']) {
  if (status === 'COLLECTORS_PICK') return "Collector's Pick"
  return status === 'SOLD' ? 'Sold' : 'Available'
}

function artworkDimensions(dimensions: string) {
  const [widthText, heightText] = dimensions.match(/\d+(?:\.\d+)?/g) ?? []
  const width = Number(widthText) || 24
  const height = Number(heightText) || 36
  const scale = Math.min(9, 280 / height, 500 / width)
  return { width: Math.round(width * scale), height: Math.round(height * scale) }
}

function loadCanvasImage(source: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image()
    image.crossOrigin = 'anonymous'
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error('An artwork image could not be loaded for the preview snapshot.'))
    image.src = source
  })
}

function drawImageCover(
  context: CanvasRenderingContext2D,
  image: CanvasImageSource,
  sourceWidth: number,
  sourceHeight: number,
  width: number,
  height: number,
) {
  const scale = Math.max(width / sourceWidth, height / sourceHeight)
  const drawWidth = sourceWidth * scale
  const drawHeight = sourceHeight * scale
  context.drawImage(image, (width - drawWidth) / 2, (height - drawHeight) / 2, drawWidth, drawHeight)
}

function drawSnapshotFrame(
  context: CanvasRenderingContext2D,
  image: HTMLImageElement,
  width: number,
  height: number,
  style: PreviewFrameStyle,
) {
  const padding = style === 'gallery-white' ? 16 : style === 'frameless-canvas' ? 0 : 8
  const left = -width / 2
  const top = -height / 2
  context.save()
  context.shadowColor = 'rgba(27, 21, 17, .42)'
  context.shadowBlur = 6
  context.shadowOffsetX = 1
  context.shadowOffsetY = 2

  if (style === 'warm-oak-wood') {
    const wood = context.createLinearGradient(left, top, -left, height / 2)
    wood.addColorStop(0, '#65452f')
    wood.addColorStop(.22, '#bc9568')
    wood.addColorStop(.5, '#d6b58b')
    wood.addColorStop(.78, '#9a704a')
    wood.addColorStop(1, '#5b3e2a')
    context.fillStyle = wood
  } else if (style === 'thin-matte-black') {
    const metal = context.createLinearGradient(left, top, -left, height / 2)
    metal.addColorStop(0, '#141414')
    metal.addColorStop(.45, '#353431')
    metal.addColorStop(1, '#181817')
    context.fillStyle = metal
  } else {
    context.fillStyle = style === 'gallery-white' ? '#fffdf8' : '#cbbda9'
  }
  if (style !== 'frameless-canvas') context.fillRect(left, top, width, height)
  context.shadowColor = 'transparent'

  if (style === 'gallery-white') {
    context.strokeStyle = 'rgba(114, 100, 84, .35)'
    context.lineWidth = 1
    context.strokeRect(left + 8, top + 8, width - 16, height - 16)
    context.strokeStyle = 'rgba(255, 255, 255, .9)'
    context.strokeRect(left + 10, top + 10, width - 20, height - 20)
  } else if (style === 'warm-oak-wood' || style === 'thin-matte-black') {
    context.strokeStyle = style === 'warm-oak-wood' ? 'rgba(255, 226, 182, .65)' : 'rgba(220, 216, 207, .62)'
    context.lineWidth = 1
    context.strokeRect(left + 3, top + 3, width - 6, height - 6)
  }

  const imageWidth = width - padding * 2
  const imageHeight = height - padding * 2
  context.drawImage(image, -imageWidth / 2, -imageHeight / 2, imageWidth, imageHeight)
  const lighting = context.createLinearGradient(left, top, width / 3, height / 2)
  lighting.addColorStop(0, 'rgba(255, 250, 235, .2)')
  lighting.addColorStop(.35, 'rgba(255, 255, 255, .04)')
  lighting.addColorStop(1, 'rgba(42, 30, 20, .06)')
  context.fillStyle = lighting
  context.fillRect(-imageWidth / 2, -imageHeight / 2, imageWidth, imageHeight)
  context.restore()
}

function solveHomography(
  width: number,
  height: number,
  points: WallQuad,
) {
  const source: WallQuad = [
    { x: 0, y: 0 },
    { x: width, y: 0 },
    { x: width, y: height },
    { x: 0, y: height },
  ]
  const equations: number[][] = []
  const values: number[] = []
  for (let index = 0; index < 4; index += 1) {
    const { x, y } = source[index]
    const target = points[index]
    equations.push([x, y, 1, 0, 0, 0, -target.x * x, -target.x * y])
    values.push(target.x)
    equations.push([0, 0, 0, x, y, 1, -target.y * x, -target.y * y])
    values.push(target.y)
  }

  const rows = equations.map((row, index) => [...row, values[index]])
  for (let column = 0; column < 8; column += 1) {
    let pivot = column
    for (let row = column + 1; row < 8; row += 1) {
      if (Math.abs(rows[row][column]) > Math.abs(rows[pivot][column])) pivot = row
    }
    if (Math.abs(rows[pivot][column]) < 1e-8) return null
    ;[rows[column], rows[pivot]] = [rows[pivot], rows[column]]
    const divisor = rows[column][column]
    for (let item = column; item <= 8; item += 1) rows[column][item] /= divisor
    for (let row = 0; row < 8; row += 1) {
      if (row === column) continue
      const factor = rows[row][column]
      for (let item = column; item <= 8; item += 1) rows[row][item] -= factor * rows[column][item]
    }
  }
  return rows.map((row) => row[8])
}

function projectiveMatrix3d(width: number, height: number, points: WallQuad) {
  const matrix = solveHomography(width, height, points)
  if (!matrix) return 'matrix3d(1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1)'
  const [a, b, c, d, e, f, g, h] = matrix
  return `matrix3d(${a}, ${d}, 0, ${g}, ${b}, ${e}, 0, ${h}, 0, 0, 1, 0, ${c}, ${f}, 0, 1)`
}

function isConvexWallQuad(points: WallQuad) {
  const crosses = points.map((point, index) => {
    const next = points[(index + 1) % 4]
    const after = points[(index + 2) % 4]
    return (next.x - point.x) * (after.y - next.y) - (next.y - point.y) * (after.x - next.x)
  })
  return crosses.every((cross) => cross > 0.0001) || crosses.every((cross) => cross < -0.0001)
}

function resizeWallQuad(points: WallQuad, factor: number): WallQuad {
  const center = points.reduce((sum, point) => ({ x: sum.x + point.x / 4, y: sum.y + point.y / 4 }), { x: 0, y: 0 })
  const resized = points.map((point) => ({
    x: center.x + (point.x - center.x) * factor,
    y: center.y + (point.y - center.y) * factor,
  })) as WallQuad
  const minX = Math.min(...resized.map((point) => point.x))
  const maxX = Math.max(...resized.map((point) => point.x))
  const minY = Math.min(...resized.map((point) => point.y))
  const maxY = Math.max(...resized.map((point) => point.y))
  const shiftX = minX < 0 ? -minX : maxX > 100 ? 100 - maxX : 0
  const shiftY = minY < 0 ? -minY : maxY > 100 ? 100 - maxY : 0
  return resized.map((point) => ({ x: point.x + shiftX, y: point.y + shiftY })) as WallQuad
}

function mapProjectivePoint(matrix: number[], x: number, y: number): WallPoint {
  const denominator = matrix[6] * x + matrix[7] * y + 1
  return {
    x: (matrix[0] * x + matrix[1] * y + matrix[2]) / denominator,
    y: (matrix[3] * x + matrix[4] * y + matrix[5]) / denominator,
  }
}

function drawTexturedTriangle(
  context: CanvasRenderingContext2D,
  image: HTMLImageElement,
  source: [WallPoint, WallPoint, WallPoint],
  target: [WallPoint, WallPoint, WallPoint],
) {
  const [s0, s1, s2] = source
  const [t0, t1, t2] = target
  const determinant = (s1.x - s0.x) * (s2.y - s0.y) - (s2.x - s0.x) * (s1.y - s0.y)
  if (Math.abs(determinant) < 1e-6) return
  const a = ((t1.x - t0.x) * (s2.y - s0.y) - (t2.x - t0.x) * (s1.y - s0.y)) / determinant
  const c = ((s1.x - s0.x) * (t2.x - t0.x) - (s2.x - s0.x) * (t1.x - t0.x)) / determinant
  const e = t0.x - a * s0.x - c * s0.y
  const b = ((t1.y - t0.y) * (s2.y - s0.y) - (t2.y - t0.y) * (s1.y - s0.y)) / determinant
  const d = ((s1.x - s0.x) * (t2.y - t0.y) - (s2.x - s0.x) * (t1.y - t0.y)) / determinant
  const f = t0.y - b * s0.x - d * s0.y

  context.save()
  context.beginPath()
  context.moveTo(t0.x, t0.y)
  context.lineTo(t1.x, t1.y)
  context.lineTo(t2.x, t2.y)
  context.closePath()
  context.clip()
  context.transform(a, b, c, d, e, f)
  context.drawImage(image, 0, 0)
  context.restore()
}

function drawProjectiveImage(
  context: CanvasRenderingContext2D,
  image: HTMLImageElement,
  points: WallQuad,
) {
  const width = image.naturalWidth
  const height = image.naturalHeight
  const matrix = solveHomography(width, height, points)
  if (!matrix) throw new Error('The wall corners are too close together to capture this artwork.')
  const columns = 18
  const rows = 18
  const mapped = Array.from({ length: rows + 1 }, (_, row) =>
    Array.from({ length: columns + 1 }, (_, column) =>
      mapProjectivePoint(matrix, (column / columns) * width, (row / rows) * height)))

  for (let row = 0; row < rows; row += 1) {
    for (let column = 0; column < columns; column += 1) {
      const x0 = (column / columns) * width
      const x1 = ((column + 1) / columns) * width
      const y0 = (row / rows) * height
      const y1 = ((row + 1) / rows) * height
      const topLeft = mapped[row][column]
      const topRight = mapped[row][column + 1]
      const bottomRight = mapped[row + 1][column + 1]
      const bottomLeft = mapped[row + 1][column]
      drawTexturedTriangle(context, image, [{ x: x0, y: y0 }, { x: x1, y: y0 }, { x: x1, y: y1 }], [topLeft, topRight, bottomRight])
      drawTexturedTriangle(context, image, [{ x: x0, y: y0 }, { x: x1, y: y1 }, { x: x0, y: y1 }], [topLeft, bottomRight, bottomLeft])
    }
  }
}

function quadPath(context: CanvasRenderingContext2D, points: WallQuad) {
  context.beginPath()
  context.moveTo(points[0].x, points[0].y)
  for (let index = 1; index < points.length; index += 1) context.lineTo(points[index].x, points[index].y)
  context.closePath()
}

function insetWallQuad(points: WallQuad, amount: number): WallQuad {
  const center = points.reduce((sum, point) => ({ x: sum.x + point.x / 4, y: sum.y + point.y / 4 }), { x: 0, y: 0 })
  return points.map((point) => ({
    x: center.x + (point.x - center.x) * (1 - amount * 2),
    y: center.y + (point.y - center.y) * (1 - amount * 2),
  })) as WallQuad
}

function drawWallArtworkSnapshot(
  context: CanvasRenderingContext2D,
  image: HTMLImageElement,
  points: WallQuad,
  style: PreviewFrameStyle,
  brightness: number,
  pixelRatio: number,
) {
  const offset = 3
  const side: WallQuad = points.map((point) => ({ x: point.x + offset, y: point.y + offset })) as WallQuad
  context.save()
  context.shadowColor = 'rgba(0, 0, 0, .55)'
  context.shadowBlur = 6 * pixelRatio
  context.shadowOffsetY = 2 * pixelRatio
  context.fillStyle = 'rgba(0, 0, 0, .01)'
  quadPath(context, points)
  context.fill()
  context.shadowColor = 'rgba(0, 0, 0, .28)'
  context.shadowBlur = 18 * pixelRatio
  context.shadowOffsetY = 8 * pixelRatio
  quadPath(context, points)
  context.fill()
  context.shadowColor = 'transparent'
  quadPath(context, side)
  context.fillStyle = 'rgba(0, 0, 0, .38)'
  context.fill()
  quadPath(context, points)
  context.fillStyle = style === 'gallery-white' ? '#fffdf8'
    : style === 'warm-oak-wood' ? '#a9794d'
      : style === 'thin-matte-black' ? '#1c1c1b'
        : '#cbbda9'
  context.fill()
  context.strokeStyle = style === 'frameless-canvas' ? 'rgba(255,255,255,.25)' : 'rgba(255,255,255,.42)'
  context.lineWidth = 1.5 * pixelRatio
  context.stroke()

  const inset = style === 'gallery-white' ? .075 : style === 'warm-oak-wood' ? .045 : style === 'thin-matte-black' ? .02 : .008
  const artQuad = insetWallQuad(points, inset)
  context.filter = `brightness(${brightness / 100})`
  drawProjectiveImage(context, image, artQuad)
  context.filter = 'none'
  context.restore()
}

function ViewingRoom({ artwork, startLiveCamera = false }: { artwork: CuratedGalleryArtwork; startLiveCamera?: boolean }) {
  const frame = artworkDimensions(artwork.dimensions)
  const aspect = frame.width / frame.height
  const videoRef = useRef<HTMLVideoElement>(null)
  const stageRef = useRef<HTMLDivElement>(null)
  const dragRef = useRef<{ pointerId: number; startX: number; startY: number; width: number; height: number; originX: number; originY: number } | null>(null)
  const livePointersRef = useRef(new Map<number, WallPoint>())
  const liveDragRef = useRef<{ pointerId: number; startX: number; startY: number; origin: WallQuad; cornerIndex: number | null } | null>(null)
  const pinchRef = useRef<{ startDistance: number; startScale: number } | null>(null)
  const initializedWallRef = useRef(false)
  const [cameraActive, setCameraActive] = useState(startLiveCamera)
  const [cameraAttempt, setCameraAttempt] = useState(0)
  const [cameraState, setCameraState] = useState<'idle' | 'starting' | 'ready' | 'error'>(startLiveCamera ? 'starting' : 'idle')
  const [cameraError, setCameraError] = useState('')
  const [position, setPosition] = useState({ x: 53, y: 35 })
  const [size, setSize] = useState(1)
  const [wallAngle, setWallAngle] = useState(0)
  const [wallTilt, setWallTilt] = useState(0)
  const [liveScale, setLiveScale] = useState(1)
  const [ambientBrightness, setAmbientBrightness] = useState(100)
  const [pinning, setPinning] = useState(false)
  const [stageSize, setStageSize] = useState({ width: 0, height: 0 })
  const [wallCorners, setWallCorners] = useState<WallQuad>([
    { x: 35, y: 28 }, { x: 65, y: 28 }, { x: 65, y: 72 }, { x: 35, y: 72 },
  ])
  const [frameStyle, setFrameStyle] = useState<PreviewFrameStyle>('gallery-white')
  const [snapshotState, setSnapshotState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const [snapshotMessage, setSnapshotMessage] = useState('')

  useEffect(() => {
    if (!cameraActive) {
      setCameraState('idle')
      return
    }

    let cancelled = false
    let stream: MediaStream | null = null
    setCameraState('starting')
    setCameraError('')

    if (!navigator.mediaDevices || typeof navigator.mediaDevices.getUserMedia !== 'function') {
      setCameraError('Camera preview requires a secure connection (HTTPS) and a browser with camera support.')
      setCameraState('error')
      return () => { cancelled = true }
    }

    navigator.mediaDevices.getUserMedia({
      video: {
        facingMode: { ideal: 'environment' },
        width: { ideal: 1920 },
        height: { ideal: 1080 },
      },
      audio: false,
    })
      .then((cameraStream) => {
        if (cancelled) {
          cameraStream.getTracks().forEach((track) => track.stop())
          return
        }
        stream = cameraStream
        const video = videoRef.current
        if (!video) {
          cameraStream.getTracks().forEach((track) => track.stop())
          setCameraError('The camera preview could not be opened. Please try again.')
          setCameraState('error')
          return
        }
        video.srcObject = cameraStream
        void video.play().then(() => {
          if (!cancelled) setCameraState('ready')
        }).catch(() => {
          if (!cancelled) {
            setCameraError('The camera started, but the live preview could not play. Please try again.')
            setCameraState('error')
          }
        })
      })
      .catch((error: unknown) => {
        if (cancelled) return
        const name = error instanceof DOMException ? error.name : ''
        setCameraError(
          name === 'NotAllowedError' || name === 'PermissionDeniedError'
            ? 'Camera permission was denied. Allow camera access in your browser settings, then try again.'
            : name === 'NotFoundError'
              ? 'No camera was found on this device.'
              : name === 'NotReadableError'
                ? 'The camera is already in use by another app. Close it and try again.'
                : 'We could not start the camera. Check browser permission and try again.',
        )
        setCameraState('error')
      })

    return () => {
      cancelled = true
      stream?.getTracks().forEach((track) => track.stop())
      if (videoRef.current) videoRef.current.srcObject = null
    }
  }, [cameraActive, cameraAttempt])

  useEffect(() => {
    if (!cameraActive || !stageRef.current) return
    const stage = stageRef.current
    const measure = () => setStageSize({ width: stage.clientWidth, height: stage.clientHeight })
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(stage)
    return () => observer.disconnect()
  }, [cameraActive, cameraState])

  useEffect(() => {
    if (initializedWallRef.current || !stageSize.width || !stageSize.height) return
    const width = Math.min(stageSize.width * .38, stageSize.height * .48 * aspect, 520)
    const height = width / aspect
    const halfWidth = width / stageSize.width * 50
    const halfHeight = height / stageSize.height * 50
    setWallCorners([
      { x: 50 - halfWidth, y: 50 - halfHeight },
      { x: 50 + halfWidth, y: 50 - halfHeight },
      { x: 50 + halfWidth, y: 50 + halfHeight },
      { x: 50 - halfWidth, y: 50 + halfHeight },
    ])
    initializedWallRef.current = true
  }, [aspect, stageSize])

  function onArtworkPointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    if (event.button !== 0 || !stageRef.current) return
    const bounds = stageRef.current.getBoundingClientRect()
    dragRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      width: bounds.width,
      height: bounds.height,
      originX: position.x,
      originY: position.y,
    }
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  function onArtworkPointerMove(event: ReactPointerEvent<HTMLDivElement>) {
    const drag = dragRef.current
    if (!drag || drag.pointerId !== event.pointerId) return
    setPosition({
      x: Math.max(8, Math.min(92, drag.originX + ((event.clientX - drag.startX) / drag.width) * 100)),
      y: Math.max(10, Math.min(88, drag.originY + ((event.clientY - drag.startY) / drag.height) * 100)),
    })
  }

  function onArtworkKeyDown(event: ReactKeyboardEvent<HTMLDivElement>) {
    const offsets: Record<string, { x: number; y: number }> = {
      ArrowLeft: { x: -2, y: 0 },
      ArrowRight: { x: 2, y: 0 },
      ArrowUp: { x: 0, y: -2 },
      ArrowDown: { x: 0, y: 2 },
    }
    const offset = offsets[event.key]
    if (!offset) return
    event.preventDefault()
    setPosition((current) => ({
      x: Math.max(8, Math.min(92, current.x + offset.x)),
      y: Math.max(10, Math.min(88, current.y + offset.y)),
    }))
  }

  function applyLiveScale(nextScale: number) {
    const clamped = Math.max(.3, Math.min(1.5, nextScale))
    if (liveScale > 0) setWallCorners((current) => resizeWallQuad(current, clamped / liveScale))
    setLiveScale(clamped)
  }

  function onLivePointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    if (!stageRef.current || (event.pointerType === 'mouse' && event.button !== 0)) return
    const target = event.target
    if (!(target instanceof Element) || target.closest('.gc-ar-bottom-bar, .gc-ar-topline, .gc-ar-error')) return
    const cornerHandle = target.closest<HTMLElement>('[data-pin-corner]')
    const artworkTarget = target.closest('.gc-ar-artwork')
    livePointersRef.current.set(event.pointerId, { x: event.clientX, y: event.clientY })
    event.currentTarget.setPointerCapture(event.pointerId)

    if (livePointersRef.current.size >= 2) {
      const [first, second] = [...livePointersRef.current.values()]
      pinchRef.current = {
        startDistance: Math.hypot(first.x - second.x, first.y - second.y),
        startScale: liveScale,
      }
      liveDragRef.current = null
      return
    }

    const cornerIndex = pinning && cornerHandle ? Number(cornerHandle.dataset.pinCorner) : null
    if (cornerIndex !== null || artworkTarget) {
      liveDragRef.current = {
        pointerId: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
        origin: wallCorners,
        cornerIndex,
      }
      event.preventDefault()
    }
  }

  function onLivePointerMove(event: ReactPointerEvent<HTMLDivElement>) {
    if (!stageRef.current) return
    if (livePointersRef.current.has(event.pointerId)) {
      livePointersRef.current.set(event.pointerId, { x: event.clientX, y: event.clientY })
    }
    const activePointers = [...livePointersRef.current.values()]
    if (activePointers.length >= 2 && pinchRef.current) {
      const [first, second] = activePointers
      const distance = Math.hypot(first.x - second.x, first.y - second.y)
      if (pinchRef.current.startDistance > 0) {
        applyLiveScale(pinchRef.current.startScale * distance / pinchRef.current.startDistance)
      }
      return
    }

    const drag = liveDragRef.current
    if (!drag || drag.pointerId !== event.pointerId) return
    const bounds = stageRef.current.getBoundingClientRect()
    const dx = (event.clientX - drag.startX) / bounds.width * 100
    const dy = (event.clientY - drag.startY) / bounds.height * 100
    if (drag.cornerIndex !== null) {
      const next = drag.origin.map((point, index) => index === drag.cornerIndex
        ? { x: Math.max(0, Math.min(100, point.x + dx)), y: Math.max(0, Math.min(100, point.y + dy)) }
        : point) as WallQuad
      if (isConvexWallQuad(next)) setWallCorners(next)
      return
    }
    const minX = Math.min(...drag.origin.map((point) => point.x))
    const maxX = Math.max(...drag.origin.map((point) => point.x))
    const minY = Math.min(...drag.origin.map((point) => point.y))
    const maxY = Math.max(...drag.origin.map((point) => point.y))
    const shiftX = Math.max(-minX, Math.min(100 - maxX, dx))
    const shiftY = Math.max(-minY, Math.min(100 - maxY, dy))
    setWallCorners(drag.origin.map((point) => ({ x: point.x + shiftX, y: point.y + shiftY })) as WallQuad)
  }

  function onLivePointerEnd(event: ReactPointerEvent<HTMLDivElement>) {
    livePointersRef.current.delete(event.pointerId)
    if (livePointersRef.current.size < 2) pinchRef.current = null
    if (liveDragRef.current?.pointerId === event.pointerId) liveDragRef.current = null
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId)
  }

  function onLiveArtworkKeyDown(event: ReactKeyboardEvent<HTMLDivElement>) {
    const offsets: Record<string, WallPoint> = {
      ArrowLeft: { x: -.5, y: 0 },
      ArrowRight: { x: .5, y: 0 },
      ArrowUp: { x: 0, y: -.5 },
      ArrowDown: { x: 0, y: .5 },
    }
    const offset = offsets[event.key]
    if (!offset) return
    event.preventDefault()
    const next = wallCorners.map((point) => ({
      x: Math.max(0, Math.min(100, point.x + offset.x)),
      y: Math.max(0, Math.min(100, point.y + offset.y)),
    })) as WallQuad
    if (isConvexWallQuad(next)) setWallCorners(next)
  }

  function startCamera() {
    setCameraError('')
    setCameraState('starting')
    setCameraActive(true)
  }

  async function saveSnapshot() {
    const stage = stageRef.current
    if (!stage || (cameraActive && cameraState !== 'ready')) return
    setSnapshotState('saving')
    setSnapshotMessage('')
    try {
      const bounds = stage.getBoundingClientRect()
      const scaleFactor = Math.min(2, window.devicePixelRatio || 1)
      const canvas = document.createElement('canvas')
      canvas.width = Math.round(bounds.width * scaleFactor)
      canvas.height = Math.round(bounds.height * scaleFactor)
      const context = canvas.getContext('2d')
      if (!context) throw new Error('Your browser could not create the wall photo.')
      context.scale(scaleFactor, scaleFactor)

      if (cameraActive) {
        const video = videoRef.current
        if (!video || video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) {
          throw new Error('The live camera preview is not ready yet. Please wait a moment and try again.')
        }
        drawImageCover(context, video, video.videoWidth, video.videoHeight, bounds.width, bounds.height)
        const artworkImage = await loadCanvasImage(artwork.imageUrl)
        const points = wallCorners.map((point) => ({
          x: bounds.width * point.x / 100,
          y: bounds.height * point.y / 100,
        })) as WallQuad
        drawWallArtworkSnapshot(context, artworkImage, points, frameStyle, ambientBrightness, scaleFactor)
      } else {
        const roomImage = await loadCanvasImage('/media/gallery-room-preview.jpg')
        drawImageCover(context, roomImage, roomImage.naturalWidth, roomImage.naturalHeight, bounds.width, bounds.height)
        const light = context.createLinearGradient(0, 0, 0, bounds.height * .65)
        light.addColorStop(0, 'rgba(255, 246, 224, .18)')
        light.addColorStop(1, 'rgba(255, 255, 255, 0)')
        context.fillStyle = light
        context.fillRect(0, 0, bounds.width, bounds.height)

        const artworkImage = await loadCanvasImage(artwork.imageUrl)
        const frameWidth = frame.width * size
        const frameHeight = frame.height * size
        const centerX = bounds.width * position.x / 100
        const centerY = bounds.height * position.y / 100
        context.save()
        context.translate(centerX, centerY)
        context.transform(
          1,
          Math.tan(wallTilt * Math.PI / 180) * .14,
          Math.tan(wallAngle * Math.PI / 180) * .28,
          1,
          0,
          0,
        )
        drawSnapshotFrame(context, artworkImage, frameWidth, frameHeight, frameStyle)
        context.restore()
      }

      const blob = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob((result) => result ? resolve(result) : reject(new Error('The wall photo could not be exported.')), 'image/png')
      })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `${artwork.title.toLocaleLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'artwork'}-${cameraActive ? 'wall-photo' : 'room-preview'}.png`
      document.body.appendChild(link)
      link.click()
      link.remove()
      window.setTimeout(() => URL.revokeObjectURL(url), 1000)
      setSnapshotState('saved')
      setSnapshotMessage(cameraActive ? 'Wall photo saved to your downloads.' : 'Room preview saved to your downloads.')
    } catch (error) {
      setSnapshotState('error')
      setSnapshotMessage(error instanceof Error ? error.message : 'The wall photo could not be saved. Please try again.')
    }
  }

  const previewFrameStyle = `gc-preview-artwork gc-frame--${frameStyle}`
  const previewArtworkTransform = `translate(-50%, -50%) perspective(1000px) rotateY(${wallAngle}deg) rotateX(${wallTilt}deg) scale(${size})`
  const liveFrameWidth = stageSize.width
    ? Math.min(stageSize.width * .38, stageSize.height * .48 * aspect, 520)
    : 0
  const liveFrameHeight = liveFrameWidth / aspect
  const projectivePoints = wallCorners.map((point) => ({
    x: stageSize.width * point.x / 100,
    y: stageSize.height * point.y / 100,
  })) as WallQuad
  const liveArtworkTransform = liveFrameWidth && stageSize.height
    ? projectiveMatrix3d(liveFrameWidth * liveScale, liveFrameHeight * liveScale, projectivePoints)
    : 'translate(-50%, -50%)'

  return (
    <div className={`gc-room-tab${cameraActive ? ' is-live-wall' : ''}`} role="tabpanel" aria-label={cameraActive ? 'Live Wall AR camera preview' : 'View artwork in a room'}>
      {!cameraActive && <div className="gc-preview-toolbar">
        <div className="gc-preview-modes" role="group" aria-label="Preview mode">
          <span className="is-active">Room Preview</span>
          <button type="button" onClick={startCamera}>Live Wall AR <Camera size={14} aria-hidden="true" /></button>
        </div>
        <div className="gc-frame-choices" role="group" aria-label="Choose a frame style">
          {previewFrameStyles.map((option) => (
            <button key={option.id} type="button" className={frameStyle === option.id ? 'is-active' : ''} aria-pressed={frameStyle === option.id} onClick={() => setFrameStyle(option.id)}>{option.label}</button>
          ))}
        </div>
        <button type="button" className="gc-save-preview" onClick={saveSnapshot} disabled={snapshotState === 'saving'}>
          <Download size={15} aria-hidden="true" /> {snapshotState === 'saving' ? 'Saving…' : snapshotState === 'saved' ? 'Preview Saved' : 'Save Room Preview 📸'}
        </button>
      </div>}

      {cameraActive ? (
        <div className="gc-ar-preview">
          <div
            className="gc-ar-stage is-live-wall"
            ref={stageRef}
            onPointerDown={onLivePointerDown}
            onPointerMove={onLivePointerMove}
            onPointerUp={onLivePointerEnd}
            onPointerCancel={onLivePointerEnd}
            onLostPointerCapture={onLivePointerEnd}
          >
            {cameraState !== 'error' && <video ref={videoRef} className={`gc-ar-video${cameraState === 'ready' ? ' is-ready' : ''}`} autoPlay muted playsInline aria-label="Live view from your rear camera" />}
            {cameraState === 'starting' && <p className="gc-ar-status" role="status">Opening your camera…</p>}
            {cameraState === 'error' && <div className="gc-ar-error" role="alert"><Camera size={24} aria-hidden="true" /><p>{cameraError}</p><button type="button" onClick={() => { setCameraError(''); setCameraState('starting'); setCameraAttempt((attempt) => attempt + 1) }}>Try camera again</button></div>}
            {cameraState === 'ready' && liveFrameWidth > 0 && (
              <div
                className={`${previewFrameStyle} gc-ar-artwork`}
                role="group"
                aria-label={`Draggable perspective preview of ${artwork.title}; use arrow keys to reposition`}
                tabIndex={0}
                onKeyDown={onLiveArtworkKeyDown}
                style={{
                  width: `${liveFrameWidth * liveScale}px`,
                  height: `${liveFrameHeight * liveScale}px`,
                  left: 0,
                  top: 0,
                  transform: liveArtworkTransform,
                  filter: `brightness(${ambientBrightness}%)`,
                }}
              >
                <img src={artwork.imageUrl} alt="" draggable={false} />
              </div>
            )}
            {cameraState === 'ready' && pinning && wallCorners.map((corner, index) => (
              <button
                key={index}
                type="button"
                className="gc-pin-handle"
                data-pin-corner={index}
                style={{ left: `${corner.x}%`, top: `${corner.y}%` }}
                aria-label={`Adjust artwork ${['top left', 'top right', 'bottom right', 'bottom left'][index]} corner`}
              />
            ))}
            <div className="gc-ar-topline"><span aria-live="polite"><i className={cameraState === 'ready' ? 'is-live' : ''} />{cameraState === 'ready' ? 'Live Wall AR · Camera stays on this device' : 'Live Wall AR'}</span></div>
            {cameraState === 'ready' && <div className="gc-ar-bottom-bar" onPointerDown={(event) => event.stopPropagation()}>
              <div className="gc-ar-frame-picker" role="group" aria-label="Frame style">
                <span>Frame Style</span>
                {previewFrameStyles.map((option) => <button key={option.id} type="button" className={frameStyle === option.id ? 'is-active' : ''} aria-pressed={frameStyle === option.id} onClick={() => setFrameStyle(option.id)}>{option.label}</button>)}
              </div>
              <label className="gc-live-range"><span>Scale <output>{Math.round(liveScale * 100)}%</output></span><input aria-label="Scale" type="range" min="0.3" max="1.5" step="0.01" value={liveScale} onChange={(event) => applyLiveScale(Number(event.target.value))} /></label>
              <label className="gc-live-range"><span>Ambient Brightness <output>{ambientBrightness}%</output></span><input aria-label="Ambient Brightness" type="range" min="70" max="120" step="1" value={ambientBrightness} onChange={(event) => setAmbientBrightness(Number(event.target.value))} /></label>
              <button type="button" className={`gc-pin-toggle${pinning ? ' is-active' : ''}`} aria-pressed={pinning} onClick={() => setPinning((value) => !value)}>Pin to Wall Corners</button>
              <button type="button" className="gc-live-capture" onClick={saveSnapshot} disabled={snapshotState === 'saving'}><Camera size={15} aria-hidden="true" />{snapshotState === 'saving' ? 'Capturing…' : snapshotState === 'saved' ? 'Photo Captured' : 'Capture Wall Photo 📸'}</button>
            </div>}
          </div>
        </div>
      ) : (
        <div className="gc-room-preview" ref={stageRef}>
          <img className="gc-room-background" src="/media/gallery-room-preview.jpg" alt="Sunlit contemporary living room with a gallery wall" />
          <div className="gc-room-daylight" aria-hidden="true" />
          <div
            className={`${previewFrameStyle} gc-room-frame`}
            role="group"
            aria-label={`Draggable preview of ${artwork.title}; use arrow keys to reposition`}
            tabIndex={0}
            onPointerDown={onArtworkPointerDown}
            onPointerMove={onArtworkPointerMove}
            onPointerUp={() => { dragRef.current = null }}
            onPointerCancel={() => { dragRef.current = null }}
            onKeyDown={onArtworkKeyDown}
            style={{ width: `${frame.width}px`, height: `${frame.height}px`, left: `${position.x}%`, top: `${position.y}%`, transform: previewArtworkTransform }}
          >
            <img src={artwork.imageUrl} alt="" draggable={false} />
            <span><Move size={13} aria-hidden="true" /> Drag to place</span>
          </div>
        </div>
      )}

      {!cameraActive && <div className="gc-preview-controls">
        <label><span>Painting size</span><input type="range" min="0.3" max="1.5" step="0.05" value={size} onChange={(event) => setSize(Number(event.target.value))} /><output>{Math.round(size * 100)}%</output></label>
        <label><span>Wall angle / perspective</span><input type="range" min="-25" max="25" step="1" value={wallAngle} onChange={(event) => setWallAngle(Number(event.target.value))} /><output>{wallAngle}°</output></label>
        <label><span>Vertical tilt</span><input type="range" min="-12" max="12" step="1" value={wallTilt} onChange={(event) => setWallTilt(Number(event.target.value))} /><output>{wallTilt}°</output></label>
      </div>}
      {snapshotMessage && <p className={`gc-snapshot-message${snapshotState === 'error' ? ' is-error' : ''}`} role={snapshotState === 'error' ? 'alert' : 'status'}>{snapshotMessage}</p>}

      {!cameraActive && <div className="gc-room-caption">
        <div><p className="gc-modal-kicker">Curated interior · Sunlit gallery wall</p><h3>Consider it in your space.</h3></div>
        <p>Artwork dimensions: {artwork.dimensions}. Drag to position, choose a frame, and adjust size and wall angle to preview the work in your space.</p>
      </div>}
    </div>
  )
}

export function GalleryGrid({ artworks }: { artworks: CuratedGalleryArtwork[] }) {
  const [category, setCategory] = useState<(typeof categories)[number]>('All Artworks')
  const [medium, setMedium] = useState('All Mediums')
  const [city, setCity] = useState('All Locations')
  const [priceRange, setPriceRange] = useState<(typeof priceRanges)[number]>('All Price Range')
  const [sort, setSort] = useState<(typeof sortOptions)[number]>('Newest')
  const [search, setSearch] = useState('')
  const [view, setView] = useState<'grid' | 'list'>('grid')
  const [page, setPage] = useState(1)
  const [savedIds, setSavedIds] = useState<string[]>([])
  const [storageReady, setStorageReady] = useState(false)
  const [storageMessage, setStorageMessage] = useState('')
  const [availableOnly, setAvailableOnly] = useState(false)
  const [shortlistOpen, setShortlistOpen] = useState(false)
  const [selectedArtwork, setSelectedArtwork] = useState<CuratedGalleryArtwork | null>(null)
  const [inquiryArtworks, setInquiryArtworks] = useState<CuratedGalleryArtwork[]>([])
  const [viewingTab, setViewingTab] = useState<ViewingTab>('room')
  const [launchLiveCamera, setLaunchLiveCamera] = useState(false)
  const [zoomed, setZoomed] = useState(false)
  const [inquiryOpen, setInquiryOpen] = useState(false)
  const [inquiryStatus, setInquiryStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle')
  const [inquiryError, setInquiryError] = useState('')
  const [inquiryRef, setInquiryRef] = useState('')
  const [message, setMessage] = useState('')

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(savedArtworkKey)
      const parsed: unknown = saved ? JSON.parse(saved) : []
      setSavedIds(Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === 'string') : [])
    } catch {
      setStorageMessage('Saved artworks are unavailable in this browser session.')
    } finally {
      setStorageReady(true)
    }
  }, [])

  useEffect(() => {
    if (!selectedArtwork && !shortlistOpen) return
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || inquiryStatus === 'sending') return
      if (selectedArtwork) setSelectedArtwork(null)
      else setShortlistOpen(false)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [selectedArtwork, shortlistOpen, inquiryStatus])

  const mediums = useMemo(() => [...new Set(artworks.map((work) => work.medium).filter(Boolean))].sort((a, b) => a.localeCompare(b)), [artworks])
  const cities = useMemo(() => [...new Set(artworks.map((work) => work.city).filter(Boolean))].sort((a, b) => a.localeCompare(b)), [artworks])
  const shown = useMemo(() => {
    const needle = search.trim().toLocaleLowerCase()
    const rows = artworks.filter((work) =>
      (!availableOnly || work.status !== 'SOLD') &&
      matchesCategory(work.medium, category) &&
      (medium === 'All Mediums' || work.medium === medium) &&
      (city === 'All Locations' || work.city === city) &&
      matchesPriceRange(work.price, priceRange) &&
      (!needle || [work.title, work.artistName, work.city, work.medium, work.description, statusLabel(work.status)]
        .some((value) => value.toLocaleLowerCase().includes(needle))))
    if (sort === 'Price: Low to High') rows.sort((a, b) => a.price - b.price)
    else if (sort === 'Price: High to Low') rows.sort((a, b) => b.price - a.price)
    else rows.sort((a, b) => b.year - a.year || a.title.localeCompare(b.title))
    return rows
  }, [artworks, category, medium, city, priceRange, search, sort, availableOnly])

  const savedWorks = useMemo(() => {
    const artworkById = new Map(artworks.map((work) => [work.id, work]))
    return savedIds.map((id) => artworkById.get(id)).filter((work): work is CuratedGalleryArtwork => Boolean(work))
  }, [artworks, savedIds])
  const filtersActive = category !== 'All Artworks'
    || medium !== 'All Mediums'
    || city !== 'All Locations'
    || priceRange !== 'All Price Range'
    || sort !== 'Newest'
    || Boolean(search.trim())
    || availableOnly

  const pages = Math.max(1, Math.ceil(shown.length / pageSize))
  const currentPage = Math.min(page, pages)
  const pageItems = shown.slice((currentPage - 1) * pageSize, currentPage * pageSize)

  function toggleSaved(id: string) {
    const next = savedIds.includes(id) ? savedIds.filter((savedId) => savedId !== id) : [...savedIds, id]
    setSavedIds(next)
    try {
      window.localStorage.setItem(savedArtworkKey, JSON.stringify(next))
      setStorageMessage('')
    } catch {
      setStorageMessage('This artwork is saved for this visit but could not be stored in this browser.')
    }
    setPage(1)
  }

  function resetFilters() {
    setCategory('All Artworks')
    setMedium('All Mediums')
    setCity('All Locations')
    setPriceRange('All Price Range')
    setSort('Newest')
    setSearch('')
    setAvailableOnly(false)
    setPage(1)
  }

  function openViewingRoom(
    artwork: CuratedGalleryArtwork,
    openInquiry = false,
    openLiveCamera = false,
    worksForInquiry: CuratedGalleryArtwork[] = [artwork],
  ) {
    setShortlistOpen(false)
    setSelectedArtwork(artwork)
    setInquiryArtworks(worksForInquiry)
    setViewingTab(openInquiry ? 'detail' : 'room')
    setLaunchLiveCamera(openLiveCamera)
    setZoomed(false)
    setInquiryOpen(openInquiry)
    setInquiryStatus('idle')
    setInquiryError('')
    setInquiryRef('')
    setMessage(worksForInquiry.length > 1
      ? 'I am interested in the shortlisted artworks below. Please share availability and next steps.'
      : `I am interested in “${artwork.title}” by ${artwork.artistName}. Please share availability and next steps.`)
  }

  async function submitInquiry(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!selectedArtwork || inquiryStatus === 'sending') return
    const data = new FormData(event.currentTarget)
    setInquiryStatus('sending')
    setInquiryError('')
    const works = inquiryArtworks.length ? inquiryArtworks : [selectedArtwork]
    const shortlist = works.length > 1
    try {
      const response = await fetch(`${apiBaseUrl}/api/enquiries`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: String(data.get('name') ?? '').trim(),
          email: String(data.get('email') ?? '').trim().toLowerCase(),
          phone: String(data.get('phone') ?? '').trim(),
          category: 'Artist',
          subject: shortlist
            ? `Gallery shortlist enquiry — ${works.length} artworks`
            : `Gallery artwork enquiry — ${selectedArtwork.title}`,
          message: `${message.trim()}\n\n${shortlist ? 'Shortlisted artworks' : 'Artwork'}:\n${works.map((work) => `${work.title} — ${work.artistName} (${work.city}; ${work.dimensions}; ${formatPrice(work.price)})`).join('\n')}`,
          consent: data.get('consent') === 'on',
        }),
      })
      const payload = await response.json().catch(() => null) as { refCode?: string; error?: string } | null
      if (!response.ok || !payload?.refCode) throw new Error(payload?.error || 'Your enquiry could not be recorded. Please try again.')
      setInquiryRef(payload.refCode)
      setInquiryStatus('sent')
    } catch (error) {
      setInquiryError(error instanceof Error ? error.message : 'We could not reach the server. Please try again.')
      setInquiryStatus('error')
    }
  }

  return (
    <section className="gc-collection" id="gallery-collection" aria-labelledby="gc-collection-title">
      <div className="gc-collection-heading">
        <div><p className="gc-eyebrow">The viewing room</p><h2 id="gc-collection-title">A collection to live with.</h2><p>Explore original works selected from artists across the 2026 roster.</p></div>
        <div className="gc-view-toggle" role="group" aria-label="Artwork layout">
          <button type="button" className={view === 'grid' ? 'is-active' : ''} aria-pressed={view === 'grid'} onClick={() => setView('grid')}>Grid View</button>
          <button type="button" className={view === 'list' ? 'is-active' : ''} aria-pressed={view === 'list'} onClick={() => setView('list')}>List View</button>
        </div>
      </div>

      <div className="gc-filter-panel">
        <div className="gc-category-row">
          <div className="gc-category-pills" role="group" aria-label="Curatorial categories">
            {categories.map((item) => <button key={item} type="button" className={category === item ? 'is-active' : ''} aria-pressed={category === item} onClick={() => { setCategory(item); setPage(1) }}>{item}</button>)}
          </div>
          <button
            type="button"
            className={`gc-saved-filter${shortlistOpen ? ' is-active' : ''}`}
            aria-expanded={shortlistOpen}
            aria-controls="gc-shortlist-drawer"
            disabled={!storageReady}
            onClick={() => setShortlistOpen(true)}
          >
            <Heart size={16} aria-hidden="true" /> Saved Artworks ({savedWorks.length}) ♡
          </button>
        </div>
        <div className="gc-selects">
          <label><span className="sr-only">Category</span><select aria-label="Category" value={category} onChange={(event) => { setCategory(event.target.value as (typeof categories)[number]); setPage(1) }}><option value="All Artworks">All Categories</option>{categories.slice(1).map((item) => <option key={item} value={item}>{item}</option>)}</select></label>
          <label><span className="sr-only">Medium</span><select aria-label="Medium" value={medium} onChange={(event) => { setMedium(event.target.value); setPage(1) }}><option>All Mediums</option>{mediums.map((item) => <option key={item}>{item}</option>)}</select></label>
          <label><span className="sr-only">Price range</span><select aria-label="Price range" value={priceRange} onChange={(event) => { setPriceRange(event.target.value as (typeof priceRanges)[number]); setPage(1) }}>{priceRanges.map((item) => <option key={item}>{item}</option>)}</select></label>
          <label><span className="sr-only">Location</span><select aria-label="Location" value={city} onChange={(event) => { setCity(event.target.value); setPage(1) }}><option>All Locations</option>{cities.map((item) => <option key={item}>{item}</option>)}</select></label>
          <label><span className="sr-only">Sort artworks</span><select aria-label="Sort by" value={sort} onChange={(event) => { setSort(event.target.value as (typeof sortOptions)[number]); setPage(1) }}>{sortOptions.map((item) => <option key={item}>{item}</option>)}</select></label>
          <label className="gc-search"><Search size={17} aria-hidden="true" /><span className="sr-only">Search artworks</span><input type="search" placeholder="Search artworks..." value={search} onChange={(event) => { setSearch(event.target.value); setPage(1) }} /></label>
        </div>
      </div>
      <div className="gc-results" aria-live="polite">
        <p>Showing <strong>{shown.length}</strong> of <strong>{artworks.length}</strong> Original Artworks</p>
        <div className="gc-results-actions">
          <button
            type="button"
            className={`gc-available-toggle${availableOnly ? ' is-active' : ''}`}
            role="switch"
            aria-checked={availableOnly}
            onClick={() => { setAvailableOnly((value) => !value); setPage(1) }}
          >
            <span className="gc-toggle-track" aria-hidden="true"><span /></span>
            <span>Available Works Only</span>
          </button>
          {filtersActive && <button type="button" className="gc-reset-filters" onClick={resetFilters}>Reset Filters</button>}
        </div>
      </div>
      {storageMessage && <p className="gc-storage-message" role="status">{storageMessage}</p>}

      {pageItems.length ? (
        <div className={view === 'grid' ? 'gc-grid' : 'gc-list'}>
          {pageItems.map((artwork) => {
            const isSaved = savedIds.includes(artwork.id)
            return (
              <article className="gc-card" key={artwork.id}>
                <div className="gc-art-frame">
                  <button type="button" className="gc-art-open" onClick={() => openViewingRoom(artwork)} aria-label={`Inspect ${artwork.title} in the viewing room`}>
                    <img src={artwork.imageUrl} alt={artwork.title} loading="lazy" />
                    <span className={`gc-status is-${artwork.status.toLowerCase().replace('_', '-')}`}>{statusLabel(artwork.status)}</span>
                  </button>
                  <button type="button" className="gc-heart" aria-label={isSaved ? `Remove ${artwork.title} from saved artworks` : `Save ${artwork.title}`} aria-pressed={isSaved} onClick={() => toggleSaved(artwork.id)}>
                    <Heart size={18} aria-hidden="true" fill={isSaved ? 'currentColor' : 'none'} />
                  </button>
                  <button type="button" className="gc-quick-view" onClick={() => openViewingRoom(artwork, false, true)}><Camera size={15} aria-hidden="true" /> View on Your Wall (Live Camera)</button>
                </div>
                <div className="gc-card-copy">
                  <p className="gc-card-kicker">{statusLabel(artwork.status)} <span aria-hidden="true">·</span> {artwork.year}</p>
                  <h3><button type="button" onClick={() => openViewingRoom(artwork)}>{artwork.title}</button></h3>
                  <p className="gc-artist-line"><Link href={`/artists/${artwork.artistSlug}`}>{artwork.artistName}</Link><span aria-hidden="true">·</span><span><MapPin size={13} aria-hidden="true" />{artwork.city}</span></p>
                  <p className="gc-medium-line">{artwork.medium} <span aria-hidden="true">·</span> {artwork.dimensions}</p>
                  <div className="gc-card-footer"><strong>{formatPrice(artwork.price)}</strong><button type="button" onClick={() => openViewingRoom(artwork, true)}>Inquire <span aria-hidden="true">→</span></button></div>
                </div>
              </article>
            )
          })}
        </div>
      ) : <p className="gc-empty">No artworks match this selection. Try another category, location or search.</p>}

      {pages > 1 && <nav className="gc-pagination" aria-label="Gallery pages">
        <button type="button" disabled={currentPage === 1} aria-label="Previous page" onClick={() => setPage(currentPage - 1)}><ArrowLeft size={16} aria-hidden="true" /></button>
        {Array.from({ length: pages }, (_, index) => index + 1).map((pageNumber) => <button key={pageNumber} type="button" className={pageNumber === currentPage ? 'is-active' : ''} aria-current={pageNumber === currentPage ? 'page' : undefined} onClick={() => setPage(pageNumber)}>{pageNumber}</button>)}
        <button type="button" disabled={currentPage === pages} aria-label="Next page" onClick={() => setPage(currentPage + 1)}><ArrowRight size={16} aria-hidden="true" /></button>
      </nav>}

      {shortlistOpen && (
        <div className="gc-shortlist-backdrop" role="presentation" onClick={(event) => { if (event.target === event.currentTarget) setShortlistOpen(false) }}>
          <aside className="gc-shortlist-drawer" id="gc-shortlist-drawer" role="dialog" aria-modal="true" aria-labelledby="gc-shortlist-title">
            <header className="gc-shortlist-header">
              <div><p className="gc-eyebrow">Your collection</p><h2 id="gc-shortlist-title">Collector Shortlist</h2><p>{savedWorks.length} {savedWorks.length === 1 ? 'artwork' : 'artworks'} saved</p></div>
              <button type="button" className="gc-shortlist-close" aria-label="Close shortlist" autoFocus onClick={() => setShortlistOpen(false)}><X size={20} /></button>
            </header>
            {savedWorks.length ? (
              <ul className="gc-shortlist-list">
                {savedWorks.map((work) => (
                  <li className="gc-shortlist-item" key={work.id}>
                    <img src={work.imageUrl} alt="" loading="lazy" />
                    <div className="gc-shortlist-copy">
                      <h3>{work.title}</h3>
                      <p>{work.artistName}</p>
                      <small>{work.dimensions} · {formatPrice(work.price)}</small>
                    </div>
                    <button type="button" aria-label={`Remove ${work.title} from shortlist`} onClick={() => toggleSaved(work.id)}><X size={16} /></button>
                  </li>
                ))}
              </ul>
            ) : <p className="gc-shortlist-empty">Your shortlist is empty. Save artworks with the heart button to keep them here.</p>}
            <footer className="gc-shortlist-footer">
              <button
                type="button"
                className="gc-primary-action"
                disabled={!savedWorks.length}
                onClick={() => {
                  const firstWork = savedWorks[0]
                  if (firstWork) openViewingRoom(firstWork, true, false, savedWorks)
                }}
              >
                Inquire About Shortlisted Works <ArrowRight size={16} aria-hidden="true" />
              </button>
              <p>Your selected titles and details will be included with your enquiry.</p>
            </footer>
          </aside>
        </div>
      )}

      {selectedArtwork && (
        <div className="gc-modal-backdrop" role="presentation" onClick={(event) => { if (event.target === event.currentTarget && inquiryStatus !== 'sending') setSelectedArtwork(null) }}>
          <section className="gc-viewing-room" role="dialog" aria-modal="true" aria-label={`Viewing room for ${selectedArtwork.title}`}>
            <button type="button" className="gc-modal-close" onClick={() => setSelectedArtwork(null)} aria-label="Close viewing room" disabled={inquiryStatus === 'sending'}><X size={20} /></button>
            <div className="gc-modal-heading">
              <p className="gc-modal-kicker">{launchLiveCamera ? 'The Haat of Art · Live Wall AR' : 'The Haat of Art · Viewing Room'}</p>
              <div className="gc-modal-tabs" role="tablist" aria-label="Artwork view">
                <button type="button" role="tab" aria-selected={viewingTab === 'detail'} className={viewingTab === 'detail' ? 'is-active' : ''} onClick={() => setViewingTab('detail')}>Artwork Detail</button>
                <button type="button" role="tab" aria-selected={viewingTab === 'room'} className={viewingTab === 'room' ? 'is-active' : ''} onClick={() => setViewingTab('room')}>{launchLiveCamera ? 'Live Wall AR' : 'Room Preview'}</button>
              </div>
            </div>
            {viewingTab === 'detail' ? (
              <div className="gc-modal-detail" role="tabpanel" aria-label="Artwork detail">
                <div className={`gc-modal-image${zoomed ? ' is-zoomed' : ''}`}>
                  <img src={selectedArtwork.imageUrl} alt={selectedArtwork.title} />
                  <button type="button" onClick={() => setZoomed((value) => !value)} aria-label={zoomed ? 'Zoom out' : 'Zoom artwork'}>{zoomed ? <ZoomOut size={18} /> : <ZoomIn size={18} />}</button>
                </div>
                <div className="gc-modal-copy">
                  <p className="gc-modal-kicker">{statusLabel(selectedArtwork.status)} <span aria-hidden="true">·</span> {selectedArtwork.year}</p>
                  <h2 id="gc-modal-title">{selectedArtwork.title}</h2>
                  <p className="gc-modal-artist"><Link href={`/artists/${selectedArtwork.artistSlug}`}>{selectedArtwork.artistName}</Link><span>·</span>{selectedArtwork.city}</p>
                  <dl className="gc-artwork-facts"><div><dt>Medium</dt><dd>{selectedArtwork.medium}</dd></div><div><dt>Dimensions</dt><dd>{selectedArtwork.dimensions}</dd></div><div><dt>Location</dt><dd>{selectedArtwork.city}, India</dd></div></dl>
                  <p className="gc-artwork-story">{selectedArtwork.description}</p>
                  <p className="gc-certificate"><span aria-hidden="true">✦</span> Accompanied by a certificate of authenticity from the artist.</p>
                  <div className="gc-modal-price"><span>Asking price</span><strong>{formatPrice(selectedArtwork.price)}</strong></div>
                  {!inquiryOpen && inquiryStatus !== 'sent' && <button type="button" className="gc-primary-action" onClick={() => { setInquiryOpen(true); setInquiryStatus('idle') }}>Inquire / Reserve Artwork <ArrowRight size={16} aria-hidden="true" /></button>}
                  {inquiryStatus === 'sent' ? (
                    <div className="gc-inquiry-success" role="status"><strong>Enquiry received.</strong><span>Reference {inquiryRef} · Our team will be in touch.</span><button type="button" onClick={() => setSelectedArtwork(null)}>Close viewing room</button></div>
                  ) : inquiryOpen && (
                    <form className="gc-inquiry-form" onSubmit={submitInquiry}>
                    <h3>{inquiryArtworks.length > 1 ? 'Inquire About Shortlisted Works' : 'Inquire / Reserve Artwork'}</h3>
                    {inquiryArtworks.length > 1 && (
                      <div className="gc-inquiry-shortlist">
                        <span>Shortlisted artworks</span>
                        <ul>{inquiryArtworks.map((work) => <li key={work.id}>{work.title} — {work.artistName}</li>)}</ul>
                      </div>
                    )}
                      <label>Name<input name="name" autoComplete="name" maxLength={160} required /></label>
                      <label>Email<input name="email" type="email" autoComplete="email" maxLength={255} required /></label>
                      <label>Message<textarea name="message" rows={3} minLength={10} maxLength={5000} value={message} onChange={(event) => setMessage(event.target.value)} required /></label>
                      <label className="gc-consent"><input name="consent" type="checkbox" required /><span>I agree that The Haat of Art may contact me about this artwork.</span></label>
                      <button type="submit" className="gc-primary-action" disabled={inquiryStatus === 'sending'}>{inquiryStatus === 'sending' ? 'Sending…' : 'Send enquiry'} <ArrowRight size={16} aria-hidden="true" /></button>
                      {inquiryStatus === 'error' && <p className="gc-form-error" role="alert">{inquiryError}</p>}
                    </form>
                  )}
                </div>
              </div>
            ) : <ViewingRoom artwork={selectedArtwork} startLiveCamera={launchLiveCamera} />}
          </section>
        </div>
      )}
    </section>
  )
}

export type FeaturedRosterArtist = {
  id: string
  slug: string
  displayName: string
  city: string
  medium: string
  portraitUrl: string | null
}

function FeaturedArtistPortrait({ artist }: { artist: FeaturedRosterArtist }) {
  const [failed, setFailed] = useState(false)
  const initials = artist.displayName.split(/\s+/).map((part) => part[0]).slice(0, 2).join('').toUpperCase()
  if (artist.portraitUrl && !failed) {
    return <img
      className="gc-feature-portrait-image"
      src={artist.portraitUrl}
      alt={`Portrait of ${artist.displayName}`}
      loading="lazy"
      onError={() => setFailed(true)}
    />
  }
  return (
    <div className="gc-feature-portrait-pending" role="img" aria-label={`Portrait of ${artist.displayName} not yet available`}>
      <span>{initials}</span><small>Portrait forthcoming</small>
    </div>
  )
}

export function FeaturedArtists({ artists }: { artists: FeaturedRosterArtist[] }) {
  if (!artists.length) return null
  return (
    <section className="gc-featured" aria-labelledby="gc-featured-title">
      <div className="gc-featured-heading"><div><p className="gc-eyebrow">Meet the makers</p><h2 id="gc-featured-title">Featured Artists</h2><p>Meet the artists and practices behind our exhibition editions.</p></div><Link href="/artists">View the full roster <ArrowRight size={15} aria-hidden="true" /></Link></div>
      <div className="gc-featured-grid">
        {artists.map((artist) => (
          <Link className="gc-feature-artist" href={`/artists/${artist.slug}`} key={artist.id}>
            <div className="gc-feature-portrait">
              <FeaturedArtistPortrait artist={artist} key={`${artist.id}-${artist.portraitUrl ?? ''}`} />
            </div>
            <div className="gc-feature-artist-copy"><h3>{artist.displayName}</h3><p>{artist.city} · {artist.medium}</p><b>Explore Studio <ArrowRight size={14} aria-hidden="true" /></b></div>
          </Link>
        ))}
      </div>
    </section>
  )
}
