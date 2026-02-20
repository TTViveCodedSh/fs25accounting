import * as React from 'react'
import { cn } from '@/lib/utils'

interface ProgressProps extends React.HTMLAttributes<HTMLDivElement> {
  value: number
  max?: number
  indicatorClassName?: string
}

const Progress = React.forwardRef<HTMLDivElement, ProgressProps>(
  ({ className, value, max = 100, indicatorClassName, ...props }, ref) => {
    const pct = Math.min(Math.max((value / max) * 100, 0), 100)
    return (
      <div ref={ref} className={cn('relative h-2 w-full overflow-hidden rounded-full bg-primary/20', className)} {...props}>
        <div className={cn('h-full rounded-full bg-primary transition-all', indicatorClassName)} style={{ width: `${pct}%` }} />
      </div>
    )
  },
)
Progress.displayName = 'Progress'

export { Progress }
