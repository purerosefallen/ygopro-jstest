import luaparse from 'luaparse';
import {
  normalizeLuaCoverageName,
  OcgcoreLuaCoverageMap,
  OcgcoreLuaLineCoverage,
} from 'koishipro-core.js';

export interface LuaLineCoverage extends OcgcoreLuaLineCoverage {
  executableLines?: number[];
  uncoveredLines?: number[];
  lineCoverage?: number;
}

export type LuaLineCoverageMap = Record<string, LuaLineCoverage>;
export type RawLuaCoverageMap = Record<string, Record<number, number>>;

export interface LuaCoverageJson {
  files: RawLuaCoverageMap;
}

const STATEMENT_NODE_PATTERN = /(?:Statement|Declaration)$/;

export const createLuaLineCoverage = (
  file: string,
  hits: Record<number, number>,
): LuaLineCoverage => {
  const coveredLines = Object.keys(hits)
    .map((line) => Number(line))
    .sort((left, right) => left - right);
  return { file, hits, coveredLines };
};

export const analyzeLuaExecutableLines = (
  source: string,
): number[] | undefined => {
  const lines = new Set<number>();
  try {
    luaparse.parse(source, {
      comments: false,
      locations: true,
      luaVersion: '5.3',
      onCreateNode: (node) => {
        if (STATEMENT_NODE_PATTERN.test(node.type) && node.loc?.start.line) {
          lines.add(node.loc.start.line);
        }
      },
    });
  } catch {
    return undefined;
  }
  return [...lines].sort((left, right) => left - right);
};

export const addLuaCoverageSummary = (
  coverage: OcgcoreLuaLineCoverage,
  source?: string | Uint8Array | null,
): LuaLineCoverage => {
  const result: LuaLineCoverage = {
    file: coverage.file,
    hits: { ...coverage.hits },
    coveredLines: [...coverage.coveredLines],
  };
  if (source == null) {
    return result;
  }

  const text =
    typeof source === 'string' ? source : new TextDecoder('utf-8').decode(source);
  const executableLines = analyzeLuaExecutableLines(text);
  if (!executableLines) {
    return result;
  }

  const covered = new Set(result.coveredLines);
  const coveredExecutableLines = executableLines.filter((line) =>
    covered.has(line),
  );
  const uncoveredLines = executableLines.filter((line) => !covered.has(line));
  result.executableLines = executableLines;
  result.uncoveredLines = uncoveredLines;
  result.lineCoverage =
    executableLines.length === 0
      ? 1
      : coveredExecutableLines.length / executableLines.length;
  return result;
};

export const normalizeLuaCoverageMap = (
  coverage: LuaLineCoverageMap | OcgcoreLuaCoverageMap | RawLuaCoverageMap,
): RawLuaCoverageMap => {
  const raw: RawLuaCoverageMap = {};
  for (const [name, value] of Object.entries(coverage)) {
    const normalized = normalizeLuaCoverageName(name);
    const hits =
      value &&
      typeof value === 'object' &&
      'hits' in value &&
      typeof value.hits === 'object'
        ? (value.hits as Record<number, number>)
        : (value as Record<number, number>);
    raw[normalized] = { ...(raw[normalized] ?? {}) };
    for (const [line, count] of Object.entries(hits)) {
      const lineNumber = Number(line);
      raw[normalized][lineNumber] =
        (raw[normalized][lineNumber] ?? 0) + Number(count);
    }
  }
  return raw;
};

export { normalizeLuaCoverageName };
