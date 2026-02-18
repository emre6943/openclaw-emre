import type { CommandHandler } from "./commands-types.js";
import { logVerbose } from "../../globals.js";
import { callGatewayTool } from "../../agents/tools/gateway.js";

type CronJobEntry = {
  id: string;
  name: string;
  enabled: boolean;
  schedule: { kind: string; expr?: string; everyMs?: number; at?: string; tz?: string };
  sessionTarget: string;
  wakeMode: string;
  agentId?: string;
  authProfile?: string;
  payload: { kind: string; message?: string; text?: string; model?: string };
  delivery?: { mode: string; channel?: string; to?: string };
  state?: {
    nextRunAtMs?: number;
    lastRunAtMs?: number;
    lastStatus?: string;
    lastDurationMs?: number;
  };
};

function formatSchedule(schedule: CronJobEntry["schedule"]): string {
  if (schedule.kind === "cron") {
    const tz = schedule.tz ? ` (${schedule.tz})` : "";
    return `cron: ${schedule.expr}${tz}`;
  }
  if (schedule.kind === "every") {
    const ms = schedule.everyMs ?? 0;
    if (ms >= 86_400_000) return `every ${Math.round(ms / 86_400_000)}d`;
    if (ms >= 3_600_000) return `every ${Math.round(ms / 3_600_000)}h`;
    if (ms >= 60_000) return `every ${Math.round(ms / 60_000)}m`;
    return `every ${ms}ms`;
  }
  if (schedule.kind === "at") {
    return `at: ${schedule.at ?? "?"}`;
  }
  return schedule.kind;
}

function formatRelative(ms?: number): string {
  if (typeof ms !== "number" || !Number.isFinite(ms)) return "n/a";
  const diff = ms - Date.now();
  const abs = Math.abs(diff);
  const ago = diff < 0;
  let label: string;
  if (abs < 60_000) label = `${Math.round(abs / 1000)}s`;
  else if (abs < 3_600_000) label = `${Math.round(abs / 60_000)}m`;
  else if (abs < 86_400_000) label = `${(abs / 3_600_000).toFixed(1)}h`;
  else label = `${(abs / 86_400_000).toFixed(1)}d`;
  return ago ? `${label} ago` : `in ${label}`;
}

function truncate(text: string, max: number): string {
  if (text.length <= max) return text;
  return text.slice(0, max - 1) + "…";
}

function formatJob(job: CronJobEntry, index: number): string {
  const status = job.enabled ? "✅" : "⏸";
  const lines: string[] = [];
  lines.push(`${status} *${index + 1}. ${job.name}*`);
  lines.push(`   📅 ${formatSchedule(job.schedule)}`);

  if (job.authProfile) {
    lines.push(`   🔑 Auth: \`${job.authProfile}\``);
  }
  if (job.payload.kind === "agentTurn" && job.payload.model) {
    lines.push(`   🤖 Model: \`${job.payload.model}\``);
  }

  const lastStatus = job.state?.lastStatus ?? "n/a";
  const statusEmoji = lastStatus === "ok" ? "🟢" : lastStatus === "error" ? "🔴" : "⚪";
  lines.push(`   ${statusEmoji} Last: ${lastStatus} ${formatRelative(job.state?.lastRunAtMs)}`);
  lines.push(`   ⏭ Next: ${formatRelative(job.state?.nextRunAtMs)}`);

  if (job.delivery && job.delivery.mode !== "none") {
    const target = [job.delivery.channel, job.delivery.to].filter(Boolean).join(" → ");
    lines.push(`   📨 ${job.delivery.mode}${target ? `: ${target}` : ""}`);
  }

  if (job.payload.kind === "agentTurn" && job.payload.message) {
    lines.push(`   💬 ${truncate(job.payload.message, 80)}`);
  } else if (job.payload.kind === "systemEvent" && job.payload.text) {
    lines.push(`   📝 ${truncate(job.payload.text, 80)}`);
  }

  return lines.join("\n");
}

export const handleCronjobsCommand: CommandHandler = async (params, allowTextCommands) => {
  if (!allowTextCommands) return null;
  const cmd = params.command.commandBodyNormalized;
  if (cmd !== "/cronjobs" && cmd !== "/cron") return null;

  if (!params.command.isAuthorizedSender) {
    logVerbose(
      `Ignoring /cronjobs from unauthorized sender: ${params.command.senderId || "<unknown>"}`,
    );
    return { shouldContinue: false };
  }

  try {
    const result = (await callGatewayTool("cron.list", {}, { includeDisabled: true })) as {
      jobs?: CronJobEntry[];
    };
    const jobs = result?.jobs ?? [];

    if (jobs.length === 0) {
      return {
        shouldContinue: false,
        reply: { text: "No cron jobs configured." },
      };
    }

    const header = `⏰ *Cron Jobs* (${jobs.length})\n`;
    const body = jobs.map((job, i) => formatJob(job, i)).join("\n\n");

    return {
      shouldContinue: false,
      reply: { text: `${header}\n${body}` },
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      shouldContinue: false,
      reply: { text: `❌ Failed to list cron jobs: ${message}` },
    };
  }
};
