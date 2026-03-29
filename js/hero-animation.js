(() => {
  const DESKTOP_NODE_COUNT = 34
  const MOBILE_NODE_COUNT = 20
  const MAX_DPR = 2
  const SIGNAL_INTERVAL_MIN = 4800
  const SIGNAL_INTERVAL_MAX = 7600

  let heroAnimationState = null

  function initHeroAnimation() {
    const container = document.querySelector(".hero-animation")

    if (!container) return null
    if (heroAnimationState) return heroAnimationState

    const canvas = document.createElement("canvas")
    canvas.className = "hero-canvas"
    container.appendChild(canvas)

    const context = canvas.getContext("2d")
    if (!context) return null

    const reducedMotionQuery = window.matchMedia("(prefers-reduced-motion: reduce)")

    heroAnimationState = {
      canvas,
      container,
      context,
      reducedMotionQuery,
      colors: readPalette(container),
      nodes: [],
      signals: [],
      signalPulses: [],
      bonds: [],
      adjacency: [],
      width: 0,
      height: 0,
      dpr: 1,
      bondDistance: 120,
      lastFrame: 0,
      nextSignalAt: 0,
      focusPulseCluster: -1,
      focusPulseProgress: 0,
      nextFocusPulseAt: 12000,
      rafId: 0
    }

    const state = heroAnimationState

    state.handleResize = () => {
      resizeCanvas(state)
    }

    state.handleMotionChange = (event) => {
      if (event.matches) {
        stopLoop(state)
        renderFrame(state, 0, true)
        return
      }

      state.lastFrame = performance.now()
      state.nextSignalAt = state.lastFrame + randomBetween(1800, 3200)
      state.nextFocusPulseAt = state.lastFrame + randomBetween(10000, 16000)
      if (!state.rafId) {
        state.rafId = requestAnimationFrame((timestamp) => tick(state, timestamp))
      }
    }

    if (typeof ResizeObserver === "function") {
      state.resizeObserver = new ResizeObserver(state.handleResize)
      state.resizeObserver.observe(container)
    }

    if (typeof reducedMotionQuery.addEventListener === "function") {
      reducedMotionQuery.addEventListener("change", state.handleMotionChange)
    } else if (typeof reducedMotionQuery.addListener === "function") {
      reducedMotionQuery.addListener(state.handleMotionChange)
    }

    window.addEventListener("resize", state.handleResize, { passive: true })

    resizeCanvas(state)

    if (reducedMotionQuery.matches) {
      renderFrame(state, 0, true)
      return state
    }

    state.lastFrame = performance.now()
    state.nextSignalAt = state.lastFrame + randomBetween(1800, 3200)
    state.nextFocusPulseAt = state.lastFrame + randomBetween(10000, 16000)
    state.rafId = requestAnimationFrame((timestamp) => tick(state, timestamp))

    return state
  }

  function tick(state, timestamp) {
    const delta = Math.min(timestamp - state.lastFrame, 32)
    state.lastFrame = timestamp

    renderFrame(state, timestamp, false, delta)
    state.rafId = requestAnimationFrame((nextTimestamp) => tick(state, nextTimestamp))
  }

  function renderFrame(state, timestamp, staticFrame, delta = 16.667) {
    const { context, width, height } = state

    if (!width || !height) return

    if (staticFrame) {
      positionNodes(state, timestamp)
      state.signals = []
      state.signalPulses.fill(0)
      state.focusPulseCluster = -1
      state.focusPulseProgress = 0
    } else {
      updateNodes(state, timestamp, delta)
      const network = buildNetwork(state.nodes, state.bondDistance)
      state.bonds = network.bonds
      state.adjacency = network.adjacency
      updateSignals(state, timestamp, delta)
    }

    if (staticFrame) {
      const network = buildNetwork(state.nodes, state.bondDistance)
      state.bonds = network.bonds
      state.adjacency = network.adjacency
    }

    if (!staticFrame) {
      if (timestamp >= state.nextFocusPulseAt && state.focusPulseCluster < 0) {
        const clusterCount = state.nodes.length > 24 ? 4 : 3
        state.focusPulseCluster = Math.floor(Math.random() * clusterCount)
        state.focusPulseProgress = 0
        state.nextFocusPulseAt = timestamp + randomBetween(10000, 16000)
      }

      if (state.focusPulseCluster >= 0) {
        state.focusPulseProgress += delta / 2500

        if (state.focusPulseProgress >= 1) {
          state.focusPulseCluster = -1
          state.focusPulseProgress = 0
        }
      }
    }

    context.clearRect(0, 0, width, height)

    const baseBreathe = 0.9 + Math.sin(timestamp * 0.0008) * 0.08
    const slowBreathe = 0.94 + Math.sin(timestamp * 0.00025) * 0.06
    const breath = staticFrame ? 0.96 : baseBreathe * slowBreathe

    drawBonds(state, breath)
    drawSignals(state)
    drawNodes(state, timestamp, breath, staticFrame)
  }

  function resizeCanvas(state) {
    const rect = state.container.getBoundingClientRect()
    if (!rect.width || !rect.height) return

    const previousWidth = state.width || rect.width
    const previousHeight = state.height || rect.height
    const desiredNodeCount = window.innerWidth < 768 ? MOBILE_NODE_COUNT : DESKTOP_NODE_COUNT

    state.width = rect.width
    state.height = rect.height
    state.dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR)
    state.bondDistance = Math.max(98, Math.min(138, state.width * 0.19))

    state.canvas.width = Math.round(rect.width * state.dpr)
    state.canvas.height = Math.round(rect.height * state.dpr)
    state.canvas.style.width = `${rect.width}px`
    state.canvas.style.height = `${rect.height}px`
    state.context.setTransform(state.dpr, 0, 0, state.dpr, 0, 0)

    if (!state.nodes.length || state.nodes.length !== desiredNodeCount) {
      state.nodes = createNodes(state.width, state.height)
      state.signalPulses = new Array(state.nodes.length).fill(0)
      state.signals = []
      positionNodes(state, 0)
    } else {
      scaleNodes(state, previousWidth, previousHeight)
      positionNodes(state, state.lastFrame || 0)
    }

    renderFrame(state, state.lastFrame || 0, true)
  }

  function scaleNodes(state, previousWidth, previousHeight) {
    const scaleX = state.width / previousWidth
    const scaleY = state.height / previousHeight

    state.nodes.forEach((node) => {
      node.x *= scaleX
      node.y *= scaleY
      node.anchorX *= scaleX
      node.anchorY *= scaleY
      node.clusterX *= scaleX
      node.clusterY *= scaleY
      node.orbitX *= scaleX
      node.orbitY *= scaleY
    })
  }

  function createNodes(width, height) {
    const nodeCount = window.innerWidth < 768 ? MOBILE_NODE_COUNT : DESKTOP_NODE_COUNT
    const clusterCount = nodeCount > 24 ? 4 : 3
    const clusterCenters = buildClusterCenters(width, height, clusterCount)
    const nodes = []

    for (let index = 0; index < nodeCount; index += 1) {
      const clusterIndex = index % clusterCount
      const center = clusterCenters[clusterIndex]
      const spreadX = width * 0.075
      const spreadY = height * 0.09
      const offsetX = gaussianOffset() * spreadX
      const offsetY = gaussianOffset() * spreadY
      const type = getNodeType(index, nodeCount)

      const anchorX = clamp(center.x + offsetX, width * 0.08, width * 0.92)
      const anchorY = clamp(center.y + offsetY, height * 0.12, height * 0.88)

      nodes.push({
        type,
        clusterIndex,
        clusterX: center.x,
        clusterY: center.y,
        anchorX,
        anchorY,
        anchorVx: randomBetween(-0.018, 0.018),
        anchorVy: randomBetween(-0.018, 0.018),
        orbitX: randomBetween(5, 18),
        orbitY: randomBetween(4, 14),
        orbitSpeed: randomBetween(0.00028, 0.0006),
        phase: randomBetween(0, Math.PI * 2),
        radius: getNodeRadius(type),
        x: anchorX,
        y: anchorY
      })
    }

    return nodes
  }

  function buildClusterCenters(width, height, clusterCount) {
    const centers = []

    for (let index = 0; index < clusterCount; index += 1) {
      const progress = clusterCount === 1 ? 0.5 : index / (clusterCount - 1)
      const x = width * (0.18 + progress * 0.64) + randomBetween(-18, 18)
      const y = height * (0.38 + Math.sin(progress * Math.PI * 1.05) * 0.16) + randomBetween(-14, 14)

      centers.push({
        x: clamp(x, width * 0.14, width * 0.86),
        y: clamp(y, height * 0.22, height * 0.78)
      })
    }

    return centers
  }

  function positionNodes(state, timestamp) {
    state.nodes.forEach((node) => {
      const orbitPhase = timestamp * node.orbitSpeed + node.phase
      node.x = node.anchorX + Math.cos(orbitPhase) * node.orbitX
      node.y = node.anchorY + Math.sin(orbitPhase * 0.92) * node.orbitY
    })
  }

  function updateNodes(state, timestamp, delta) {
    const driftScale = delta / 16.667
    const edgePaddingX = state.width * 0.08
    const edgePaddingY = state.height * 0.12

    state.nodes.forEach((node) => {
      const driftPhase = timestamp * 0.00012 + node.phase
      const targetX = node.clusterX + Math.cos(driftPhase) * 18
      const targetY = node.clusterY + Math.sin(driftPhase * 1.16) * 14

      node.anchorVx += (targetX - node.anchorX) * 0.00022 * delta
      node.anchorVy += (targetY - node.anchorY) * 0.00022 * delta
      node.anchorVx += Math.cos(driftPhase * 0.8) * 0.002
      node.anchorVy += Math.sin(driftPhase * 0.95) * 0.0016
      node.anchorVx *= 0.985
      node.anchorVy *= 0.985

      node.anchorX += node.anchorVx * driftScale
      node.anchorY += node.anchorVy * driftScale

      if (node.anchorX < edgePaddingX || node.anchorX > state.width - edgePaddingX) {
        node.anchorVx *= -0.92
        node.anchorX = clamp(node.anchorX, edgePaddingX, state.width - edgePaddingX)
      }

      if (node.anchorY < edgePaddingY || node.anchorY > state.height - edgePaddingY) {
        node.anchorVy *= -0.92
        node.anchorY = clamp(node.anchorY, edgePaddingY, state.height - edgePaddingY)
      }
    })

    positionNodes(state, timestamp)
  }

  function buildNetwork(nodes, maxDistance) {
    const candidates = []
    const nearestBonds = new Array(nodes.length).fill(null)
    const bonds = []
    const adjacency = Array.from({ length: nodes.length }, () => [])
    const selectedKeys = new Set()
    const bondCounts = new Array(nodes.length).fill(0)

    for (let firstIndex = 0; firstIndex < nodes.length; firstIndex += 1) {
      for (let secondIndex = firstIndex + 1; secondIndex < nodes.length; secondIndex += 1) {
        const firstNode = nodes[firstIndex]
        const secondNode = nodes[secondIndex]
        const dx = secondNode.x - firstNode.x
        const dy = secondNode.y - firstNode.y
        const distance = Math.hypot(dx, dy)

        if (distance > maxDistance) continue

        const sameCluster = firstNode.clusterIndex === secondNode.clusterIndex
        const candidate = {
          firstIndex,
          secondIndex,
          distance,
          sameCluster,
          score: distance + (sameCluster ? 0 : 16)
        }

        candidates.push(candidate)
        nearestBonds[firstIndex] = chooseNearestBond(nearestBonds[firstIndex], candidate)
        nearestBonds[secondIndex] = chooseNearestBond(nearestBonds[secondIndex], candidate)
      }
    }

    candidates.sort((left, right) => left.score - right.score)

    nearestBonds.forEach((candidate) => {
      addBond(candidate, true)
    })

    candidates.forEach((candidate) => {
      addBond(candidate, false)
    })

    return { bonds, adjacency }

    function addBond(candidate, required) {
      if (!candidate) return

      const key = `${candidate.firstIndex}:${candidate.secondIndex}`
      if (selectedKeys.has(key)) return

      if (!required) {
        const maxFirst = candidate.sameCluster ? 3 : 2
        const maxSecond = candidate.sameCluster ? 3 : 2

        if (bondCounts[candidate.firstIndex] >= maxFirst || bondCounts[candidate.secondIndex] >= maxSecond) {
          return
        }
      }

      selectedKeys.add(key)
      bonds.push(candidate)
      adjacency[candidate.firstIndex].push(candidate.secondIndex)
      adjacency[candidate.secondIndex].push(candidate.firstIndex)
      bondCounts[candidate.firstIndex] += 1
      bondCounts[candidate.secondIndex] += 1
    }
  }

  function chooseNearestBond(currentCandidate, nextCandidate) {
    if (!currentCandidate) return nextCandidate
    return nextCandidate.distance < currentCandidate.distance ? nextCandidate : currentCandidate
  }

  function updateSignals(state, timestamp, delta) {
    state.signalPulses.fill(0)

    if (timestamp >= state.nextSignalAt) {
      const signal = createSignal(state.adjacency, state.nodes, state.colors)

      if (signal) {
        state.signals.push(signal)
        state.nextSignalAt = timestamp + randomBetween(SIGNAL_INTERVAL_MIN, SIGNAL_INTERVAL_MAX)
      } else {
        state.nextSignalAt = timestamp + 1600
      }
    }

    state.signals = state.signals.filter((signal) => {
      signal.progress += delta / signal.duration

      const lastStep = Math.max(signal.path.length - 1, 1)
      signal.path.forEach((nodeIndex, stepIndex) => {
        const anchor = stepIndex / lastStep
        const distance = Math.abs(signal.progress - anchor)

        if (distance > 0.18) return

        const intensity = 1 - distance / 0.18
        state.signalPulses[nodeIndex] = Math.max(state.signalPulses[nodeIndex], intensity)
      })

      return signal.progress < 1.1
    })
  }

  function createSignal(adjacency, nodes, colors) {
    const eligibleNodes = adjacency
      .map((neighbors, index) => (neighbors.length ? index : -1))
      .filter((index) => index >= 0)

    if (!eligibleNodes.length) return null

    const startIndex = eligibleNodes[Math.floor(Math.random() * eligibleNodes.length)]
    const path = [startIndex]
    let currentIndex = startIndex
    let previousIndex = -1
    const targetLength = Math.floor(randomBetween(3, 6))

    while (path.length < targetLength) {
      const nextOptions = adjacency[currentIndex].filter((neighbor) => neighbor !== previousIndex && !path.includes(neighbor))
      if (!nextOptions.length) break

      nextOptions.sort((left, right) => {
        const leftScore = nodes[left].clusterIndex === nodes[currentIndex].clusterIndex ? -1 : 1
        const rightScore = nodes[right].clusterIndex === nodes[currentIndex].clusterIndex ? -1 : 1
        return leftScore - rightScore
      })

      const nextIndex = nextOptions[Math.floor(Math.random() * Math.min(2, nextOptions.length))]
      path.push(nextIndex)
      previousIndex = currentIndex
      currentIndex = nextIndex
    }

    if (path.length < 2) return null

    const startNode = nodes[path[0]]
    const color = startNode.type === "primary" ? colors.gold : startNode.type === "secondary" ? colors.silver : colors.bio

    return {
      color,
      duration: randomBetween(1600, 2300),
      path,
      progress: 0
    }
  }

  function drawBonds(state, breath) {
    const { context, bonds, nodes, colors } = state

    bonds.forEach((bond) => {
      const firstNode = nodes[bond.firstIndex]
      const secondNode = nodes[bond.secondIndex]
      const strength = 1 - bond.distance / state.bondDistance
      const alpha = bond.sameCluster
        ? (0.08 + strength * 0.18) * breath
        : (0.05 + strength * 0.12) * breath
      const firstPulse = state.signalPulses[bond.firstIndex] || 0
      const secondPulse = state.signalPulses[bond.secondIndex] || 0
      const bondSignal = Math.max(firstPulse, secondPulse)

      context.save()
      context.globalAlpha = clamp(alpha, 0, 1)
      context.strokeStyle = bond.sameCluster ? colors.bio : colors.silver
      context.lineWidth = 1 + bondSignal * 0.8
      context.beginPath()
      context.moveTo(firstNode.x, firstNode.y)
      context.lineTo(secondNode.x, secondNode.y)
      context.stroke()
      context.restore()
    })
  }

  function drawSignals(state) {
    const { context, nodes, signals } = state

    signals.forEach((signal) => {
      const trailStart = Math.max(0, signal.progress - 0.16)
      const trailSamples = samplePath(nodes, signal.path, trailStart, signal.progress, 14)
      if (!trailSamples.length) return

      context.save()
      context.globalAlpha = 0.72
      context.strokeStyle = signal.color
      context.lineWidth = 2
      context.beginPath()
      context.moveTo(trailSamples[0].x, trailSamples[0].y)

      for (let index = 1; index < trailSamples.length; index += 1) {
        context.lineTo(trailSamples[index].x, trailSamples[index].y)
      }

      context.stroke()
      context.restore()

      const pulsePoint = getPointOnPath(nodes, signal.path, signal.progress)
      if (!pulsePoint) return

      context.save()
      context.globalAlpha = 0.16
      context.fillStyle = signal.color
      context.beginPath()
      context.arc(pulsePoint.x, pulsePoint.y, 12, 0, Math.PI * 2)
      context.fill()
      context.restore()

      context.save()
      context.globalAlpha = 0.9
      context.fillStyle = signal.color
      context.beginPath()
      context.arc(pulsePoint.x, pulsePoint.y, 2.6, 0, Math.PI * 2)
      context.fill()
      context.restore()
    })
  }

  function drawNodes(state, timestamp, breath, staticFrame) {
    const { context, nodes, colors, signalPulses } = state

    nodes.forEach((node, index) => {
      const pulse = staticFrame ? 0.94 : 0.9 + Math.sin(timestamp * 0.001 + node.phase) * 0.1
      const signalBoost = signalPulses[index] || 0
      const color = node.type === "primary" ? colors.gold : node.type === "secondary" ? colors.silver : colors.bio
      const focusBoost = (state.focusPulseCluster >= 0 && node.clusterIndex === state.focusPulseCluster)
        ? Math.sin(state.focusPulseProgress * Math.PI) * 0.15
        : 0
      const coreAlpha = Math.min(0.94, (0.66 + pulse * 0.2 + signalBoost * 0.22 + focusBoost) * breath)
      const glowRadius = node.radius * (3.8 + signalBoost * 1.8 + focusBoost * 2)

      context.save()
      context.globalAlpha = clamp(0.06 + signalBoost * 0.12, 0, 1)
      context.fillStyle = color
      context.beginPath()
      context.arc(node.x, node.y, glowRadius, 0, Math.PI * 2)
      context.fill()
      context.restore()

      context.save()
      context.globalAlpha = clamp(coreAlpha, 0, 1)
      context.fillStyle = color
      context.beginPath()
      context.arc(node.x, node.y, node.radius + signalBoost * 0.6, 0, Math.PI * 2)
      context.fill()
      context.restore()
    })
  }

  function getPointOnPath(nodes, path, progress) {
    if (path.length < 2) return null

    const segments = []
    let totalLength = 0

    for (let index = 0; index < path.length - 1; index += 1) {
      const fromNode = nodes[path[index]]
      const toNode = nodes[path[index + 1]]
      const length = Math.hypot(toNode.x - fromNode.x, toNode.y - fromNode.y)

      segments.push({ fromNode, toNode, length })
      totalLength += length
    }

    if (!totalLength) {
      const node = nodes[path[0]]
      return { x: node.x, y: node.y }
    }

    const targetLength = clamp(progress, 0, 1) * totalLength
    let traveled = 0

    for (let index = 0; index < segments.length; index += 1) {
      const segment = segments[index]
      if (traveled + segment.length >= targetLength) {
        const localProgress = segment.length ? (targetLength - traveled) / segment.length : 0

        return {
          x: segment.fromNode.x + (segment.toNode.x - segment.fromNode.x) * localProgress,
          y: segment.fromNode.y + (segment.toNode.y - segment.fromNode.y) * localProgress
        }
      }

      traveled += segment.length
    }

    const lastNode = nodes[path[path.length - 1]]
    return { x: lastNode.x, y: lastNode.y }
  }

  function samplePath(nodes, path, startProgress, endProgress, sampleCount) {
    const samples = []

    for (let index = 0; index <= sampleCount; index += 1) {
      const progress = startProgress + (endProgress - startProgress) * (index / sampleCount)
      const point = getPointOnPath(nodes, path, progress)
      if (point) samples.push(point)
    }

    return samples
  }

  function getNodeType(index, nodeCount) {
    const ratio = index / nodeCount
    if (ratio < 0.22) return "primary"
    if (ratio < 0.7) return "secondary"
    return "accent"
  }

  function getNodeRadius(type) {
    if (type === "primary") return randomBetween(3.2, 4.7)
    if (type === "secondary") return randomBetween(2.2, 3.1)
    return randomBetween(1.6, 2.1)
  }

  function readPalette(container) {
    const rootStyles = getComputedStyle(document.documentElement)
    const probe = document.createElement("span")
    probe.setAttribute("aria-hidden", "true")
    probe.style.position = "absolute"
    probe.style.opacity = "0"
    probe.style.pointerEvents = "none"
    container.appendChild(probe)

    const colors = {
      bio: resolveColor(probe, rootStyles.getPropertyValue("--color-accent-bio").trim()),
      gold: resolveColor(probe, rootStyles.getPropertyValue("--color-accent-gold").trim()),
      silver: resolveColor(probe, rootStyles.getPropertyValue("--color-accent-silver").trim())
    }

    probe.remove()
    return colors
  }

  function resolveColor(probe, value) {
    probe.style.color = value
    return getComputedStyle(probe).color || value
  }

  function stopLoop(state) {
    if (!state.rafId) return
    cancelAnimationFrame(state.rafId)
    state.rafId = 0
  }

  function randomBetween(min, max) {
    return min + Math.random() * (max - min)
  }

  function gaussianOffset() {
    return (Math.random() + Math.random() + Math.random() - 1.5) / 1.5
  }

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value))
  }

  window.initHeroAnimation = initHeroAnimation
})()
