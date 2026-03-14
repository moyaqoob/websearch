import { describe, test, expect, beforeEach } from "bun:test";
import { Initialize } from "../services/Initialize";
import seedUrls from "../utils/seedUrls";

describe("Initialize", () => {
  let init: Initialize;

  beforeEach(() => {
    init = new Initialize(":memory:");
  });

  describe("constructor and table setup", () => {
    test("should seed the queue with all URLs from seedUrls", () => {
      expect(init.getQueueSize()).toBe(seedUrls.length);
    });

    test("should create a fresh instance with independent queue", () => {
      const other = new Initialize(":memory:");
      expect(other.getQueueSize()).toBe(seedUrls.length);
    });
  });

  describe("getNextUrl", () => {
    test("should return a string URL", () => {
      const url = init.getNextUrl();
      expect(url).toBeString();
      expect(url!.startsWith("http")).toBe(true);
    });

    test("should remove the URL from queue after retrieval", () => {
      const sizeBefore = init.getQueueSize();
      init.getNextUrl();
      expect(init.getQueueSize()).toBe(sizeBefore - 1);
    });

    test("should return URLs in FIFO order (by rowid)", () => {
      const first = init.getNextUrl();
      expect(first).toBe(seedUrls[0]);
    });

    test("should return null when queue is exhausted", () => {
      const total = init.getQueueSize();
      for (let i = 0; i < total; i++) {
        init.getNextUrl();
      }
      expect(init.getNextUrl()).toBeNull();
    });
  });

  describe("getQueueSize", () => {
    test("should decrease as URLs are consumed", () => {
      const original = init.getQueueSize();
      init.getNextUrl();
      init.getNextUrl();
      expect(init.getQueueSize()).toBe(original - 2);
    });

    test("should be zero after all URLs are consumed", () => {
      const total = init.getQueueSize();
      for (let i = 0; i < total; i++) {
        init.getNextUrl();
      }
      expect(init.getQueueSize()).toBe(0);
    });
  });

  describe("duplicate handling", () => {
    test("should not have duplicate URLs in queue (INSERT OR IGNORE)", () => {
      const urls = new Set<string>();
      const total = init.getQueueSize();
      for (let i = 0; i < total; i++) {
        const url = init.getNextUrl()!;
        expect(urls.has(url)).toBe(false);
        urls.add(url);
      }
    });
  });
});
