// Browser-safe: who stands watch at the gate, what each one looks for, and when it turns a skill away.
// Keep in step with src/lib/scan.ts, which runs them.

export type Watchman = { name: string; short: string; by: string; url: string; looks: string; blocks: string };

export const WATCHMEN: Record<string, Watchman> = {
  skillspector: {
    name: "SkillSpector",
    short: "Spector",
    by: "NVIDIA",
    url: "https://github.com/NVIDIA/SkillSpector",
    looks:
      "71 vulnerability patterns in 17 categories: prompt injection, data exfiltration, privilege escalation, supply chain, tool misuse, dangerous code, taint tracking and YARA signatures. Static analysis only; its optional LLM stage is off.",
    blocks: "a risk score above 20, or any high or critical finding",
  },
  "cisco-skill-scanner": {
    name: "Skill Scanner",
    short: "Cisco",
    by: "Cisco AI Defense",
    url: "https://github.com/cisco-ai-defense/skill-scanner",
    looks: "Pattern rules (YAML and YARA-X) plus AST and dataflow analysis for prompt injection, data exfiltration and malicious code. Its optional LLM judge is off.",
    blocks: "any high or critical finding",
  },
  atr: {
    name: "Agent Threat Rules",
    short: "ATR",
    by: "the ATR project",
    url: "https://github.com/Agent-Threat-Rule/agent-threat-rules",
    looks: "An open rule set for AI agent threats (hundreds of rules across the OWASP Agentic Top 10), run offline with its telemetry reporting switched off.",
    blocks: "any high or critical match",
  },
};

export const watchman = (id: string): Watchman => WATCHMEN[id] ?? { name: id, short: id, by: "", url: "", looks: "", blocks: "" };
