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
                  ? 'bg-blue-600 text-white'
                  : step.state === 'done'
                    ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200'
                    : step.state === 'failed'
                      ? 'bg-red-100 text-red-700'
                      : step.state === 'skipped'
                        ? 'bg-gray-100 text-gray-500'
                        : 'bg-gray-100 text-gray-400'
              } ${isClickable ? 'cursor-pointer' : 'cursor-default'}`}
            >
              <span
                className={`flex h-5 w-5 items-center justify-center rounded-full text-[10px] ${
                  step.state === 'active'
                    ? 'bg-white text-blue-600'
                    : step.state === 'done'
                      ? 'bg-emerald-600 text-white'
                      : 'bg-white text-gray-500'
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
