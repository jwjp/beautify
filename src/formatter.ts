export const formats = [
  { id: 'json', name: 'JSON', extension: 'json', description: 'Objects & APIs' },
  { id: 'yaml', name: 'YAML', extension: 'yaml', description: 'Configs & manifests' },
  { id: 'xml', name: 'XML', extension: 'xml', description: 'Documents & feeds' },
  { id: 'html', name: 'HTML', extension: 'html', description: 'Web markup' },
  { id: 'css', name: 'CSS', extension: 'css', description: 'Stylesheets' },
  { id: 'javascript', name: 'JavaScript', extension: 'js', description: 'Scripts & code' },
  { id: 'sql', name: 'SQL', extension: 'sql', description: 'Queries' },
  { id: 'markdown', name: 'Markdown', extension: 'md', description: 'Docs & notes' },
] as const;

export type FormatId = (typeof formats)[number]['id'];
export type IndentSize = 2 | 4;

export const samples: Record<FormatId, string> = {
  json: '{"project":"beautify","version":"1.0.0","openSource":true,"features":["format","inspect","copy"],"settings":{"theme":"dark","indent":2},"contributors":[{"name":"Alex","role":"maintainer"},{"name":"Sam","role":"developer"}]}',
  yaml: 'project: beautify\nversion: 1.0.0\nfeatures: [format, inspect, copy]\nsettings: { theme: dark, indent: 2 }\ncontributors:\n  - { name: Alex, role: maintainer }',
  xml: '<project name="beautify"><version>1.0.0</version><features><feature>format</feature><feature>inspect</feature><feature>copy</feature></features></project>',
  html: '<!doctype html><html lang="en"><head><title>Beautify</title></head><body><main><h1>Make data make sense</h1><p>Beautiful formatting, right in your browser.</p></main></body></html>',
  css: '.card{display:flex;align-items:center;gap:1rem;padding:1.5rem;background:#fff;border-radius:12px}.card:hover{transform:translateY(-2px)}',
  javascript: 'const contributors=[{name:"Alex",role:"maintainer"},{name:"Sam",role:"developer"}];function greet(name){return `Hello, ${name}!`};contributors.forEach(person=>console.log(greet(person.name)));',
  sql: 'select p.name,p.version,count(f.id) as feature_count from projects p left join features f on f.project_id=p.id where p.open_source=true group by p.id,p.name,p.version order by feature_count desc;',
  markdown: '# Beautify\nA small tool for **readable code**.\n\n- Format JSON, YAML, and more\n- Inspect nested data\n- Keep your content in your browser\n\nVisit [GitHub](https://github.com).',
};

export function formatFromFilename(filename: string): FormatId | null {
  const extension = filename.toLowerCase().split('.').pop();
  const matches: Record<string, FormatId> = {
    json: 'json', jsonc: 'json', yml: 'yaml', yaml: 'yaml', xml: 'xml',
    html: 'html', htm: 'html', css: 'css', js: 'javascript', jsx: 'javascript',
    mjs: 'javascript', cjs: 'javascript', sql: 'sql', md: 'markdown', markdown: 'markdown',
  };
  return extension ? matches[extension] ?? null : null;
}

export async function formatSource(source: string, format: FormatId, indent: IndentSize): Promise<string> {
  if (!source.trim()) return '';

  if (format === 'json') {
    return JSON.stringify(JSON.parse(source), null, indent);
  }

  if (format === 'xml') {
    const { XMLValidator } = await import('fast-xml-parser');
    const validation = XMLValidator.validate(source);
    if (validation !== true) throw new Error(`XML: ${validation.err.msg} (line ${validation.err.line})`);
    const { default: xmlFormat } = await import('xml-formatter');
    return xmlFormat(source, { indentation: ' '.repeat(indent), lineSeparator: '\n', throwOnFailure: true });
  }

  if (format === 'sql') {
    const { format: formatSql } = await import('sql-formatter');
    return formatSql(source, { language: 'sql', tabWidth: indent, keywordCase: 'upper' });
  }

  const prettier = await import('prettier/standalone');
  const options = { tabWidth: indent, printWidth: 80 };

  switch (format) {
    case 'yaml': {
      const yaml = await import('prettier/plugins/yaml');
      return (await prettier.format(source, { ...options, parser: 'yaml', plugins: [yaml] })).trimEnd();
    }
    case 'html': {
      const html = await import('prettier/plugins/html');
      return (await prettier.format(source, { ...options, parser: 'html', plugins: [html] })).trimEnd();
    }
    case 'css': {
      const postcss = await import('prettier/plugins/postcss');
      return (await prettier.format(source, { ...options, parser: 'css', plugins: [postcss] })).trimEnd();
    }
    case 'javascript': {
      const [babel, estree] = await Promise.all([
        import('prettier/plugins/babel'),
        import('prettier/plugins/estree'),
      ]);
      return (await prettier.format(source, { ...options, parser: 'babel', plugins: [babel, estree] })).trimEnd();
    }
    case 'markdown': {
      const markdown = await import('prettier/plugins/markdown');
      return (await prettier.format(source, { ...options, parser: 'markdown', plugins: [markdown] })).trimEnd();
    }
  }
}

export function readableError(error: unknown): string {
  if (!(error instanceof Error)) return String(error);
  return error.message.split('\n').slice(0, 3).join(' ').trim().slice(0, 300);
}
