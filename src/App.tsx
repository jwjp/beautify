import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowDownToLine, ArrowRight, Braces, Check, CheckCheck, ChevronDown, ChevronRight,
  CircleAlert, CircleCheck, Clipboard, Code2, FileCode2, FileInput, FileText,
  Github, Globe2, Grip, Link2, LockKeyhole, Pin, RotateCcw, Sparkles, Trash2, Upload, WrapText, X,
} from 'lucide-react';
import hljs from 'highlight.js/lib/core';
import jsonLanguage from 'highlight.js/lib/languages/json';
import yamlLanguage from 'highlight.js/lib/languages/yaml';
import xmlLanguage from 'highlight.js/lib/languages/xml';
import cssLanguage from 'highlight.js/lib/languages/css';
import javascriptLanguage from 'highlight.js/lib/languages/javascript';
import sqlLanguage from 'highlight.js/lib/languages/sql';
import markdownLanguage from 'highlight.js/lib/languages/markdown';
import { formatFromFilename, formatSource, formats, readableError, samples, type FormatId, type IndentSize } from './formatter';
import { translations, type Locale } from './i18n';

hljs.registerLanguage('json', jsonLanguage);
hljs.registerLanguage('yaml', yamlLanguage);
hljs.registerLanguage('xml', xmlLanguage);
hljs.registerLanguage('css', cssLanguage);
hljs.registerLanguage('javascript', javascriptLanguage);
hljs.registerLanguage('sql', sqlLanguage);
hljs.registerLanguage('markdown', markdownLanguage);

const highlightLanguage: Record<FormatId, string> = {
  json: 'json', yaml: 'yaml', xml: 'xml', html: 'xml', css: 'css',
  javascript: 'javascript', sql: 'sql', markdown: 'markdown',
};

const formatIcons: Record<FormatId, typeof Braces> = {
  json: Braces, yaml: Grip, xml: Code2, html: FileCode2,
  css: Sparkles, javascript: Code2, sql: FileText, markdown: FileText,
};

type ComparisonSnapshot = {
  id: number;
  name: string;
  defaultName: string;
  format: FormatId;
  value: string;
};

function countLines(value: string): number {
  return value ? value.split('\n').length : 0;
}

function formatBytes(value: string): string {
  const bytes = new TextEncoder().encode(value).length;
  return bytes < 1024 ? `${bytes} B` : `${(bytes / 1024).toFixed(1)} KB`;
}

function CodeOutput({ value, format, wrap }: { value: string; format: FormatId; wrap: boolean }) {
  const highlighted = useMemo(() => {
    if (!value) return '';
    try {
      return hljs.highlight(value, { language: highlightLanguage[format], ignoreIllegals: true }).value;
    } catch {
      return hljs.highlightAuto(value).value;
    }
  }, [value, format]);

  return (
    <div className={`code-output ${wrap ? 'is-wrapped' : ''}`}>
      <div className="line-numbers" aria-hidden="true">
        {Array.from({ length: countLines(value) }, (_, index) => <span key={index}>{index + 1}</span>)}
      </div>
      <pre><code dangerouslySetInnerHTML={{ __html: highlighted }} /></pre>
    </div>
  );
}

function allBranchPaths(value: unknown, path = '$', paths: string[] = []): string[] {
  const stack = [{ value, path }];
  while (stack.length) {
    const current = stack.pop()!;
    if (current.value !== null && typeof current.value === 'object') {
      paths.push(current.path);
      for (const [key, child] of Object.entries(current.value)) stack.push({ value: child, path: `${current.path}/${JSON.stringify(key)}` });
    }
  }
  return paths;
}

function JsonNode({ label, value, path, depth, collapsed, toggle, locale }: {
  label?: string; value: unknown; path: string; depth: number;
  collapsed: Set<string>; toggle: (path: string) => void; locale: Locale;
}) {
  const isObject = value !== null && typeof value === 'object';
  const entries = isObject ? Object.entries(value) : [];
  const isArray = Array.isArray(value);
  const isCollapsed = collapsed.has(path);
  const t = translations[locale];
  const preview = isArray ? `[${entries.length}]` : `{${entries.length}}`;
  const primitiveClass = value === null ? 'null' : typeof value;

  return (
    <div className="tree-node" style={{ '--depth': depth } as React.CSSProperties}>
      <div className="tree-row">
        {isObject ? (
          <button className="tree-toggle" onClick={() => toggle(path)} aria-label={isCollapsed ? t.expand : t.collapse}>
            {isCollapsed ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
          </button>
        ) : <span className="tree-spacer" />}
        {label !== undefined && <><span className="tree-key">{label}</span><span className="tree-colon">:</span></>}
        {isObject ? (
          <button className="tree-summary" onClick={() => toggle(path)}>
            <span className="tree-bracket">{isArray ? '[' : '{'}</span>
            {isCollapsed ? <><span className="tree-preview">{preview}</span><span className="tree-bracket">{isArray ? ']' : '}'}</span></> :
              <span className="tree-preview">{entries.length} {isArray ? t.items : t.keys}</span>}
          </button>
        ) : (
          <span className={`tree-value type-${primitiveClass}`}>
            {typeof value === 'string' ? `"${value}"` : String(value)}
          </span>
        )}
      </div>
      {isObject && !isCollapsed && (
        <>
          {entries.map(([key, child]) => (
            <JsonNode key={key} label={key} value={child} path={`${path}/${JSON.stringify(key)}`} depth={depth + 1} collapsed={collapsed} toggle={toggle} locale={locale} />
          ))}
          <div className="tree-row tree-close"><span className="tree-spacer" /><span className="tree-bracket">{isArray ? ']' : '}'}</span></div>
        </>
      )}
    </div>
  );
}

function App() {
  const [locale, setLocale] = useState<Locale>(() => localStorage.getItem('beautify-locale') === 'ko' ? 'ko' : 'en');
  const [format, setFormat] = useState<FormatId>('json');
  const [source, setSource] = useState(samples.json);
  const [output, setOutput] = useState(() => JSON.stringify(JSON.parse(samples.json), null, 2));
  const [indent, setIndent] = useState<IndentSize>(2);
  const [wrap, setWrap] = useState(false);
  const [view, setView] = useState<'code' | 'tree'>('code');
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [status, setStatus] = useState<'ready' | 'success' | 'error'>('success');
  const [errorDetail, setErrorDetail] = useState('');
  const [isFormatting, setIsFormatting] = useState(false);
  const [copied, setCopied] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [snapshots, setSnapshots] = useState<ComparisonSnapshot[]>([]);
  const [syncScroll, setSyncScroll] = useState(true);
  const [copiedSnapshot, setCopiedSnapshot] = useState<number | null>(null);
  const [compareError, setCompareError] = useState('');
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const compareRef = useRef<HTMLElement>(null);
  const comparisonScrollRefs = useRef(new Map<number, HTMLDivElement>());
  const isSyncingScroll = useRef(false);
  const nextSnapshotId = useRef(1);
  const runId = useRef(0);
  const t = translations[locale];

  const parsedJson = useMemo(() => {
    if (format !== 'json' || !output) return null;
    try { return JSON.parse(output) as unknown; } catch { return null; }
  }, [format, output]);

  useEffect(() => { localStorage.setItem('beautify-locale', locale); document.documentElement.lang = locale; }, [locale]);
  function updateSource(value: string) {
    runId.current += 1;
    setIsFormatting(false);
    setSource(value);
    setOutput('');
    setStatus('ready');
    setErrorDetail('');
    setView('code');
  }

  function selectFormat(next: FormatId) {
    if (next === format) return;
    runId.current += 1;
    setIsFormatting(false);
    setSource((current) => current === samples[format] || !current.trim() ? samples[next] : current);
    setFormat(next);
    setOutput('');
    setStatus('ready');
    setErrorDetail('');
    setView('code');
    setCollapsed(new Set());
  }

  async function beautify() {
    if (!source.trim()) {
      setStatus('error');
      setErrorDetail(t.empty);
      setOutput('');
      return;
    }
    const thisRun = ++runId.current;
    setIsFormatting(true);
    setErrorDetail('');
    try {
      const result = await formatSource(source, format, indent);
      if (thisRun !== runId.current) return;
      setOutput(result);
      setCollapsed(new Set());
      setStatus('success');
      setView('code');
    } catch (error) {
      if (thisRun !== runId.current) return;
      setOutput('');
      setStatus('error');
      setErrorDetail(readableError(error));
    } finally {
      if (thisRun === runId.current) setIsFormatting(false);
    }
  }

  function onKeyDown(event: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
      event.preventDefault();
      void beautify();
    }
    if (event.key === 'Tab') {
      event.preventDefault();
      const element = event.currentTarget;
      const start = element.selectionStart;
      const end = element.selectionEnd;
      const next = source.slice(0, start) + ' '.repeat(indent) + source.slice(end);
      updateSource(next);
      requestAnimationFrame(() => { element.selectionStart = element.selectionEnd = start + indent; });
    }
  }

  async function openFile(file?: File) {
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      setStatus('error'); setErrorDetail(t.fileTooLarge); return;
    }
    try {
      const content = await file.text();
      const inferred = formatFromFilename(file.name);
      if (inferred) setFormat(inferred);
      updateSource(content);
      inputRef.current?.focus();
    } catch {
      setStatus('error'); setErrorDetail(t.readFailed);
    }
  }

  async function copyOutput() {
    if (!output) return;
    try {
      await navigator.clipboard.writeText(output);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setStatus('error'); setErrorDetail(t.clipboardError);
    }
  }

  function downloadOutput() {
    if (!output) return;
    const extension = formats.find((item) => item.id === format)?.extension ?? 'txt';
    const url = URL.createObjectURL(new Blob([output], { type: 'text/plain;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `beautified.${extension}`;
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function togglePath(path: string) {
    setCollapsed((previous) => {
      const next = new Set(previous);
      if (next.has(path)) next.delete(path); else next.add(path);
      return next;
    });
  }

  function addToCompare() {
    if (!output) return;
    const id = nextSnapshotId.current++;
    const formatName = formats.find((item) => item.id === format)?.name ?? format.toUpperCase();
    setSnapshots((current) => {
      let number = 1;
      while (current.some((item) => item.name === `${formatName} ${number}`)) number++;
      const defaultName = `${formatName} ${number}`;
      return [...current, { id, name: defaultName, defaultName, format, value: output }];
    });
    setCompareError('');
  }

  function updateSnapshotName(id: number, name: string) {
    setSnapshots((current) => current.map((item) => item.id === id ? { ...item, name } : item));
  }

  function removeSnapshot(id: number) {
    setSnapshots((current) => current.filter((item) => item.id !== id));
    setCompareError('');
  }

  function onComparisonScroll(id: number, event: React.UIEvent<HTMLDivElement>) {
    if (!syncScroll || isSyncingScroll.current) return;
    isSyncingScroll.current = true;
    const top = event.currentTarget.scrollTop;
    for (const [otherId, element] of comparisonScrollRefs.current) {
      if (otherId !== id && element.scrollTop !== top) element.scrollTop = top;
    }
    requestAnimationFrame(() => { isSyncingScroll.current = false; });
  }

  async function copySnapshot(item: ComparisonSnapshot) {
    try {
      await navigator.clipboard.writeText(item.value);
      setCopiedSnapshot(item.id);
      setCompareError('');
      window.setTimeout(() => setCopiedSnapshot((current) => current === item.id ? null : current), 1800);
    } catch {
      setCompareError(t.clipboardError);
    }
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <a className="brand" href="#top" aria-label="Beautify home">
          <span className="brand-mark"><Braces size={23} strokeWidth={2.4} /></span>
          <span className="brand-word">beautify<span className="brand-dot">.</span></span>
        </a>
        <div className="topbar-right">
          <span className="topbar-tagline">{t.tagline}</span>
          <a className="github-link" href="https://github.com/jwjp/beautify" target="_blank" rel="noreferrer" aria-label={t.opensource} title={t.opensource}><Github size={19} /></a>
          <div className="language-switch" aria-label={t.language}>
            <Globe2 size={15} />
            <button className={locale === 'en' ? 'selected' : ''} onClick={() => setLocale('en')} aria-pressed={locale === 'en'}>EN</button>
            <span className="language-divider">/</span>
            <button className={locale === 'ko' ? 'selected' : ''} onClick={() => setLocale('ko')} aria-pressed={locale === 'ko'}>한국어</button>
          </div>
        </div>
      </header>

      <main id="top">
        <section className="hero">
          <div className="hero-glow" />
          <div className="hero-content">
            <div className="eyebrow"><span className="eyebrow-line" />{t.heroEyebrow}</div>
            <h1>{t.heroTitleA}<br /><span>{t.heroTitleB}</span></h1>
            <p>{t.heroText}</p>
            <div className="privacy-pill"><LockKeyhole size={15} /><strong>{t.privacy}</strong><span className="pill-separator" />{t.privacyDetail}</div>
          </div>
          <div className="hero-art" aria-hidden="true">
            <div className="art-card art-card-back"><span className="art-dots"><i /><i /><i /></span><span className="art-line l1" /><span className="art-line l2" /><span className="art-line l3" /></div>
            <div className="art-card art-card-front"><span className="art-dots"><i /><i /><i /></span><div className="art-code"><span><b className="purple">&#123;</b></span><span>&nbsp;&nbsp;<b className="blue">"hello"</b><b className="muted">: </b><b className="green">"world"</b><b className="muted">,</b></span><span>&nbsp;&nbsp;<b className="blue">"clarity"</b><b className="muted">: </b><b className="orange">true</b></span><span><b className="purple">&#125;</b></span></div></div>
            <span className="art-spark art-spark-one">✦</span><span className="art-spark art-spark-two">✦</span>
          </div>
        </section>

        <section className="workspace-section" aria-labelledby="workspace-heading">
          <div className="section-topline"><div><span className="section-kicker">{t.sectionKicker}</span><h2 id="workspace-heading">{t.workspace}</h2></div><span className="supported-count">{t.supported} <span className="count-dot" /></span></div>

          <div className="format-picker">
            <div className="picker-label">{t.formats}<ArrowRight size={16} /></div>
            <div className="format-list" role="group" aria-label={t.formats}>
              {formats.map((item) => {
                const Icon = formatIcons[item.id];
                return <button key={item.id} className={`format-button ${format === item.id ? 'active' : ''}`} onClick={() => selectFormat(item.id)} aria-pressed={format === item.id} title={item.description}>
                  <Icon size={17} strokeWidth={1.9} /><span>{item.name}</span>
                </button>;
              })}
            </div>
          </div>

          <div className="editor-grid">
            <section className={`editor-card input-card ${isDragging ? 'dragging' : ''}`} onDragOver={(event) => { event.preventDefault(); setIsDragging(true); }} onDragLeave={() => setIsDragging(false)} onDrop={(event) => { event.preventDefault(); setIsDragging(false); void openFile(event.dataTransfer.files[0]); }} aria-labelledby="input-heading">
              <div className="editor-header">
                <div className="editor-heading"><span className="editor-icon input-icon"><FileInput size={18} /></span><div><h3 id="input-heading">{t.input}</h3><p>{t.inputSub}</p></div></div>
                <div className="header-actions"><button className="icon-text-button" onClick={() => { updateSource(samples[format]); inputRef.current?.focus(); }} title={t.sample}><RotateCcw size={16} /><span>{t.sample}</span></button><button className="icon-button" onClick={() => { updateSource(''); inputRef.current?.focus(); }} aria-label={t.clear} title={t.clear}><X size={17} /></button></div>
              </div>
              <div className="editor-body input-body"><textarea ref={inputRef} value={source} onChange={(event) => updateSource(event.target.value)} onKeyDown={onKeyDown} placeholder={t.pastePlaceholder} aria-label={t.input} spellCheck={false} /></div>
              {isDragging && <div className="drop-overlay"><Upload size={28} /><span>{t.upload}</span></div>}
              <div className="editor-footer"><button className="footer-action" onClick={() => fileRef.current?.click()}><Upload size={15} />{t.upload}</button><input ref={fileRef} type="file" accept=".json,.jsonc,.yaml,.yml,.xml,.html,.htm,.css,.js,.jsx,.mjs,.cjs,.sql,.md,.markdown,text/*" hidden onChange={(event) => { void openFile(event.target.files?.[0]); event.target.value = ''; }} /><span className="editor-meta">{countLines(source)} {t.lines} <span>·</span> {formatBytes(source)}</span></div>
            </section>

            <section className="editor-card output-card" aria-labelledby="output-heading">
              <div className="editor-header"><div className="editor-heading"><span className="editor-icon output-icon"><CheckCheck size={18} /></span><div><h3 id="output-heading">{t.output}</h3><p>{t.outputSub}</p></div></div><div className="header-actions"><button className="icon-text-button compare-add-button" onClick={addToCompare} disabled={!output} title={t.addToCompare} aria-label={t.addToCompare}><Pin size={16} /><span>{t.addToCompare}</span></button><button className="icon-text-button" onClick={() => void copyOutput()} disabled={!output} title={t.copy}>{copied ? <Check size={16} /> : <Clipboard size={16} />}<span>{copied ? t.copied : t.copy}</span></button><button className="icon-button" onClick={downloadOutput} disabled={!output} title={t.download} aria-label={t.download}><ArrowDownToLine size={17} /></button></div></div>
              <div className="output-tabs"><div className="tab-group"><button className={view === 'code' ? 'active' : ''} onClick={() => setView('code')}><Code2 size={14} />{t.code}</button>{format === 'json' && parsedJson !== null && <button className={view === 'tree' ? 'active' : ''} onClick={() => setView('tree')}><Braces size={14} />{t.tree}</button>}</div><button className={`wrap-button ${wrap ? 'active' : ''}`} onClick={() => setWrap(!wrap)} aria-pressed={wrap} title={t.wrap}><WrapText size={16} /><span>{t.wrap}</span></button></div>
              <div className="editor-body output-body">
                {output ? view === 'tree' && format === 'json' && parsedJson !== null ? <div className="tree-view"><div className="tree-toolbar"><span>{t.treeTitle}</span><div><button onClick={() => setCollapsed(new Set())}>{t.expandAll}</button><button onClick={() => setCollapsed(new Set(allBranchPaths(parsedJson)))}>{t.collapseAll}</button></div></div><JsonNode value={parsedJson} path="$" depth={0} collapsed={collapsed} toggle={togglePath} locale={locale} /></div> : <CodeOutput value={output} format={format} wrap={wrap} /> : <div className="empty-output"><div className="empty-icon"><Braces size={25} /></div><span>{t.noOutput}</span></div>}
              </div>
              <div className="editor-footer"><span className={`status ${status}`}>
                {status === 'error' ? <CircleAlert size={15} /> : status === 'success' ? <CircleCheck size={15} /> : <span className="status-dot" />}
                {status === 'error' ? t.error : status === 'success' ? t.success : t.ready}
              </span><span className="editor-meta">{output ? `${countLines(output)} ${t.lines} · ${formatBytes(output)}` : '—'}</span></div>
            </section>
          </div>
          {status === 'error' && errorDetail && <div className="error-banner" role="alert"><CircleAlert size={17} /><span>{errorDetail}</span></div>}

          <div className="action-row"><div className="settings"><label htmlFor="indent-select">{t.indent}</label><select id="indent-select" value={indent} onChange={(event) => setIndent(Number(event.target.value) as IndentSize)}><option value="2">2 {t.spaces}</option><option value="4">4 {t.spaces}</option></select><span className="settings-divider" /><span className="keyboard-hint"><kbd>Ctrl</kbd> / <kbd>⌘</kbd> + <kbd>Enter</kbd></span></div><div className="action-buttons">{snapshots.length > 0 && <button className="comparison-jump" onClick={() => compareRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })}><Pin size={15} />{t.compare} <span>{snapshots.length}</span></button>}<button className="primary-button" onClick={() => void beautify()} disabled={isFormatting}><Sparkles size={17} />{isFormatting ? t.formatting : t.format}<ArrowRight size={17} /></button></div></div>
          <p className="file-hint">{t.fileHint}</p>
        </section>

        <section className="compare-section" aria-labelledby="compare-heading" ref={compareRef}>
          <div className="section-topline compare-topline">
            <div><span className="section-kicker">{t.compareKicker}</span><h2 id="compare-heading">{t.compare}</h2></div>
            <span className="supported-count">{snapshots.length} {t.savedResults} <span className="count-dot" /></span>
          </div>
          <div className="compare-intro">
            <p>{t.compareDescription}</p>
            {snapshots.length > 1 && <button className={`sync-button ${syncScroll ? 'active' : ''}`} onClick={() => setSyncScroll((current) => !current)} aria-pressed={syncScroll}><Link2 size={15} />{t.syncScroll}</button>}
          </div>
          {snapshots.length === 0 ? (
            <div className="compare-empty"><span className="compare-empty-icon"><Pin size={24} /></span><strong>{t.compareEmptyTitle}</strong><p>{t.compareEmptyDescription}</p></div>
          ) : (
            <div className={`compare-grid columns-${Math.min(snapshots.length, 3)}`}>
              {snapshots.map((item, index) => (
                <article className="snapshot-card" key={item.id} aria-label={`${t.savedResult} ${item.name}`}>
                  <div className="snapshot-header">
                    <span className="snapshot-number">{String(index + 1).padStart(2, '0')}</span>
                    <input value={item.name} onChange={(event) => updateSnapshotName(item.id, event.target.value)} onBlur={(event) => updateSnapshotName(item.id, event.target.value.trim() || item.defaultName)} aria-label={t.renameResult} maxLength={50} />
                    <div className="snapshot-actions"><button onClick={() => void copySnapshot(item)} aria-label={`${t.copy} ${item.name}`} title={t.copy}>{copiedSnapshot === item.id ? <Check size={16} /> : <Clipboard size={16} />}</button><button onClick={() => removeSnapshot(item.id)} aria-label={`${t.removeResult} ${item.name}`} title={t.removeResult}><Trash2 size={16} /></button></div>
                  </div>
                  <div className="snapshot-meta"><span className="snapshot-format">{formats.find((entry) => entry.id === item.format)?.name}</span><span>{countLines(item.value)} {t.lines} <span className="meta-dot">·</span> {formatBytes(item.value)}</span></div>
                  <div className="snapshot-code-scroll" ref={(element) => { if (element) comparisonScrollRefs.current.set(item.id, element); else comparisonScrollRefs.current.delete(item.id); }} onScroll={(event) => onComparisonScroll(item.id, event)}><CodeOutput value={item.value} format={item.format} wrap={wrap} /></div>
                </article>
              ))}
            </div>
          )}
          {compareError && <div className="error-banner" role="alert"><CircleAlert size={17} /><span>{compareError}</span></div>}
        </section>
      </main>

      <footer><div className="footer-inner"><div className="footer-brand"><span className="brand-mark small"><Braces size={17} /></span><span>beautify<span className="brand-dot">.</span></span><span className="footer-divider" />{t.footer}</div><div className="footer-links"><span><LockKeyhole size={14} />{t.local}</span><a href="https://github.com/jwjp/beautify" target="_blank" rel="noreferrer"><Github size={15} />{t.opensource}<ArrowRight size={13} /></a></div></div></footer>
    </div>
  );
}

export default App;
