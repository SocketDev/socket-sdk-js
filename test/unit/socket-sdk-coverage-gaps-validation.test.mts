/**
 * @file Coverage gap tests for SocketSdk file-validation callback paths.
 *   Targets the onFileValidation callback branches in socket-sdk-class.ts for
 *   createDependenciesSnapshot, createFullScan, and uploadManifestFiles.
 */

import { describe, expect, it, vi } from 'vitest'

import { getDefaultLogger } from '@socketsecurity/lib/logger/default'

import { SocketSdk } from '../../src/index.mts'

describe('SocketSdk - File validation callbacks', () => {
  describe('createDependenciesSnapshot', () => {
    it('should invoke onFileValidation callback when files are invalid', async () => {
      const onFileValidation = vi.fn().mockResolvedValue({
        shouldContinue: false,
        errorMessage: 'Invalid files detected',
        errorCause: 'Files are unreadable',
      })

      const client = new SocketSdk('test-token', {
        onFileValidation,
        retries: 0,
      })

      const result = await client.createDependenciesSnapshot(
        ['/nonexistent/file1.json', '/nonexistent/file2.json'],
        { pathsRelativeTo: '/' },
      )

      expect(result.success).toBe(false)
      if (result.success) {
        return
      }
      expect(result.error).toBe('Invalid files detected')
      expect(onFileValidation).toHaveBeenCalledOnce()
    })

    it('should continue when callback returns shouldContinue: true', async () => {
      const onFileValidation = vi.fn().mockResolvedValue({
        shouldContinue: true,
      })

      const client = new SocketSdk('test-token', {
        onFileValidation,
        retries: 0,
      })

      // All invalid files + callback says continue => should fail with "no readable files"
      const result = await client.createDependenciesSnapshot(
        ['/nonexistent/file1.json'],
        { pathsRelativeTo: '/' },
      )

      // With all files invalid and callback continuing, it falls through to
      // the "all files invalid" check and returns an error.
      expect(result.success).toBe(false)
      if (result.success) {
        return
      }
      expect(result.error).toBe('No readable manifest files found')
    })

    it('should use default error message when callback omits errorMessage', async () => {
      const onFileValidation = vi.fn().mockResolvedValue({
        shouldContinue: false,
      })

      const client = new SocketSdk('test-token', {
        onFileValidation,
        retries: 0,
      })

      const result = await client.createDependenciesSnapshot(
        ['/nonexistent/file1.json'],
        { pathsRelativeTo: '/' },
      )

      expect(result.success).toBe(false)
      if (result.success) {
        return
      }
      expect(result.error).toBe('File validation failed')
    })

    it('should warn and continue when no callback and files are invalid', async () => {
      const warnSpy = vi
        .spyOn(getDefaultLogger(), 'warn')
        .mockImplementation(
          function (this: ReturnType<typeof getDefaultLogger>) {
            return this
          },
        )

      const client = new SocketSdk('test-token', { retries: 0 })

      const result = await client.createDependenciesSnapshot(
        ['/nonexistent/file1.json'],
        { pathsRelativeTo: '/' },
      )

      // Without callback, it warns and then hits "all files invalid"
      expect(warnSpy).toHaveBeenCalled()
      expect(result.success).toBe(false)
      warnSpy.mockRestore()
    })
  })

  describe('createFullScan', () => {
    it('should invoke onFileValidation callback when files are invalid', async () => {
      const onFileValidation = vi.fn().mockResolvedValue({
        shouldContinue: false,
        errorMessage: 'Scan file validation failed',
      })

      const client = new SocketSdk('test-token', {
        onFileValidation,
        retries: 0,
      })

      const result = await client.createFullScan(
        'test-org',
        ['/nonexistent/package.json'],
        { repo: 'test-repo' },
      )

      expect(result.success).toBe(false)
      if (result.success) {
        return
      }
      expect(result.error).toBe('Scan file validation failed')
      expect(onFileValidation).toHaveBeenCalledOnce()
      // Verify context includes orgSlug
      const callContext = onFileValidation.mock.calls[0]![2]
      expect(callContext.operation).toBe('createFullScan')
      expect(callContext.orgSlug).toBe('test-org')
    })

    it('should continue when callback returns shouldContinue: true', async () => {
      const onFileValidation = vi.fn().mockResolvedValue({
        shouldContinue: true,
      })

      const client = new SocketSdk('test-token', {
        onFileValidation,
        retries: 0,
      })

      const result = await client.createFullScan(
        'test-org',
        ['/nonexistent/package.json'],
        { repo: 'test-repo' },
      )

      // All files invalid, callback says continue, hits "all files invalid" check
      expect(result.success).toBe(false)
      if (result.success) {
        return
      }
      expect(result.error).toBe('No readable manifest files found')
    })

    it('should warn without callback when files are invalid', async () => {
      const warnSpy = vi
        .spyOn(getDefaultLogger(), 'warn')
        .mockImplementation(
          function (this: ReturnType<typeof getDefaultLogger>) {
            return this
          },
        )

      const client = new SocketSdk('test-token', { retries: 0 })

      const result = await client.createFullScan(
        'test-org',
        ['/nonexistent/package.json'],
        { repo: 'test-repo' },
      )

      expect(warnSpy).toHaveBeenCalled()
      expect(result.success).toBe(false)
      warnSpy.mockRestore()
    })
  })

  describe('uploadManifestFiles', () => {
    it('should invoke onFileValidation callback when files are invalid', async () => {
      const onFileValidation = vi.fn().mockResolvedValue({
        shouldContinue: false,
        errorMessage: 'Upload validation failed',
        errorCause: 'Unreadable manifest files',
      })

      const client = new SocketSdk('test-token', {
        onFileValidation,
        retries: 0,
      })

      const result = await client.uploadManifestFiles('test-org', [
        '/nonexistent/package.json',
      ])

      expect(result.success).toBe(false)
      if (result.success) {
        return
      }
      expect(result.error).toBe('Upload validation failed')
      expect(onFileValidation).toHaveBeenCalledOnce()
      // Verify context includes orgSlug
      const callContext = onFileValidation.mock.calls[0]![2]
      expect(callContext.operation).toBe('uploadManifestFiles')
      expect(callContext.orgSlug).toBe('test-org')
    })

    it('should continue when callback returns shouldContinue: true', async () => {
      const onFileValidation = vi.fn().mockResolvedValue({
        shouldContinue: true,
      })

      const client = new SocketSdk('test-token', {
        onFileValidation,
        retries: 0,
      })

      const result = await client.uploadManifestFiles('test-org', [
        '/nonexistent/package.json',
      ])

      // All files invalid, callback continues, hits "all files invalid" check
      expect(result.success).toBe(false)
    })

    it('should use default error message when callback omits errorMessage', async () => {
      const onFileValidation = vi.fn().mockResolvedValue({
        shouldContinue: false,
      })

      const client = new SocketSdk('test-token', {
        onFileValidation,
        retries: 0,
      })

      const result = await client.uploadManifestFiles('test-org', [
        '/nonexistent/package.json',
      ])

      expect(result.success).toBe(false)
      if (result.success) {
        return
      }
      expect(result.error).toBe('File validation failed')
    })

    it('should warn without callback when files are invalid and truncate display for many files', async () => {
      const warnSpy = vi
        .spyOn(getDefaultLogger(), 'warn')
        .mockImplementation(
          function (this: ReturnType<typeof getDefaultLogger>) {
            return this
          },
        )

      const client = new SocketSdk('test-token', { retries: 0 })

      // Pass 5 invalid files to trigger the truncation (>3 triggers "... and N more")
      const result = await client.uploadManifestFiles('test-org', [
        '/nonexistent/a.json',
        '/nonexistent/b.json',
        '/nonexistent/c.json',
        '/nonexistent/d.json',
        '/nonexistent/e.json',
      ])

      expect(warnSpy).toHaveBeenCalled()
      const warnMsg = warnSpy.mock.calls[0]![0] as string
      expect(warnMsg).toContain('... and 2 more')
      expect(result.success).toBe(false)
      warnSpy.mockRestore()
    })
  })
})
