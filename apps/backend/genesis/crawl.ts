class Queue<T> {
  private items: T[] = [];
  private head = 0;

  enqueue(item: T): void {
    this.items.push(item);
  }

  dequeue(): T | undefined {
    if (this.head >= this.items.length) return undefined;

    const item = this.items[this.head++];

    if (this.head > 1000) {
      this.items = this.items.slice(this.head);
      this.head = 0;
    }

    return item;
  }

  size(): number {
    return this.items.length - this.head;
  }

  isEmpty(): boolean {
    return this.size() === 0;
  }
}

export class DomainQueues {
    private queues: Map<string, Queue<string>> = new Map();
    private order: string[] = [];
    public total = 0;
  
    add(domain: string, url: string): void {
      let queue = this.queues.get(domain);
  
      if (!queue) {
        queue = new Queue<string>();
        this.queues.set(domain, queue);
        this.order.push(domain);
      }
  
      queue.enqueue(url);
      this.total++;
    }
  
    collectBatch(maxPerDomain: number): string[] {
      const batch: string[] = [];
  
      for (const domain of this.order) {
        const queue = this.queues.get(domain);
        if (!queue || queue.isEmpty()) continue;
  
        const take = Math.min(queue.size(), maxPerDomain);
  
        for (let i = 0; i < take; i++) {
          const url = queue.dequeue();
          if (url) {
            batch.push(url);
            this.total--;
          }
        }
      }
  
      if (this.order.length > 0) {
        this.rotateLeft();
      }
  
      return batch;
    }
  
    private rotateLeft(): void {
      const first = this.order.shift();
      if (first !== undefined) {
        this.order.push(first);
      }
    }
  }

export function extractDomain(url: string) {
  const parsed = new URL(url);
  if (!parsed.hostname) {
    return "No host name available";
  }

  return parsed.hostname;
}

class DomainDelay{
  delays:number
  lastTimeFetched : Map<string,number>
  constructor(delays:number){
    this.delays = delays;
    this.lastTimeFetched = new Map()
  }

  canFetch(domain:string){
      let lastTime = this.lastTimeFetched.get(domain)
      if(!lastTime) return true;

      return Date.now() - lastTime >= this.delays
  }
  

  markFetch(domain:string){
    this.lastTimeFetched.set(domain,Date.now())
  }
}