import { motion } from "framer-motion";

interface StatusRingProps {
  /** 0-100. If omitted, renders in an ambient "waiting" pulse mode instead of a determinate arc. */
  percent?: number;
  size?: number;
  color?: string;
  trackColor?: string;
  children?: React.ReactNode;
}

/**
 * PrintATM's signature element: every "waiting" or "in progress" moment in the
 * kiosk — idle QR pulse, payment countdown, print progress — is expressed as
 * concentric rings around a central icon, so the whole flow reads as one
 * continuous heartbeat rather than disconnected screens.
 */
export function StatusRing({ percent, size = 280, color = "#2563EB", trackColor = "#DBEAFE", children }: StatusRingProps) {
  const strokeWidth = size * 0.035;
  const radius = size / 2 - strokeWidth;
  const circumference = 2 * Math.PI * radius;
  const isDeterminate = typeof percent === "number";
  const offset = isDeterminate ? circumference * (1 - percent / 100) : 0;

  return (
    <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
      {!isDeterminate && (
        <>
          <span
            className="absolute inset-0 rounded-full animate-pulse-ring"
            style={{ border: `2px solid ${color}` }}
          />
          <span
            className="absolute inset-0 rounded-full animate-pulse-ring"
            style={{ border: `2px solid ${color}`, animationDelay: "0.9s" }}
          />
        </>
      )}
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={radius} stroke={trackColor} strokeWidth={strokeWidth} fill="none" />
        {isDeterminate && (
          <motion.circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke={color}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            fill="none"
            strokeDasharray={circumference}
            initial={false}
            animate={{ strokeDashoffset: offset }}
            transition={{ duration: 0.5, ease: "easeOut" }}
          />
        )}
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">{children}</div>
    </div>
  );
}
