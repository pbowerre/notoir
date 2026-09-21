import type { Tag } from '../types'

interface TagBadgeProps {
  tag: Tag
  onRemove?: () => void
  small?: boolean
}

export function TagBadge({ tag, onRemove, small }: TagBadgeProps) {
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '4px',
        padding: small ? '1px 6px' : '2px 8px',
        borderRadius: '999px',
        fontSize: small ? '10px' : '11px',
        fontWeight: 500,
        backgroundColor: tag.color + '22',
        color: tag.color,
        border: `1px solid ${tag.color}44`,
        whiteSpace: 'nowrap',
        letterSpacing: '0.02em',
        userSelect: 'none',
      }}
    >
      {tag.name}
      {onRemove && (
        <button
          onClick={(e) => { e.stopPropagation(); onRemove() }}
          style={{
            background: 'none',
            border: 'none',
            color: tag.color,
            cursor: 'pointer',
            padding: 0,
            lineHeight: 1,
            fontSize: '12px',
            opacity: 0.7,
            display: 'flex',
            alignItems: 'center',
          }}
          title="Remove tag"
        >
          ×
        </button>
      )}
    </span>
  )
}
