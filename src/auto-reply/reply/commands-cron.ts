import { loadCronStore, resolveCronStorePath } from "../../cron/store.js";
import type { CronJob, CronSchedule } from "../../cron/types.js";
import { logVerbose } from "../../globals.js";
import type { ReplyPayload } from "../types.js";
import type { CommandHandler } from "./commands-types.js";

function formatSchedule(schedule: CronSchedule): string {
  if (schedule.kind === "at") {
    return `at ${schedule.at}`;
  }
  if (schedule.kind === "every") {
    const s = Math.round(schedule.everyMs / 1000);
    if (s < 60) {
      return `every ${s}s`;
    }
    if (s < 3600) {
      return `every ${Math.round(s / 60)}m`;
    }
    return `every ${(s / 3600).toFixed(1)}h`;
  }
  const tz = schedule.tz ? ` (${schedule.tz})` : "";
  return `cron: ${schedule.expr}${tz}`;
}

function formatRelative(ms: number | undefined, now: number): string {
  if (!ms) {
    return "—";
  }
  const delta = ms - now;
  const abs = Math.abs(delta);
  const h = abs / 3600000;
  const label = h < 1 ? `${Math.round(abs / 60000)}m` : `${h.toFixed(1)}h`;
  return delta >= 0 ? `in ${label}` : `${label} ago`;
}

function formatStatus(job: CronJob): { emoji: string; text: string } {
  if (!job.enabled) {
    return { emoji: "⏸", text: "disabled" };
  }
  if (job.state.runningAtMs) {
    return { emoji: "🔄", text: "running" };
  }
  const s = job.state.lastStatus;
  if (s === "ok") {
    return { emoji: "✅", text: "ok" };
  }
  if (s === "error") {
    return { emoji: "❌", text: "error" };
  }
  if (s === "skipped") {
    return { emoji: "⏭", text: "skipped" };
  }
  return { emoji: "⬜", text: "idle" };
}

function formatDelivery(job: CronJob): string {
  if (!job.delivery || job.delivery.mode === "none") {
    return "";
  }
  const ch = job.delivery.channel ?? "?";
  const to = job.delivery.to ?? "?";
  return `📨 announce → ${ch} → ${to}`;
}

function formatJobBlock(job: CronJob, index: number, now: number): string {
  const { emoji, text: _statusText } = formatStatus(job);
  const lines: string[] = [];

  lines.push(`${emoji} *${index}. ${job.name}*`);
  lines.push(`📅 ${formatSchedule(job.schedule)}`);

  if (job.authProfile) {
    lines.push(`🔑 Auth: ${job.authProfile}`);
  }

  const lastStr = formatRelative(job.state.lastRunAtMs, now);
  const lastStatus = job.state.lastStatus ?? "—";
  lines.push(`🟢 Last: ${lastStatus} ${lastStr}`);

  if (job.enabled && job.state.nextRunAtMs) {
    lines.push(`⏭ Next: ${formatRelative(job.state.nextRunAtMs, now)}`);
  }

  const delivery = formatDelivery(job);
  if (delivery) {
    lines.push(delivery);
  }

  // Show first ~80 chars of the payload message
  const msg =
    job.payload.kind === "agentTurn"
      ? job.payload.message
      : job.payload.kind === "systemEvent"
        ? job.payload.text
        : "";
  if (msg) {
    const preview = msg.slice(0, 80).replace(/\n/g, " ");
    lines.push(`💬 ${preview}${msg.length > 80 ? "…" : ""}`);
  }

  return lines.join("\n");
}

export const handleCronJobsCommand: CommandHandler = async (params, allowTextCommands) => {
  if (!allowTextCommands) {
    return null;
  }

  const normalized = params.command.commandBodyNormalized;
  if (normalized !== "/cronjobs" && normalized !== "/cron") {
    return null;
  }

  if (!params.command.isAuthorizedSender) {
    logVerbose(
      `Ignoring /cronjobs from unauthorized sender: ${params.command.senderId || "<unknown>"}`,
    );
    return { shouldContinue: false };
  }

  try {
    const storePath = resolveCronStorePath(params.cfg.cron?.store);
    const store = await loadCronStore(storePath);
    const jobs = store.jobs;

    if (jobs.length === 0) {
      const reply: ReplyPayload = { text: "🕐 No cron jobs configured." };
      return { shouldContinue: false, reply };
    }

    const now = Date.now();
    const blocks = jobs.map((job, i) => formatJobBlock(job, i + 1, now));
    const text = `🕐 *Cron Jobs (${jobs.length})*\n\n${blocks.join("\n\n")}`;

    const reply: ReplyPayload = { text };
    return { shouldContinue: false, reply };
  } catch (err) {
    const reply: ReplyPayload = {
      text: `❌ Failed to load cron jobs: ${String(err)}`,
      isError: true,
    };
    return { shouldContinue: false, reply };
  }
};
