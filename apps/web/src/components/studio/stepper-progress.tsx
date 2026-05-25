'use client'

import { Check } from 'lucide-react'

export type StepState = 'pending' | 'active' | 'done' | 'failed' | 'skipped'

export interface Step {
  number: number
  label: string
  state: StepState
}

export function StepperProgress({ steps, onStepClick }: { steps: Step[]; onStepClick?: (n: number) => void }) {
  return (
    <ol className="flex flex-wrap items-center gap-2 sm:gap-4">
      {steps.map((step, idx) => {
        const isClickable = !!onStepClick && (step.state === 'done' || step.state === 'active')
        return (
          <li key={step.number} className="flex items-center gap-2">
            <button
              type="button"
              disabled={!isClickable}
              onClick={() => isClickable && onStepClick?.(step.number)}
              className={`flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                step.state === 'active'
                  ? 'bg-primary text-white'
                  : step.state === 'done'
                    ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200'
                    : step.state === 'failed'
                      ? 'bg-red-100 text-destructive'
                      : step.state === 'skipped'
                        ? 'bg-muted text-muted-foreground'
                        : 'bg-muted text-muted-foreground'
              } ${isClickable ? 'cursor-pointer' : 'cursor-default'}`}
            >
              <span
                className={`flex h-5 w-5 items-center justify-center rounded-full text-[10px] ${
                  step.state === 'active'
                    ? 'bg-card text-primary'
                    : step.state === 'done'
                      ? 'bg-emerald-600 text-white'
                      : 'bg-card text-muted-foreground'
                }`}
              >
                {step.state === 'done' ? <Check className="h-3 w-3" /> : step.number}
              </span>
              {step.label}
            </button>
            {idx < steps.length - 1 && <span className="h-px w-4 bg-gray-300" aria-hidden />}
          </li>
        )
      })}
    </ol>
  )
}
