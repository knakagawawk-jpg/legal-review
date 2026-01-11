"use client"

interface ScoreGaugeProps {
  score: number
}

export function ScoreGauge({ score }: ScoreGaugeProps) {
  const radius = 45
  const circumference = 2 * Math.PI * radius
  const progress = (score / 100) * circumference
  const offset = circumference - progress

  const getColor = (score: number) => {
    if (score >= 90) return "hsl(var(--success))"
    if (score >= 70) return "hsl(var(--warning))"
    if (score >= 50) return "hsl(var(--chart-3))"
    return "hsl(var(--destructive))"
  }

  // Fallback colors if CSS variables are not available
  const getColorFallback = (score: number) => {
    if (score >= 90) return "#10b981"
    if (score >= 70) return "#f59e0b"
    if (score >= 50) return "#f97316"
    return "#ef4444"
  }

  const color = getColor(score) || getColorFallback(score)

  return (
    <div className="relative w-28 h-28 flex-shrink-0">
      <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
        {/* Background circle */}
        <circle cx="50" cy="50" r={radius} fill="none" stroke="hsl(var(--muted))" strokeWidth="8" />
        {/* Progress circle */}
        <circle
          cx="50"
          cy="50"
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className="transition-all duration-1000 ease-out"
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-2xl font-bold text-foreground">{score}</span>
      </div>
    </div>
  )
}
