import * as React from 'react'
import { cn } from '@/lib/utils'

interface TooltipProps {
  content: React.ReactNode
  children: React.ReactNode
  className?: string
}

export function Tooltip({ content, children, className }: TooltipProps) {
  const [open, setOpen] = React.useState(false)
  const ref = React.useRef<HTMLDivElement>(null)

  return (
    <div
      className="relative inline-block"
      ref={ref}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      {children}
      {open && (
        <div
          className={cn(
            'absolute z-50 bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 text-xs rounded-md border bg-popover text-popover-foreground shadow-md whitespace-normal max-w-64',
            className,
          )}
        >
          {content}
        </div>
      )}
    </div>
  )
}
