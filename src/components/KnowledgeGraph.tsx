import { useEffect, useRef, useState } from 'react'
import * as d3 from 'd3'
import type { GraphData, GraphNode } from '../types'

interface KnowledgeGraphProps {
  onSelectNote: (id: string) => void
  onSetView: (view: 'notes') => void
}

interface D3Node extends d3.SimulationNodeDatum, GraphNode {}

interface D3Link extends d3.SimulationLinkDatum<D3Node> {
  type: 'tag' | 'wikilink'
}

export function KnowledgeGraph({ onSelectNote, onSetView }: KnowledgeGraphProps) {
  const svgRef = useRef<SVGSVGElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [graphData, setGraphData] = useState<GraphData | null>(null)
  const [hoveredNode, setHoveredNode] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const load = async () => {
      const data = await window.ipcRenderer.invoke('get-graph-data') as GraphData
      setGraphData(data)
      setLoading(false)
    }
    load()
  }, [])

  useEffect(() => {
    if (!graphData || !svgRef.current || !containerRef.current) return
    const { nodes, edges } = graphData

    const container = containerRef.current
    const width = container.clientWidth
    const height = container.clientHeight

    // Clear previous
    d3.select(svgRef.current).selectAll('*').remove()

    const svg = d3.select(svgRef.current)
      .attr('width', width)
      .attr('height', height)

    // Background click to deselect
    svg.append('rect')
      .attr('width', width).attr('height', height)
      .attr('fill', 'transparent')

    // Zoom/pan group
    const g = svg.append('g')

    svg.call(
      d3.zoom<SVGSVGElement, unknown>()
        .scaleExtent([0.2, 4])
        .on('zoom', (event) => g.attr('transform', event.transform))
    )

    // Prepare D3 nodes/links
    const d3Nodes: D3Node[] = nodes.map(n => ({ ...n, x: width / 2, y: height / 2 }))
    const nodeMap = new Map(d3Nodes.map(n => [n.id, n]))

    const d3Links: D3Link[] = edges
      .filter(e => nodeMap.has(e.source) && nodeMap.has(e.target))
      .map(e => ({ ...e, source: nodeMap.get(e.source)!, target: nodeMap.get(e.target)! }))

    // Simulation
    const simulation = d3.forceSimulation<D3Node>(d3Nodes)
      .force('link', d3.forceLink<D3Node, D3Link>(d3Links).id(d => d.id).distance(120).strength(0.5))
      .force('charge', d3.forceManyBody().strength(-200))
      .force('center', d3.forceCenter(width / 2, height / 2))
      .force('collision', d3.forceCollide().radius(d => getRadius(d as D3Node) + 10))

    // Links
    const link = g.append('g').selectAll<SVGLineElement, D3Link>('line')
      .data(d3Links)
      .join('line')
      .attr('stroke', d => d.type === 'wikilink' ? '#6366f188' : '#a78bfa55')
      .attr('stroke-width', d => d.type === 'wikilink' ? 2 : 1.5)
      .attr('stroke-dasharray', d => d.type === 'tag' ? '4,3' : 'none')

    // Node groups
    const node = g.append('g').selectAll<SVGGElement, D3Node>('g')
      .data(d3Nodes)
      .join('g')
      .attr('cursor', 'pointer')
      .call(
        d3.drag<SVGGElement, D3Node>()
          .on('start', (event, d) => {
            if (!event.active) simulation.alphaTarget(0.3).restart()
            d.fx = d.x; d.fy = d.y
          })
          .on('drag', (event, d) => { d.fx = event.x; d.fy = event.y })
          .on('end', (event, d) => {
            if (!event.active) simulation.alphaTarget(0)
            d.fx = null; d.fy = null
          })
      )
      .on('click', (_, d) => {
        onSelectNote(d.id)
        onSetView('notes')
      })
      .on('mouseenter', (_, d) => setHoveredNode(d.id))
      .on('mouseleave', () => setHoveredNode(null))

    // Node circles
    node.append('circle')
      .attr('r', d => getRadius(d))
      .attr('fill', d => getNodeColor(d))
      .attr('stroke', '#ffffff18')
      .attr('stroke-width', 1.5)
      .style('filter', 'drop-shadow(0 2px 6px rgba(0,0,0,0.4))')

    // Node labels
    node.append('text')
      .text(d => d.title.length > 16 ? d.title.slice(0, 16) + '…' : d.title)
      .attr('x', 0)
      .attr('y', d => getRadius(d) + 13)
      .attr('text-anchor', 'middle')
      .attr('font-size', '10px')
      .attr('font-family', 'Inter, sans-serif')
      .attr('fill', '#94a3b8')
      .style('pointer-events', 'none')
      .style('user-select', 'none')

    // Tick
    simulation.on('tick', () => {
      link
        .attr('x1', d => (d.source as D3Node).x!)
        .attr('y1', d => (d.source as D3Node).y!)
        .attr('x2', d => (d.target as D3Node).x!)
        .attr('y2', d => (d.target as D3Node).y!)

      node.attr('transform', d => `translate(${d.x},${d.y})`)
    })

    return () => { simulation.stop() }
  }, [graphData])

  function getRadius(n: GraphNode): number {
    return Math.max(8, Math.min(24, 8 + n.connectionCount * 3))
  }

  const FOLDER_COLORS = ['#6366f1', '#8b5cf6', '#ec4899', '#06b6d4', '#22c55e', '#f97316']
  const folderColorMap = new Map<string, string>()
  let colorIdx = 0

  function getNodeColor(n: GraphNode): string {
    if (!n.folderId) return '#334155'
    if (!folderColorMap.has(n.folderId)) {
      folderColorMap.set(n.folderId, FOLDER_COLORS[colorIdx++ % FOLDER_COLORS.length])
    }
    return folderColorMap.get(n.folderId)!
  }

  if (loading) {
    return (
      <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
        Loading graph...
      </div>
    )
  }

  if (!graphData || graphData.nodes.length === 0) {
    return (
      <div style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '12px', color: 'var(--text-muted)' }}>
        <div style={{ fontSize: '48px' }}>🕸️</div>
        <div style={{ fontSize: '16px', fontWeight: 500, color: 'var(--text-secondary)' }}>No notes to graph yet</div>
        <div style={{ fontSize: '13px' }}>Create notes and link them with <code style={{ backgroundColor: 'var(--bg-tertiary)', padding: '1px 6px', borderRadius: '4px' }}>[[Note Title]]</code> or shared tags.</div>
      </div>
    )
  }

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <div style={{ padding: '20px 28px 16px', borderBottom: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <h2 style={{ margin: 0, fontSize: '20px', fontWeight: 700, color: 'var(--text-primary)' }}>Knowledge Graph</h2>
          <p style={{ margin: '2px 0 0', fontSize: '12px', color: 'var(--text-muted)' }}>
            {graphData.nodes.length} notes · {graphData.edges.length} connections · Click a node to open
          </p>
        </div>
        <div style={{ display: 'flex', gap: '16px', fontSize: '11px', color: 'var(--text-muted)' }}>
          <span>
            <span style={{ display: 'inline-block', width: '20px', height: '2px', backgroundColor: '#6366f1', verticalAlign: 'middle', marginRight: '5px' }} />
            Wiki link
          </span>
          <span>
            <span style={{ display: 'inline-block', width: '20px', height: '2px', backgroundColor: '#a78bfa', borderTop: '1.5px dashed #a78bfa', verticalAlign: 'middle', marginRight: '5px' }} />
            Shared tag
          </span>
        </div>
      </div>

      {/* Graph canvas */}
      <div ref={containerRef} style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
        <svg ref={svgRef} style={{ width: '100%', height: '100%' }} />
        {hoveredNode && (() => {
          const n = graphData.nodes.find(x => x.id === hoveredNode)
          return n ? (
            <div style={{
              position: 'absolute', bottom: '20px', left: '50%', transform: 'translateX(-50%)',
              backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-color)',
              borderRadius: '8px', padding: '8px 14px', fontSize: '13px', color: 'var(--text-primary)',
              boxShadow: '0 4px 16px rgba(0,0,0,0.4)', pointerEvents: 'none', whiteSpace: 'nowrap',
            }}>
              <strong>{n.title || 'Untitled'}</strong>
              <span style={{ marginLeft: '8px', color: 'var(--text-muted)' }}>
                {n.connectionCount} connection{n.connectionCount !== 1 ? 's' : ''} · click to open
              </span>
            </div>
          ) : null
        })()}
      </div>
    </div>
  )
}
