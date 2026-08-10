// File generated from our OpenAPI spec by Scalar. See README.md for details.

type EventListener<Events, EventType extends keyof Events> = Events[EventType];

type EventListeners<Events, EventType extends keyof Events> = Array<{ listener: EventListener<Events, EventType>; once?: boolean; }>;

export type EventParameters<Events, EventType extends keyof Events> = {
  [Event in EventType]: EventListener<Events, EventType> extends (...args: infer P) => unknown ? P : never;
}[EventType];

export class EventEmitter<EventTypes extends Record<string, (...args: any[]) => unknown>> {
  #listeners: { [Event in keyof EventTypes]?: EventListeners<EventTypes, Event>; } = {};

  on<Event extends keyof EventTypes>(event: Event, listener: EventListener<EventTypes, Event>): this {
    const listeners: EventListeners<EventTypes, Event> = this.#listeners[event] || (this.#listeners[event] = []);
    listeners.push({ listener });
    return this;
  }

  off<Event extends keyof EventTypes>(event: Event, listener: EventListener<EventTypes, Event>): this {
    const listeners = this.#listeners[event];
    if (!listeners) return this;
    const index = listeners.findIndex((item) => item.listener === listener);
    if (index >= 0) listeners.splice(index, 1);
    return this;
  }

  once<Event extends keyof EventTypes>(event: Event, listener: EventListener<EventTypes, Event>): this {
    const listeners: EventListeners<EventTypes, Event> = this.#listeners[event] || (this.#listeners[event] = []);
    listeners.push({ listener, once: true });
    return this;
  }

  protected _emit<Event extends keyof EventTypes>(event: Event, ...args: EventParameters<EventTypes, Event>): void {
    const listeners = this.#listeners[event];
    if (!listeners) return;
    this.#listeners[event] = listeners.filter((listener) => !listener.once) as EventListeners<EventTypes, Event>;
    for (const { listener } of listeners) (listener as (...args: EventParameters<EventTypes, Event>) => unknown)(...args);
  }

  protected _hasListener(event: keyof EventTypes): boolean {
    return (this.#listeners[event]?.length ?? 0) > 0;
  }
}

export class InternalEventEmitter<EventTypes extends Record<string, (...args: any[]) => unknown>> extends EventEmitter<EventTypes> {
  override _emit<Event extends keyof EventTypes>(event: Event, ...args: EventParameters<EventTypes, Event>): void {
    super._emit(event, ...args);
  }
}
