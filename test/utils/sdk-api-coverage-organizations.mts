/**
 * @file Deterministic HTTP fixtures for SDK method coverage.
 */
import type {
  CoverageRequest,
  CoverageRoute,
} from './sdk-api-coverage-server.mts'

function respondToOrgReposCoverage({ req, res }: CoverageRequest): void {
  if (req.method === 'DELETE') {
    res.end(JSON.stringify({ success: true }))
  } else if (req.method === 'POST' || req.method === 'PUT') {
    res.end(JSON.stringify({ data: { id: 'repo-1', name: 'test-repo' } }))
  } else {
    res.end(JSON.stringify({ data: [] }))
  }
}

function respondToOrgFullScansCoverage({
  url,
  req,
  res,
}: CoverageRequest): void {
  if (req.method === 'DELETE') {
    res.end(JSON.stringify({ success: true }))
  } else if (req.method === 'POST') {
    if (url.includes('/archive')) {
      // Archive upload endpoint
      res.end(
        JSON.stringify({
          api_url: undefined,
          branch: 'main',
          commit_hash: 'abc123',
          commit_message: 'Test commit',
          committers: [],
          created_at: '2024-01-01T00:00:00Z',
          html_report_url: 'https://socket.dev/report/scan-1',
          html_url: undefined,
          id: 'scan-1',
          integration_branch_url: undefined,
          integration_commit_url: undefined,
          integration_pull_request_url: undefined,
          integration_repo_url: '',
          integration_type: 'api',
          organization_id: 'org-1',
          organization_slug: 'test-org',
          pull_request: undefined,
          repo: 'test-repo',
          repository_id: 'repo-1',
          repository_slug: 'test-repo',
          scan_state: 'pending',
          updated_at: '2024-01-01T00:00:00Z',
          workspace: 'main',
        }),
      )
    } else {
      res.end(JSON.stringify({ data: { id: 'scan-1' } }))
    }
  } else if (url.includes('/files/tar')) {
    // Tar download endpoint
    res.writeHead(200, { 'Content-Type': 'application/x-tar' })
    res.end(Buffer.from('test tar content'))
  } else if (url.includes('/metadata')) {
    res.end(JSON.stringify({ data: { id: 'scan-1', status: 'complete' } }))
  } else {
    res.end(JSON.stringify({ data: [] }))
  }
}

function respondToOrgDiffScansCoverage({ req, res }: CoverageRequest): void {
  if (req.method === 'DELETE') {
    res.end(JSON.stringify({ success: true }))
  } else if (req.method === 'POST') {
    res.end(JSON.stringify({ data: { id: 'diff-1' } }))
  } else {
    res.end(JSON.stringify({ data: [] }))
  }
}

function respondToOrgLabelsCoverage({ req, res }: CoverageRequest): void {
  if (req.method === 'DELETE') {
    res.end(JSON.stringify({ success: true }))
  } else if (req.method === 'POST' || req.method === 'PUT') {
    res.end(JSON.stringify({ data: { id: 'label-1', name: 'test' } }))
  } else {
    res.end(JSON.stringify({ data: [] }))
  }
}

function respondToOrgAnalyticsCoverage({ res }: CoverageRequest): void {
  res.end(JSON.stringify({ data: {} }))
}

function respondToOrgSecurityPolicyCoverage({
  req,
  res,
}: CoverageRequest): void {
  if (req.method === 'PUT') {
    res.end(JSON.stringify({ data: { enabled: true } }))
  } else {
    res.end(JSON.stringify({ data: { enabled: false } }))
  }
}

function respondToOrgLicensePolicyCoverage({
  req,
  res,
}: CoverageRequest): void {
  if (req.method === 'PUT') {
    res.end(JSON.stringify({ data: { enabled: true } }))
  } else {
    res.end(JSON.stringify({ data: { enabled: false } }))
  }
}

function respondToOrgTriageCoverage({ res }: CoverageRequest): void {
  res.end(JSON.stringify({ data: [] }))
}

export function respondToOrganizationsCoverage({
  url,
  req,
  res,
}: CoverageRequest): void {
  const route = organizationCoverageRoutes.find(candidate =>
    candidate.matches(url),
  )
  if (route) {
    route.respond({ url, req, res })
  } else {
    res.end(JSON.stringify({ data: [] }))
  }
}

const organizationCoverageRoutes: CoverageRoute[] = [
  {
    matches: url => url.includes('/repos'),
    respond: respondToOrgReposCoverage,
  },
  {
    matches: url => url.includes('/full-scans'),
    respond: respondToOrgFullScansCoverage,
  },
  {
    matches: url => url.includes('/diff-scans'),
    respond: respondToOrgDiffScansCoverage,
  },
  {
    matches: url => url.includes('/labels'),
    respond: respondToOrgLabelsCoverage,
  },
  {
    matches: url => url.includes('/analytics'),
    respond: respondToOrgAnalyticsCoverage,
  },
  {
    matches: url => url.includes('/security-policy'),
    respond: respondToOrgSecurityPolicyCoverage,
  },
  {
    matches: url => url.includes('/license-policy'),
    respond: respondToOrgLicensePolicyCoverage,
  },
  {
    matches: url => url.includes('/triage'),
    respond: respondToOrgTriageCoverage,
  },
]
