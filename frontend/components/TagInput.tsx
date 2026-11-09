"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

export default function TagInput({ value, onChange, placeholder, suggestions = [], tone = "gray" }: {
  value: string[]; onChange: (v: string[]) => void; placeholder?: string; suggestions?: string[]; tone?: "blue" | "gray";
}) {
  const [text, setText] = useState("");
  const add = (raw: string) => {
    const items = raw.split(",").map((s) => s.trim()).filter(Boolean);
    const next = [...value];
    for (const i of items) if (!next.some((v) => v.toLowerCase() === i.toLowerCase())) next.push(i);
    onChange(next);
    setText("");
  };
  return (
    <div>
      <div className="flex flex-wrap items-center gap-2 rounded-lg border border-slate-300 px-2 py-1.5 focus-within:ring-2 focus-within:ring-blue-500">
        {value.map((v) => (
          <span key={v} className={cn("inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs", tone === "blue" ? "bg-blue-50 text-blue-700" : "bg-slate-100 text-slate-700")}>
            {v}
            <button type="button" aria-label={`Remove ${v}`} onClick={() => onChange(value.filter((x) => x !== v))}>×</button>
          </span>
        ))}
        <input
          className="min-w-[120px] flex-1 py-1 text-sm focus:outline-none"
          value={text}
          placeholder={value.length ? "" : placeholder}
          onChange={(e) => (e.target.value.includes(",") ? add(e.target.value) : setText(e.target.value))}
          onKeyDown={(e) => {
            if (e.key === "Enter") { e.preventDefault(); if (text.trim()) add(text); }
            if (e.key === "Backspace" && !text && value.length) onChange(value.slice(0, -1));
          }}
          onBlur={() => text.trim() && add(text)}
        />
      </div>
      {suggestions.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-2">
          {suggestions.filter((s) => !value.some((v) => v.toLowerCase() === s.toLowerCase())).map((s) => (
            <button key={s} type="button" onClick={() => add(s)} className="rounded-full border border-slate-200 px-3 py-1 text-xs text-slate-600 hover:bg-slate-50">+ {s}</button>
          ))}
        </div>
      )}
    </div>
  );
}
