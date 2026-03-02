import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import axios from 'axios';
import { AlertTriangle, ArrowLeft, Download, Loader2, ShieldAlert } from 'lucide-react';

type Severity = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';

type ScanIssue = {
  id: string;
  severity: Severity;
  ruleId: string;
  description: string;
  filePath: string;
  line: number | null;
  suggestion: string;
};

type ScanSummary = {
  total: number;
  critical: number;
  high: number;
  medium: number;
  low: number;
};

type ScanReportData = {
  id: string;
  repoUrl: string;
  createdAt: string;
  securityScore: number;
  summary: ScanSummary;
  issues: ScanIssue[];
};

const SEVERITY_ORDER: Severity[] = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'];

const severityStyles: Record<Severity, string> = {
  CRITICAL: 'bg-red-100 text-red-700 border-red-200',
  HIGH: 'bg-orange-100 text-orange-700 border-orange-200',
  MEDIUM: 'bg-yellow-100 text-yellow-700 border-yellow-200',
  LOW: 'bg-slate-100 text-slate-600 border-slate-200',
};

function normalizeSeverity(input: unknown): Severity {
  const upper = typeof input === 'string' ? input.toUpperCase() : '';
  if (upper === 'CRITICAL' || upper === 'HIGH' || upper === 'MEDIUM' || upper === 'LOW') {
    return upper;
  }
  return 'LOW';
}

function normalizeReport(raw: unknown): ScanReportData {
  const source = raw as Record<string, unknown>;
  const scan = (source.scan as Record<string, unknown> | undefined) ?? source;
  const summarySource = (scan.summary as Record<string, unknown> | undefined) ?? {};
  const issuesSource = (scan.issues as unknown[] | undefined) ?? [];

  const parsedIssues = issuesSource.map((issue, index) => {
    const i = issue as Record<string, unknown>;
    return {
      id: String(i.id ?? `issue-${index}`),
      severity: normalizeSeverity(i.severity),
      ruleId: String(i.ruleId ?? i.rule ?? 'UNKNOWN_RULE'),
      description: String(i.description ?? 'No description provided'),
      filePath: String(i.filePath ?? i.file ?? 'unknown-file'),
      line: typeof i.line === 'number' ? i.line : null,
      suggestion: String(i.suggestion ?? 'No remediation suggestion provided'),
    } as ScanIssue;
  });

  const safeCount = (value: unknown) => (typeof value === 'number' ? value : 0);
  const summary: ScanSummary = {
    total: safeCount(summarySource.total ?? scan.issuesFound ?? parsedIssues.length),
    critical: safeCount(summarySource.critical ?? scan.criticalFound),
    high: safeCount(summarySource.high ?? scan.highFound),
    medium: safeCount(summarySource.medium ?? scan.mediumFound),
    low: safeCount(summarySource.low ?? scan.lowFound),
  };

  return {
    id: String(scan.id ?? ''),
    repoUrl: String(scan.repoUrl ?? 'Unknown repository'),
    createdAt: String(scan.createdAt ?? ''),
    securityScore: typeof scan.securityScore === 'number' ? scan.securityScore : 0,
    summary,
    issues: parsedIssues,
  };
}

export default function ScanReport() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [report, setReport] = useState<ScanReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!id) return;
    const token = localStorage.getItem('vb_token');
    setLoading(true);
    setError('');

    axios
      .get(`/api/scans/${id}`, token ? { headers: { Authorization: `Bearer ${token}` } } : undefined)
      .then((res) => setReport(normalizeReport(res.data)))
      .catch((err: unknown) => {
        const fallback = 'Failed to load scan report.';
        if (axios.isAxiosError(err)) {
          setError(err.response?.data?.error ?? fallback);
        } else {
          setError(fallback);
        }
      })
      .finally(() => setLoading(false));
  }, [id]);

  const groupedIssues = useMemo(() => {
    const grouped: Record<Severity, ScanIssue[]> = {
      CRITICAL: [],
      HIGH: [],
      MEDIUM: [],
      LOW: [],
    };
    (report?.issues ?? []).forEach((issue) => grouped[issue.severity].push(issue));
    return grouped;
  }, [report]);

  const handlePrint = () => window.print();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <Loader2 className="animate-spin text-[#2563EB]" size={28} />
      </div>
    );
  }

  if (error || !report) {
    return (
      <div className="min-h-screen bg-slate-50 px-6 py-10">
        <div className="mx-auto max-w-3xl rounded-2xl border border-red-200 bg-red-50 p-6 text-red-700">
          <p className="font-bold">{error || 'Report not found'}</p>
          <button
            onClick={() => navigate('/dashboard')}
            className="mt-4 rounded-lg bg-slate-900 px-4 py-2 text-sm font-bold text-white"
          >
            Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 px-6 py-10 print:bg-white print:px-0 print:py-0">
      <div className="mx-auto max-w-6xl space-y-6 print:max-w-none print:space-y-4">
        <header className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm print:rounded-none print:border-0 print:shadow-none">
          <div className="flex flex-wrap items-center justify-between gap-4 print:hidden">
            <button
              onClick={() => navigate('/dashboard')}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 hover:border-[#2563EB] hover:text-[#2563EB]"
            >
              <ArrowLeft size={16} />
              Dashboard
            </button>
            <button
              onClick={handlePrint}
              className="inline-flex items-center gap-2 rounded-lg bg-[#2563EB] px-4 py-2 text-sm font-bold text-white hover:bg-blue-700"
            >
              <Download size={16} />
              Export PDF
            </button>
          </div>

          <div className="mt-5 flex flex-col gap-6 md:flex-row md:items-center md:justify-between print:mt-0">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#2563EB]">Scan Report</p>
              <h1 className="mt-2 text-2xl font-black text-slate-900">{report.repoUrl}</h1>
              <p className="mt-1 text-sm text-slate-500">
                Scan ID: {report.id} {report.createdAt ? `• ${new Date(report.createdAt).toLocaleString()}` : ''}
              </p>
            </div>

            <div className="flex items-center gap-4">
              <div className="flex h-32 w-32 items-center justify-center rounded-full border-8 border-[#2563EB]/20 bg-[#2563EB]/5">
                <div className="text-center">
                  <p className="text-3xl font-black text-[#2563EB]">{report.securityScore}</p>
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Score</p>
                </div>
              </div>
            </div>
          </div>
        </header>

        <section className="grid gap-4 md:grid-cols-5 print:grid-cols-5">
          <SummaryCard label="Total Issues" value={report.summary.total} />
          <SummaryCard label="Critical" value={report.summary.critical} iconClass="text-red-600" />
          <SummaryCard label="High" value={report.summary.high} iconClass="text-orange-600" />
          <SummaryCard label="Medium" value={report.summary.medium} iconClass="text-yellow-600" />
          <SummaryCard label="Low" value={report.summary.low} iconClass="text-slate-600" />
        </section>

        <section className="space-y-5">
          {SEVERITY_ORDER.map((severity) => (
            <div key={severity} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm print:break-inside-avoid print:shadow-none">
              <div className="mb-4 flex items-center gap-3">
                <ShieldAlert size={18} className={severity === 'CRITICAL' ? 'text-red-600' : 'text-slate-500'} />
                <h2 className="text-lg font-black text-slate-900">{severity}</h2>
                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-600">
                  {groupedIssues[severity].length}
                </span>
              </div>

              {groupedIssues[severity].length === 0 ? (
                <p className="text-sm text-slate-400">No issues in this severity level.</p>
              ) : (
                <div className="space-y-4">
                  {groupedIssues[severity].map((issue) => (
                    <article key={issue.id} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={`rounded-full border px-2 py-0.5 text-[11px] font-bold ${severityStyles[issue.severity]}`}>
                          {issue.severity}
                        </span>
                        <span className="rounded-full border border-slate-300 bg-white px-2 py-0.5 text-[11px] font-semibold text-slate-600">
                          {issue.ruleId}
                        </span>
                      </div>

                      <p className="mt-3 text-sm font-semibold text-slate-800">{issue.description}</p>
                      <p className="mt-2 font-mono text-xs text-slate-500">
                        {issue.filePath}
                        {issue.line ? `:${issue.line}` : ''}
                      </p>
                      <p className="mt-3 text-sm text-slate-600">
                        <span className="font-semibold text-slate-700">Suggestion:</span> {issue.suggestion}
                      </p>
                    </article>
                  ))}
                </div>
              )}
            </div>
          ))}
        </section>
      </div>
    </div>
  );
}

function SummaryCard({ label, value, iconClass }: { label: string; value: number; iconClass?: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 text-center shadow-sm print:shadow-none">
      <div className={`mx-auto mb-2 flex h-8 w-8 items-center justify-center ${iconClass ?? 'text-[#2563EB]'}`}>
        <AlertTriangle size={16} />
      </div>
      <p className="text-2xl font-black text-slate-900">{value}</p>
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
    </div>
  );
}
