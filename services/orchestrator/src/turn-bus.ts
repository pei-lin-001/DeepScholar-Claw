import type { IsoTimestamp } from "@deepscholar/contracts";

export type TurnMessage<TPayload = unknown> = {
  readonly messageId: string;
  readonly type: string;
  readonly createdAt: IsoTimestamp;
  readonly payload: TPayload;
};

export type TurnBus = {
  readonly pendingCount: () => number;
  submit: <T>(message: TurnMessage, handler: (message: TurnMessage) => Promise<T>) => Promise<T>;
  close: () => void;
};

export function createTurnBus(): TurnBus {
  let closed = false;
  let pending = 0;
  let tail: Promise<void> = Promise.resolve();

  function pendingCount(): number {
    return pending;
  }

  function close() {
    closed = true;
  }

  async function runTurn<T>(
    message: TurnMessage,
    handler: (message: TurnMessage) => Promise<T>,
  ): Promise<T> {
    pending += 1;
    try {
      return await handler(message);
    } finally {
      pending -= 1;
    }
  }

  async function submit<T>(
    message: TurnMessage,
    handler: (message: TurnMessage) => Promise<T>,
  ): Promise<T> {
    if (closed) {
      throw new Error("TurnBus 已关闭，不能再提交消息");
    }
    const task = tail.then(() => runTurn(message, handler));
    tail = task.then(
      () => undefined,
      () => undefined,
    );
    return task;
  }

  return { pendingCount, submit, close };
}
