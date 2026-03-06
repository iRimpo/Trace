"use client";

import { motion } from "framer-motion";
import Marquee from "@/components/ui/Marquee";
import { FaTiktok, FaYoutube, FaInstagram, FaSpotify, FaSoundcloud, FaApple } from "react-icons/fa";

const platforms = [
  { icon: FaTiktok,     label: "TikTok"      },
  { icon: FaYoutube,    label: "YouTube"     },
  { icon: FaInstagram,  label: "Instagram"   },
  { icon: FaApple,      label: "Apple Music" },
  { icon: FaSpotify,    label: "Spotify"     },
  { icon: FaSoundcloud, label: "SoundCloud"  },
];

const SOCIAL_PROOF = [
  { value: "500+",  label: "dancers joined" },
  { value: "4.9★",  label: "average rating"  },
  { value: "Free",  label: "during beta"     },
];

export default function LogoCloud() {
  return (
    <motion.section
      initial={{ opacity: 0 }}
      whileInView={{ opacity: 1 }}
      viewport={{ once: true }}
      transition={{ duration: 0.7 }}
      className="border-y border-white/[0.04] bg-[#0a0a14] py-14 overflow-hidden"
    >
      {/* Social proof stats */}
      <div className="mb-10 flex items-center justify-center gap-6 px-4 sm:gap-8 sm:px-6 lg:gap-16">
        {SOCIAL_PROOF.map((s, i) => (
          <div key={i} className="flex flex-col items-center gap-0.5">
            <span className="font-hero text-xl font-bold text-white">{s.value}</span>
            <span className="text-[11px] text-white/25">{s.label}</span>
          </div>
        ))}
      </div>

      {/* Divider */}
      <div className="mb-8 flex items-center justify-center gap-4 px-8">
        <div className="h-px flex-1 max-w-xs bg-white/[0.04]" />
        <span className="text-[10px] font-mono uppercase tracking-widest text-white/20">
          Inspired by platforms dancers love
        </span>
        <div className="h-px flex-1 max-w-xs bg-white/[0.04]" />
      </div>

      {/* Marquee */}
      <div
        className="relative"
        style={{
          maskImage: "linear-gradient(to right, transparent 0%, black 12%, black 88%, transparent 100%)",
          WebkitMaskImage: "linear-gradient(to right, transparent 0%, black 12%, black 88%, transparent 100%)",
        }}
      >
        <Marquee speed={28}>
          {platforms.map(({ icon: Icon, label }) => (
            <div
              key={label}
              className="flex items-center gap-2.5 px-8 text-white/20 hover:text-white/50 transition-colors duration-300 cursor-default select-none"
            >
              <Icon className="text-xl" />
              <span className="font-medium text-sm tracking-wide">{label}</span>
            </div>
          ))}
        </Marquee>
      </div>
    </motion.section>
  );
}
