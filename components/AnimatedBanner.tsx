"use client";

import { motion } from "framer-motion";

/**
 * AnimatedBanner — TRACE wordmark with line-drawing figures integrated.
 * Same style as characters: oval head/body outlines, curved line limbs.
 * Figures are half-scale (5px stroke instead of 10px).
 */

interface BannerProps {
  animated?: boolean;
  className?: string;
}

/* ── Half-scale drawing helpers (matching the full-size oval+line style) ── */

function Head({ cx, cy }: { cx: number; cy: number }) {
  return (
    <>
      <ellipse cx={cx} cy={cy} rx="12" ry="16" fill="white" stroke="black" strokeWidth="5" />
      <circle cx={cx - 4} cy={cy - 2.5} r="2.5" fill="black" />
      <circle cx={cx + 4} cy={cy - 2.5} r="2.5" fill="black" />
    </>
  );
}

function Neck({ cx, y1, y2 }: { cx: number; y1: number; y2: number }) {
  return <line x1={cx} y1={y1} x2={cx} y2={y2} stroke="black" strokeWidth="5" strokeLinecap="round" />;
}

function Body({ cx, cy }: { cx: number; cy: number }) {
  return <ellipse cx={cx} cy={cy} rx="13" ry="21" fill="white" stroke="black" strokeWidth="5" />;
}

function Limb({ d }: { d: string }) {
  return <path d={d} fill="none" stroke="black" strokeWidth="5" strokeLinecap="round" />;
}

/* ── Letter + Figure groups ── */

function LetterT({ animated }: { animated: boolean }) {
  const bob = animated
    ? { animate: { y: [0, -2, 0] }, transition: { duration: 2.6, repeat: Infinity, ease: "easeInOut" as const } }
    : {};

  return (
    <g>
      <rect x={10} y={28} width={120} height={24} rx={6} fill="black" />
      <rect x={48} y={130} width={26} height={45} rx={6} fill="black" />

      <motion.g {...bob}>
        <Head cx={61} cy={68} />
        <Neck cx={61} y1={84} y2={88} />
        <Body cx={61} cy={106} />
        <Limb d="M 50 92 Q 40 78 36 54" />
        <Limb d="M 72 92 Q 82 78 86 54" />
        <Limb d="M 54 126 L 50 138" />
        <Limb d="M 68 126 L 72 138" />
      </motion.g>
    </g>
  );
}

function LetterR({ animated }: { animated: boolean }) {
  const bob = animated
    ? { animate: { y: [0, -1.5, 0] }, transition: { duration: 2.2, repeat: Infinity, ease: "easeInOut" as const, delay: 0.3 } }
    : {};

  return (
    <g>
      <path
        d="M20 30 L20 170 L44 170 L44 115 L60 115 L85 170 L112 170 L82 110 Q105 100 105 72 Q105 30 65 30 Z M44 52 L62 52 Q82 52 82 72 Q82 92 62 92 L44 92 Z"
        fill="black" fillRule="evenodd"
      />

      <motion.g {...bob}>
        <Head cx={128} cy={84} />
        <Neck cx={128} y1={100} y2={104} />
        <Body cx={128} cy={122} />
        <Limb d="M 118 108 Q 108 115 106 125" />
        {animated ? (
          <motion.path
            animate={{
              d: [
                "M 138 108 Q 148 90 150 75",
                "M 138 108 Q 152 85 155 68",
                "M 138 108 Q 148 90 150 75",
              ],
            }}
            transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut", delay: 0.3 }}
            fill="none" stroke="black" strokeWidth="5" strokeLinecap="round"
          />
        ) : (
          <Limb d="M 138 108 Q 148 90 150 75" />
        )}
        <Limb d="M 122 142 L 118 158" />
        <Limb d="M 134 142 L 138 158" />
      </motion.g>
    </g>
  );
}

function LetterA({ animated }: { animated: boolean }) {
  const bob = animated
    ? { animate: { y: [0, -2, 0] }, transition: { duration: 2.8, repeat: Infinity, ease: "easeInOut" as const, delay: 0.6 } }
    : {};

  return (
    <g>
      <path
        d="M60 30 L10 170 L36 170 L48 138 L110 138 L122 170 L148 170 L98 30 Z M54 116 L79 50 L104 116 Z"
        fill="black" fillRule="evenodd"
      />

      <motion.g {...bob}>
        <Head cx={79} cy={4} />
        <Neck cx={79} y1={20} y2={23} />
        <Body cx={79} cy={38} />
        <Limb d="M 69 30 Q 58 22 52 14" />
        <Limb d="M 89 30 Q 100 22 106 14" />
        <Limb d="M 73 55 L 70 68" />
        <Limb d="M 85 55 L 88 68" />
      </motion.g>
    </g>
  );
}

function LetterC({ animated }: { animated: boolean }) {
  const bob = animated
    ? { animate: { y: [0, -1.5, 0] }, transition: { duration: 2.4, repeat: Infinity, ease: "easeInOut" as const, delay: 0.9 } }
    : {};

  return (
    <g>
      <path
        d="M110 52 Q60 30 30 60 Q5 95 5 100 Q5 105 30 140 Q60 170 110 150 L110 126 Q72 142 50 120 Q30 105 30 100 Q30 95 50 78 Q72 60 110 76 Z"
        fill="black"
      />

      <motion.g {...bob}>
        <Head cx={90} cy={74} />
        <Neck cx={90} y1={90} y2={93} />
        <Body cx={90} cy={110} />
        <Limb d="M 80 98 Q 70 104 68 112" />
        <Limb d="M 100 98 Q 110 104 112 112" />
        <Limb d="M 84 130 L 80 145" />
        <Limb d="M 96 130 L 100 145" />
      </motion.g>
    </g>
  );
}

function LetterE({ animated }: { animated: boolean }) {
  const bob = animated
    ? { animate: { y: [0, -2, 0] }, transition: { duration: 2.6, repeat: Infinity, ease: "easeInOut" as const, delay: 1.2 } }
    : {};

  return (
    <g>
      <rect x={20} y={30} width={24} height={140} rx={4} fill="black" />
      <rect x={20} y={30} width={90} height={22} rx={4} fill="black" />
      <rect x={20} y={89} width={70} height={22} rx={4} fill="black" />
      <rect x={20} y={148} width={90} height={22} rx={4} fill="black" />

      <motion.g {...bob}>
        <Head cx={128} cy={70} />
        <Neck cx={128} y1={86} y2={90} />
        <Body cx={128} cy={108} />
        <Limb d="M 118 95 Q 110 100 106 108" />
        <Limb d="M 138 95 Q 146 104 148 114" />
        <Limb d="M 122 128 L 118 142" />
        <Limb d="M 134 128 L 138 142" />
      </motion.g>
    </g>
  );
}

/* ── Main ── */

export default function AnimatedBanner({ animated = true, className = "" }: BannerProps) {
  return (
    <svg
      viewBox="0 0 900 180"
      fill="none"
      className={`w-full max-w-4xl mx-auto ${className}`}
      style={{ overflow: "visible" }}
    >
      <g transform="translate(0, 0)"><LetterT animated={animated} /></g>
      <g transform="translate(155, 0)"><LetterR animated={animated} /></g>
      <g transform="translate(320, 0)"><LetterA animated={animated} /></g>
      <g transform="translate(490, 0)"><LetterC animated={animated} /></g>
      <g transform="translate(630, 0)"><LetterE animated={animated} /></g>
    </svg>
  );
}
