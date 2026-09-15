/** Serializes each periodic job and drains active work during shutdown. */
export function createScheduler(onError: (name: string, error: unknown) => void) {
  const timers: NodeJS.Timeout[] = [];
  const running = new Set<Promise<void>>();
  let stopped = false;
  return {
    add(name: string, intervalMs: number, job: () => Promise<unknown>, immediate = true) {
      if (stopped) throw new Error("Scheduler is stopped.");
      let active = false;
      const run = () => {
        if (stopped || active) return;
        active = true;
        const task = Promise.resolve().then(job)
          .then(() => undefined)
          .catch((error: unknown) => onError(name, error))
          .finally(() => { active = false; running.delete(task); });
        running.add(task);
      };
      timers.push(setInterval(run, intervalMs));
      if (immediate) run();
    },
    async stop() {
      stopped = true;
      for (const timer of timers) clearInterval(timer);
      await Promise.all(running);
    },
  };
}
