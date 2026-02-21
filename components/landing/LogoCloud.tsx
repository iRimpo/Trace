"use client";

import { motion } from "framer-motion";
import Marquee from "@/components/ui/Marquee";
import {
  FaTiktok, FaYoutube, FaInstagram,
  FaSpotify, FaSoundcloud, FaApple,
} from "react-icons/fa";

const platforms = [
  { icon: FaTiktok,     label: "TikTok"       },
  { icon: FaYoutube,    label: "YouTube"      },
  { icon: FaInstagram,  label: "Instagram"    },
  { icon: FaApple,      label: "Apple Music"  },
  { icon: FaSpotify,    label: "Spotify"      },
  { icon: FaSoundcloud, label: "SoundCloud"   },
];

export default function LogoCloud() {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      whileInView={{ opacity: 1 }}
      viewport={{ once: true }}
      transition={{ duration: 0.7 }}
      className="border-y border-brand-primary/8 bg-white py-12 overflow-hidden"
    >
      <div className="mb-8 text-center">
        <span className="font-mono text-[11px] tracking-[0.25em] text-brand-dark/30 uppercase">
          Inspired by platforms dancers love
        </span>
      </div>

      <div
        className="relative"
        style={{
          maskImage:
            "linear-gradient(to right, transparent 0%, black 12%, black 88%, transparent 100%)",
          WebkitMaskImage:
            "linear-gradient(to right, transparent 0%, black 12%, black 88%, transparent 100%)",
        }}
      >
        <Marquee speed={28}>
          {platforms.map(({ icon: Icon, label }) => (
            <div
              key={label}
              className="flex items-center gap-2.5 px-8 text-brand-dark/25 hover:text-brand-primary transition-colors duration-300 cursor-default select-none"
            >
              <Icon className="text-xl" />
              <span className="font-helvetica text-sm font-semibold tracking-wide">
                {label}
              </span>
            </div>
          ))}
        </Marquee>
      </div>
    </motion.div>
  );
}
