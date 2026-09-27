"use client";

import React from "react";
import Link from "next/link";

export const Footer: React.FC = () => {
  return (
    <footer className="border-t border-[var(--line)] py-5 text-[13px] text-[var(--muted)] bg-[var(--surface)] mt-auto transition-colors">
      <div className="wrap flex flex-col md:flex-row justify-between gap-4 items-start md:items-center">
        <div className="flex flex-col gap-1 max-w-[85ch]">
          <span>
            Prototype — fictional company. Tool costs and attack frequencies are sample assumptions; invoice-fraud and ransomware losses use FBI IC3 2025 and Sophos 2026 figures. All editable.
          </span>
          <span>
            MITRE ATT&CK® Enterprise v19.2. © 2026 The MITRE Corporation. This work is reproduced and distributed with the permission of The MITRE Corporation. Microsoft 365 capability mappings: Center for Threat-Informed Defense, Mappings Explorer (Apache-2.0).
          </span>
        </div>

        {/* Secondary Page Links */}
        <div className="flex items-center gap-4 text-xs font-semibold whitespace-nowrap">
          <Link href="/methodology" className="hover:text-[var(--ink)] underline">
            Methodology
          </Link>
          <span className="text-[var(--line)]">•</span>
          <Link href="/validation" className="hover:text-[var(--ink)] underline">
            Data Validation
          </Link>
          <span className="text-[var(--line)]">•</span>
          <Link href="/report" className="hover:text-[var(--ink)] underline">
            Executive Report
          </Link>
          <span className="text-[var(--line)]">•</span>
          <Link href="/noise" className="hover:text-[var(--ink)] underline">
            Alert Noise
          </Link>
        </div>
      </div>
    </footer>
  );
};
