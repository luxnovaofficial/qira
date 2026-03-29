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
      startupPhase: 0,
      startupProgress: 0,
      startupDuration: 2800,
      rafId: 0
    }

    const state = heroAnimationState

    state.handleResize = () => {
      resizeCanvas(state)
    }

    state.handleMotionChange = (event) => {
      if (event.matches) {
        stopLoop(state)
        renderFrame(state, state.lastFrame || 0, true)
        return
      }

      state.startupPhase = 0
      state.startupProgress = 0
      state.signals = []
      state.signalPulses.fill(0)
      state.focusPulseCluster = -1
      state.focusPulseProgress = 0
      state.lastFrame = performance.now()
      state.nextSignalAt = Number.POSITIVE_INFINITY
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
    state.nextSignalAt = Number.POSITIVE_INFINITY
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

  function advanceStartupState(state, delta) {
    if (state.startupPhase >= 3) return

    state.startupProgress = clamp(state.startupProgress + delta / state.startupDuration, 0, 1)

    if (state.startupProgress < 0.35) {
      state.startupPhase = 0
      return
    }

    if (state.startupProgress < 0.7) {
      state.startupPhase = 1
      return
    }

    if (state.startupProgress < 1) {
      state.startupPhase = 2
      return
    }

    state.startupPhase = 3
    state.startupProgress = 1
  }

  function renderFrame(state, timestamp, staticFrame, delta = 16.667) {
    const { context, width, height } = state

    if (!width || !height) return

    const reducedMotionStatic = staticFrame && state.reducedMotionQuery.matches

    if (reducedMotionStatic) {
      state.startupPhase = 3
      state.startupProgress = 1
    }

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
      advanceStartupState(state, delta)

      if (state.startupPhase === 2 && state.signals.length === 0) {
        const signal = createSignal(state)

        if (signal) {
          state.signals.push(signal)
          state.nextSignalAt = timestamp + randomBetween(SIGNAL_INTERVAL_MIN, SIGNAL_INTERVAL_MAX)
        }
      }

      if (state.startupPhase >= 3 && !Number.isFinite(state.nextSignalAt)) {
        state.nextSignalAt = timestamp + 1200
      }

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
    state.bondDistance = Math.max(104, Math.min(152, state.width * 0.21))

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
      node.restX *= scaleX
      node.restY *= scaleY
      node.clusterX *= scaleX
      node.clusterY *= scaleY
      node.motionRangeX *= scaleX
      node.motionRangeY *= scaleY
      node.orbitX *= scaleX
      node.orbitY *= scaleY
    })
  }

  function createBackbone(width, height, count) {
    const backbone = []
    const padding = 0.12
    const startX = width * padding
    const endX = width * (1 - padding)
    const midY = height * 0.5
    const amplitude = height * 0.18
    const divisor = Math.max(count - 1, 1)

    for (let index = 0; index < count; index += 1) {
      const t = index / divisor
      const x = startX + (endX - startX) * t
      const waveY = midY + Math.sin(t * Math.PI * 2.2) * amplitude
      const jitterX = (Math.random() - 0.5) * width * 0.03
      const jitterY = (Math.random() - 0.5) * height * 0.04

      backbone.push({
        x: x + jitterX,
        y: waveY + jitterY,
        isBackbone: true,
        backboneIndex: index,
        backboneT: t
      })
    }

    return backbone
  }

  function buildClusterAnchors(backbone, clusterCount) {
    return Array.from({ length: clusterCount }, (_, index) => {
      const t = clusterCount === 1 ? 0.5 : (index + 0.5) / clusterCount
      const anchorIndex = Math.min(backbone.length - 1, Math.round(t * (backbone.length - 1)))
      const anchor = backbone[anchorIndex]

      return { x: anchor.x, y: anchor.y }
    })
  }

  function getClusterIndex(backboneT, clusterCount) {
    return Math.min(clusterCount - 1, Math.floor(backboneT * clusterCount))
  }

  function createNodes(width, height) {
    const nodeCount = window.innerWidth < 768 ? MOBILE_NODE_COUNT : DESKTOP_NODE_COUNT
    const clusterCount = nodeCount > 24 ? 4 : 3
    const backboneCount = Math.max(5, Math.floor(nodeCount * 0.35))
    const backbone = createBackbone(width, height, backboneCount)
    const clusterAnchors = buildClusterAnchors(backbone, clusterCount)
    const backboneGroups = Array.from({ length: clusterCount }, () => [])
    const nodes = []

    backbone.forEach((point) => {
      backboneGroups[getClusterIndex(point.backboneT, clusterCount)].push(point)
    })

    backbone.forEach((point, index) => {
      const clusterIndex = getClusterIndex(point.backboneT, clusterCount)
      const clusterAnchor = clusterAnchors[clusterIndex]
      const anchorX = clamp(point.x, width * 0.08, width * 0.92)
      const anchorY = clamp(point.y, height * 0.14, height * 0.86)

      nodes.push({
        type: getBackboneType(index, backboneCount),
        clusterIndex,
        clusterX: clusterAnchor.x,
        clusterY: clusterAnchor.y,
        restX: anchorX,
        restY: anchorY,
        anchorX,
        anchorY,
        motionRangeX: randomBetween(width * 0.004, width * 0.008),
        motionRangeY: randomBetween(height * 0.004, height * 0.007),
        orbitX: randomBetween(4, 10),
        orbitY: randomBetween(3, 8),
        orbitSpeed: randomBetween(0.00018, 0.00034),
        phase: randomBetween(0, Math.PI * 2),
        radius: randomBetween(2.8, 3.6),
        x: anchorX,
        y: anchorY,
        isBackbone: true,
        backboneIndex: point.backboneIndex,
        backboneT: point.backboneT,
        depth: 1,
        driftSpeed: randomBetween(0.008, 0.015),
        driftAngle: randomBetween(0, Math.PI * 2),
        revealOffset: point.backboneT * 0.04
      })
    })

    for (let index = 0; index < nodeCount - backboneCount; index += 1) {
      const clusterIndex = index % clusterCount
      const clusterAnchor = clusterAnchors[clusterIndex]
      const anchorGroup = backboneGroups[clusterIndex]
      const anchorPoint = anchorGroup[index % anchorGroup.length] || clusterAnchor
      const depth = index % 3 === 0 ? 0.4 : 0.7
      const spreadX = depth > 0.6 ? width * 0.042 : width * 0.074
      const spreadY = depth > 0.6 ? height * 0.058 : height * 0.104
      const offsetX = gaussianOffset() * spreadX
      const offsetY = gaussianOffset() * spreadY * 0.55 + (index % 2 === 0 ? 1 : -1) * (depth > 0.6 ? height * 0.018 : height * 0.03)
      const anchorX = clamp(anchorPoint.x + offsetX, width * 0.08, width * 0.92)
      const anchorY = clamp(anchorPoint.y + offsetY, height * 0.12, height * 0.88)

      nodes.push({
        type: getNodeType(backboneCount + index, nodeCount),
        clusterIndex,
        clusterX: clusterAnchor.x,
        clusterY: clusterAnchor.y,
        restX: anchorX,
        restY: anchorY,
        anchorX,
        anchorY,
        motionRangeX: randomBetween(width * 0.006, width * (depth > 0.6 ? 0.012 : 0.018)),
        motionRangeY: randomBetween(height * 0.005, height * (depth > 0.6 ? 0.01 : 0.016)),
        orbitX: depth > 0.6 ? randomBetween(6, 16) : randomBetween(10, 22),
        orbitY: depth > 0.6 ? randomBetween(4, 12) : randomBetween(6, 16),
        orbitSpeed: depth > 0.6 ? randomBetween(0.00024, 0.00048) : randomBetween(0.00018, 0.00038),
        phase: randomBetween(0, Math.PI * 2),
        radius: depth > 0.6 ? randomBetween(2.6, 3.3) : randomBetween(1.9, 2.6),
        x: anchorX,
        y: anchorY,
        isBackbone: false,
        backboneIndex: anchorPoint.backboneIndex,
        backboneT: anchorPoint.backboneT,
        depth,
        driftSpeed: depth > 0.6 ? randomBetween(0.012, 0.02) : randomBetween(0.014, 0.024),
        driftAngle: randomBetween(0, Math.PI * 2),
        revealOffset: anchorPoint.backboneT * 0.05 + randomBetween(0.01, 0.08)
      })
    }

    return nodes
  }

  function positionNodes(state, timestamp) {
    state.nodes.forEach((node) => {
      const orbitPhase = timestamp * node.orbitSpeed + node.phase
      node.x = node.anchorX + Math.cos(orbitPhase) * node.orbitX
      node.y = node.anchorY + Math.sin(orbitPhase * 0.92) * node.orbitY
    })
  }

  function updateNodes(state, timestamp, delta) {
    const driftScale = Math.max(delta / 16.667, 0.01)
    const edgePaddingX = state.width * 0.08
    const edgePaddingY = state.height * 0.12

    state.nodes.forEach((node) => {
      const primaryWave = timestamp * node.driftSpeed * 0.02 + node.phase
      const secondaryWave = timestamp * node.driftSpeed * 0.014 + node.driftAngle
      const driftX = Math.cos(primaryWave) * node.motionRangeX + Math.sin(secondaryWave) * node.motionRangeX * 0.34
      const driftY = Math.sin(primaryWave * 0.92) * node.motionRangeY + Math.cos(secondaryWave * 0.88) * node.motionRangeY * 0.38
      const clusterOffsetX = (node.clusterX - node.restX) * 0.04 * Math.sin(secondaryWave * 0.45)
      const clusterOffsetY = (node.clusterY - node.restY) * 0.04 * Math.cos(primaryWave * 0.4)
      const targetX = node.restX + driftX + clusterOffsetX
      const targetY = node.restY + driftY + clusterOffsetY
      const easeBase = node.isBackbone ? 0.055 : node.depth > 0.6 ? 0.075 : 0.095
      const ease = 1 - Math.pow(1 - easeBase, driftScale)

      node.anchorX += (targetX - node.anchorX) * ease
      node.anchorY += (targetY - node.anchorY) * ease
      node.anchorX = clamp(node.anchorX, edgePaddingX, state.width - edgePaddingX)
      node.anchorY = clamp(node.anchorY, edgePaddingY, state.height - edgePaddingY)
    })

    positionNodes(state, timestamp)
  }

  function buildNetwork(nodes, maxDistance) {
    const candidates = []
    const backboneBonds = []
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
        const backboneLinked = firstNode.isBackbone && secondNode.isBackbone && Math.abs(firstNode.backboneIndex - secondNode.backboneIndex) === 1
        const candidate = {
          firstIndex,
          secondIndex,
          distance,
          sameCluster,
          backboneLinked,
          score: distance + (sameCluster ? 0 : 16) - (backboneLinked ? 28 : 0)
        }

        candidates.push(candidate)
        if (backboneLinked) backboneBonds.push(candidate)
        nearestBonds[firstIndex] = chooseNearestBond(nearestBonds[firstIndex], candidate)
        nearestBonds[secondIndex] = chooseNearestBond(nearestBonds[secondIndex], candidate)
      }
    }

    candidates.sort((left, right) => left.score - right.score)

    backboneBonds.forEach((candidate) => {
      addBond(candidate, true)
    })

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

    if (state.startupPhase >= 3 && !Number.isFinite(state.nextSignalAt)) {
      state.nextSignalAt = timestamp + 1200
    }

    if (state.startupPhase >= 3 && timestamp >= state.nextSignalAt) {
      const signal = createSignal(state)

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

  function createSignal(state, startIndex = -1) {
    const { adjacency, nodes, colors } = state
    const eligibleNodes = adjacency
      .map((neighbors, index) => (neighbors.length ? index : -1))
      .filter((index) => index >= 0)

    if (!eligibleNodes.length) return null

    const resolvedStartIndex = eligibleNodes.includes(startIndex) ? startIndex : pickSignalStart(state, eligibleNodes)
    const path = [resolvedStartIndex]
    const visited = new Set(path)
    let currentIndex = resolvedStartIndex
    let previousIndex = -1
    const targetLength = Math.floor(randomBetween(4, 7))

    while (path.length < targetLength) {
      const nextIndex = pickNextSignalNode(state, currentIndex, previousIndex, visited)
      if (nextIndex < 0) break

      path.push(nextIndex)
      visited.add(nextIndex)
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

  function pickSignalStart(state, eligibleNodes) {
    const backboneEligible = eligibleNodes.filter((index) => state.nodes[index].isBackbone)

    if (backboneEligible.length && Math.random() < 0.6) {
      const leftEndNodes = backboneEligible.filter((index) => state.nodes[index].backboneT < 0.18)
      const rightEndNodes = backboneEligible.filter((index) => state.nodes[index].backboneT > 0.82)

      if (leftEndNodes.length && Math.random() < 0.68) {
        return leftEndNodes[Math.floor(Math.random() * leftEndNodes.length)]
      }

      const endNodes = [...leftEndNodes, ...rightEndNodes]
      const pool = endNodes.length ? endNodes : backboneEligible
      return pool[Math.floor(Math.random() * pool.length)]
    }

    return eligibleNodes[Math.floor(Math.random() * eligibleNodes.length)]
  }

  function pickNextSignalNode(state, currentIndex, previousIndex, visited) {
    const neighbors = state.adjacency[currentIndex].filter((neighbor) => neighbor !== previousIndex && !visited.has(neighbor))

    if (!neighbors.length) return -1

    const currentNode = state.nodes[currentIndex]
    const previousNode = previousIndex >= 0 ? state.nodes[previousIndex] : null
    const weighted = []
    const preferredDirection = currentNode.isBackbone
      ? (previousNode && previousNode.isBackbone
          ? Math.sign(currentNode.backboneIndex - previousNode.backboneIndex)
          : currentNode.backboneT <= 0.5 ? 1 : -1)
      : 0

    neighbors.forEach((neighborIndex) => {
      const neighbor = state.nodes[neighborIndex]
      let weight = neighbor.clusterIndex === currentNode.clusterIndex ? 2 : 1

      if (neighbor.isBackbone) weight += 2

      if (currentNode.isBackbone && neighbor.isBackbone) {
        weight += 2

        const neighborDirection = Math.sign(neighbor.backboneIndex - currentNode.backboneIndex)
        if (preferredDirection !== 0 && neighborDirection === preferredDirection) {
          weight += 2
        }
      }

      if (currentNode.isBackbone && !neighbor.isBackbone && neighbor.clusterIndex === currentNode.clusterIndex) {
        weight = Math.max(1, weight - 1)
      }

      for (let count = 0; count < weight; count += 1) {
        weighted.push(neighborIndex)
      }
    })

    return weighted[Math.floor(Math.random() * weighted.length)]
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
      const startupAlpha = Math.min(
        computeStartupAlpha(state, firstNode),
        computeStartupAlpha(state, secondNode)
      )
      const depthFactor = Math.min(firstNode.depth || 1, secondNode.depth || 1)
      const finalAlpha = alpha * startupAlpha * depthFactor

      if (finalAlpha < 0.01) return

      context.save()
      context.globalAlpha = clamp(finalAlpha, 0, 1)
      context.strokeStyle = bond.sameCluster ? colors.bio : colors.silver
      context.lineWidth = 0.9 + depthFactor * 0.35 + bondSignal * 0.8
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
      const depthMultiplier = node.depth || 1
      const startupAlpha = computeStartupAlpha(state, node)
      const color = node.type === "primary" ? colors.gold : node.type === "secondary" ? colors.silver : colors.bio
      const focusBoost = (state.focusPulseCluster >= 0 && node.clusterIndex === state.focusPulseCluster)
        ? Math.sin(state.focusPulseProgress * Math.PI) * 0.15
        : 0

      if (startupAlpha <= 0.01) return

      const nodeRadius = node.radius * depthMultiplier
      const coreAlpha = Math.min(0.94, (0.64 + pulse * 0.18 + signalBoost * 0.22 + focusBoost) * breath * depthMultiplier * startupAlpha)
      const glowRadius = nodeRadius * (3.8 + signalBoost * 1.8 + focusBoost * 2)

      context.save()
      context.globalAlpha = clamp((0.04 + signalBoost * 0.12) * depthMultiplier * startupAlpha, 0, 1)
      context.fillStyle = color
      context.beginPath()
      context.arc(node.x, node.y, glowRadius, 0, Math.PI * 2)
      context.fill()
      context.restore()

      context.save()
      context.globalAlpha = clamp(coreAlpha, 0, 1)
      context.fillStyle = color
      context.beginPath()
      context.arc(node.x, node.y, nodeRadius + signalBoost * 0.4, 0, Math.PI * 2)
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

  function computeStartupAlpha(state, node) {
    if (state.startupPhase >= 3) return 1

    const progress = clamp(state.startupProgress, 0, 1)

    if (node.isBackbone) {
      const revealStart = node.backboneT * 0.25
      const revealEnd = revealStart + 0.15
      const t = clamp((progress - revealStart) / (revealEnd - revealStart), 0, 1)

      return easeOutExpo(t)
    }

    const bloomStart = 0.35 + node.revealOffset
    const bloomEnd = bloomStart + (node.depth > 0.6 ? 0.16 : 0.2)
    const t = clamp((progress - bloomStart) / (bloomEnd - bloomStart), 0, 1)

    return easeOutExpo(t)
  }

  function easeOutExpo(t) {
    return t >= 1 ? 1 : 1 - Math.pow(2, -10 * t)
  }

  function getNodeType(index, nodeCount) {
    const ratio = index / nodeCount
    if (ratio < 0.22) return "primary"
    if (ratio < 0.7) return "secondary"
    return "accent"
  }

  function getBackboneType(index, nodeCount) {
    const middleIndex = Math.floor((nodeCount - 1) / 2)

    if (index === 0 || index === nodeCount - 1 || index === middleIndex) return "primary"
    return index % 2 === 0 ? "secondary" : "accent"
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
