import type { ComponentPropsWithoutRef } from 'react'
import { cn } from '@/lib/utils'

interface FormFieldProps extends ComponentPropsWithoutRef<'input'> {
  readonly id: string
  readonly label: string
  readonly error?: string
}

export function FormField({ id, label, error, className, ...inputProps }: FormFieldProps) {
  return (
    <div className="space-y-1">
      <label htmlFor={id} className="text-sm font-medium">
        {label}
      </label>
      <input
        id={id}
        aria-invalid={!!error}
        aria-describedby={error ? `${id}-error` : undefined}
        className={cn(
          'w-full rounded-md border border-border bg-background px-3 py-2 text-sm',
          className,
        )}
        {...inputProps}
      />
      {error && (
        <p id={`${id}-error`} className="text-xs text-destructive">
          {error}
        </p>
      )}
    </div>
  )
}
