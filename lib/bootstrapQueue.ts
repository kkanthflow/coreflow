import { InteractionManager } from "react-native";

export type BootstrapTask = () => Promise<void> | void;

class BootstrapQueue {
  private queues: Record<number, BootstrapTask[]> = {};

  addTask(priority: number, task: BootstrapTask) {
    if (!this.queues[priority]) {
      this.queues[priority] = [];
    }
    this.queues[priority].push(task);
  }

  async run() {
    // Wait for initial screen transitions and animations to complete
    await new Promise((resolve) => {
      InteractionManager.runAfterInteractions(() => {
        resolve(null);
      });
    });

    const priorities = Object.keys(this.queues)
      .map(Number)
      .sort((a, b) => a - b);

    for (const priority of priorities) {
      const tasks = this.queues[priority];
      await Promise.all(
        tasks.map(async (task) => {
          try {
            await task();
          } catch (e) {
            console.error(`[BootstrapQueue] Priority ${priority} task failed:`, e);
          }
        })
      );
    }
  }
}

export const bootstrapQueue = new BootstrapQueue();
