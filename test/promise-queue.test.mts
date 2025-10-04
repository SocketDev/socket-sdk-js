/**
 * @fileoverview Tests for PromiseQueue utility class
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { PromiseQueue } from '../src/promise-queue'

describe('PromiseQueue', () => {
  let queue: PromiseQueue

  beforeEach(() => {
    queue = new PromiseQueue(2)
  })

  afterEach(() => {
    queue.clear()
  })

  describe('Constructor', () => {
    it('should throw error when maxConcurrency is less than 1', () => {
      expect(() => new PromiseQueue(0)).toThrow(
        'maxConcurrency must be at least 1',
      )
    })

    it('should create queue with valid maxConcurrency', () => {
      const validQueue = new PromiseQueue(5)
      expect(validQueue.activeCount).toBe(0)
      expect(validQueue.pendingCount).toBe(0)
    })

    it('should create queue with maxQueueLength', () => {
      const limitedQueue = new PromiseQueue(2, 10)
      expect(limitedQueue.pendingCount).toBe(0)
    })
  })

  describe('Task Execution', () => {
    it('should execute tasks with concurrency limit', async () => {
      const results: number[] = []
      const task1 = queue.add(async () => {
        await new Promise(resolve => setTimeout(resolve, 50))
        results.push(1)
        return 1
      })
      const task2 = queue.add(async () => {
        await new Promise(resolve => setTimeout(resolve, 30))
        results.push(2)
        return 2
      })
      const task3 = queue.add(async () => {
        results.push(3)
        return 3
      })

      expect(queue.activeCount).toBeLessThanOrEqual(2)

      await Promise.all([task1, task2, task3])
      expect(results).toHaveLength(3)
      expect(queue.activeCount).toBe(0)
      expect(queue.pendingCount).toBe(0)
    })

    it('should resolve tasks with correct values', async () => {
      const result = await queue.add(async () => {
        return 'test-value'
      })

      expect(result).toBe('test-value')
    })

    it('should reject tasks that throw errors', async () => {
      const errorMessage = 'Task failed'
      await expect(
        queue.add(async () => {
          throw new Error(errorMessage)
        }),
      ).rejects.toThrow(errorMessage)
    })

    it('should continue processing after task error', async () => {
      const task1 = queue.add(async () => {
        throw new Error('First task failed')
      })

      const task2 = queue.add(async () => {
        return 'success'
      })

      await expect(task1).rejects.toThrow('First task failed')
      await expect(task2).resolves.toBe('success')
    })
  })

  describe('Queue Management', () => {
    it('should track active count correctly', async () => {
      expect(queue.activeCount).toBe(0)

      const task1 = queue.add(async () => {
        await new Promise(resolve => setTimeout(resolve, 100))
        return 1
      })
      const task2 = queue.add(async () => {
        await new Promise(resolve => setTimeout(resolve, 100))
        return 2
      })

      // Wait a bit for tasks to start
      await new Promise(resolve => setTimeout(resolve, 10))
      expect(queue.activeCount).toBe(2)

      await Promise.all([task1, task2])
      expect(queue.activeCount).toBe(0)
    })

    it('should track pending count correctly', async () => {
      const longTask1 = queue.add(async () => {
        await new Promise(resolve => setTimeout(resolve, 100))
        return 1
      })
      const longTask2 = queue.add(async () => {
        await new Promise(resolve => setTimeout(resolve, 100))
        return 2
      })
      const longTask3 = queue.add(async () => {
        await new Promise(resolve => setTimeout(resolve, 50))
        return 3
      })

      // Wait a bit for first tasks to start
      await new Promise(resolve => setTimeout(resolve, 10))
      // task3 should be pending
      expect(queue.pendingCount).toBe(1)

      await Promise.all([longTask1, longTask2, longTask3])
      expect(queue.pendingCount).toBe(0)
    })

    it('should clear pending tasks', async () => {
      const longTask1 = queue.add(async () => {
        await new Promise(resolve => setTimeout(resolve, 100))
        return 1
      })
      const longTask2 = queue.add(async () => {
        await new Promise(resolve => setTimeout(resolve, 100))
        return 2
      })
      queue.add(async () => {
        await new Promise(resolve => setTimeout(resolve, 50))
        return 3
      })

      // Wait for first tasks to start
      await new Promise(resolve => setTimeout(resolve, 10))
      expect(queue.pendingCount).toBe(1)

      queue.clear()
      expect(queue.pendingCount).toBe(0)

      await Promise.all([longTask1, longTask2])
    })
  })

  describe('onIdle', () => {
    it('should resolve immediately when queue is empty', async () => {
      await expect(queue.onIdle()).resolves.toBeUndefined()
    })

    it('should wait for all tasks to complete', async () => {
      const results: number[] = []

      queue.add(async () => {
        await new Promise(resolve => setTimeout(resolve, 50))
        results.push(1)
        return 1
      })
      queue.add(async () => {
        await new Promise(resolve => setTimeout(resolve, 30))
        results.push(2)
        return 2
      })
      queue.add(async () => {
        await new Promise(resolve => setTimeout(resolve, 10))
        results.push(3)
        return 3
      })

      await queue.onIdle()
      expect(results).toHaveLength(3)
      expect(queue.activeCount).toBe(0)
      expect(queue.pendingCount).toBe(0)
    })

    it('should wait for running tasks even after clear', async () => {
      const results: number[] = []

      queue.add(async () => {
        await new Promise(resolve => setTimeout(resolve, 50))
        results.push(1)
        return 1
      })
      queue.add(async () => {
        await new Promise(resolve => setTimeout(resolve, 50))
        results.push(2)
        return 2
      })
      queue.add(async () => {
        await new Promise(resolve => setTimeout(resolve, 10))
        results.push(3)
        return 3
      })

      // Wait for first tasks to start
      await new Promise(resolve => setTimeout(resolve, 10))
      queue.clear()

      await queue.onIdle()
      // At least the running tasks completed
      expect(results.length).toBeGreaterThanOrEqual(2)
      expect(queue.activeCount).toBe(0)
    })
  })

  describe('Max Queue Length', () => {
    it('should drop oldest tasks when queue is full', async () => {
      const limitedQueue = new PromiseQueue(1, 2)
      const completed: number[] = []

      // Add first task that will run immediately
      limitedQueue.add(async () => {
        await new Promise(resolve => setTimeout(resolve, 50))
        completed.push(1)
        return 1
      })

      // Give task1 time to start
      await new Promise(resolve => setTimeout(resolve, 10))

      // Task2 will be queued
      limitedQueue.add(async () => {
        completed.push(2)
        return 2
      })

      // Task3 will be queued (queue has 2 items: task2, task3)
      limitedQueue.add(async () => {
        completed.push(3)
        return 3
      })

      // Task4 will cause task2 to be dropped (queue is full at maxQueueLength=2)
      limitedQueue.add(async () => {
        completed.push(4)
        return 4
      })

      // Wait for all running and queued tasks to complete
      await limitedQueue.onIdle()

      // Only 3 tasks should have completed (task2 was dropped)
      expect(completed).toContain(1)
      // Task2 was dropped
      expect(completed).not.toContain(2)
      expect(completed).toContain(3)
      expect(completed).toContain(4)
      expect(completed.length).toBe(3)
    })

    it('should maintain queue length at max', async () => {
      const limitedQueue = new PromiseQueue(1, 3)

      limitedQueue.add(async () => {
        await new Promise(resolve => setTimeout(resolve, 100))
        return 1
      })
      limitedQueue.add(async () => 2)
      limitedQueue.add(async () => 3)
      limitedQueue.add(async () => 4)

      // Wait for first task to start
      await new Promise(resolve => setTimeout(resolve, 10))
      expect(limitedQueue.pendingCount).toBeLessThanOrEqual(3)
    })
  })

  describe('Complex Scenarios', () => {
    it('should handle multiple concurrent queues', async () => {
      const queue1 = new PromiseQueue(2)
      const queue2 = new PromiseQueue(2)

      const results1: number[] = []
      const results2: number[] = []

      const promises1 = [1, 2, 3].map(n =>
        queue1.add(async () => {
          await new Promise(resolve => setTimeout(resolve, 20))
          results1.push(n)
          return n
        }),
      )

      const promises2 = [4, 5, 6].map(n =>
        queue2.add(async () => {
          await new Promise(resolve => setTimeout(resolve, 20))
          results2.push(n)
          return n
        }),
      )

      await Promise.all([...promises1, ...promises2])
      expect(results1).toEqual([1, 2, 3])
      expect(results2).toEqual([4, 5, 6])
    })

    it('should handle rapid task additions', async () => {
      const results: number[] = []
      const promises = Array.from({ length: 20 }, (_, i) =>
        queue.add(async () => {
          results.push(i)
          return i
        }),
      )

      await Promise.all(promises)
      expect(results).toHaveLength(20)
    })

    it('should handle tasks with varying completion times', async () => {
      const results: string[] = []

      await Promise.all([
        queue.add(async () => {
          await new Promise(resolve => setTimeout(resolve, 50))
          results.push('slow')
          return 'slow'
        }),
        queue.add(async () => {
          results.push('fast')
          return 'fast'
        }),
        queue.add(async () => {
          await new Promise(resolve => setTimeout(resolve, 25))
          results.push('medium')
          return 'medium'
        }),
      ])

      expect(results).toContain('slow')
      expect(results).toContain('fast')
      expect(results).toContain('medium')
      expect(results).toHaveLength(3)
    })
  })
})
